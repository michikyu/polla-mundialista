import { Router } from 'express';
import { db } from '../db';
import { sendTelegramTo } from '../notifier';
import { computeStandings } from '../standingsCalc';
import { getScoringConfig } from './settings';
import { kickoffTimestamp } from '../../shared/time';
import { flagEmoji } from '../../shared/teams';
import type { Match } from '../../shared/types';

export const telegramRouter = Router();

const APP_URL = 'https://polla-moachos.vercel.app';
const MEDALS = ['🥇', '🥈', '🥉'];

const homeWithFlag = (name: string) => {
  const flag = flagEmoji(name);
  return flag ? `${flag} ${name}` : name;
};
const awayWithFlag = (name: string) => {
  const flag = flagEmoji(name);
  return flag ? `${name} ${flag}` : name;
};

// "dom 14 jun, 5:00 p. m." en hora de Colombia.
const fullFmt = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const whenLabel = (kickoff: string) => fullFmt.format(new Date(kickoffTimestamp(kickoff)));

async function cmdTabla(): Promise<string> {
  const standings = await computeStandings();
  if (standings.length === 0) {
    return 'Aún no hay participantes.';
  }
  const lines = standings.map((row, i) => `${MEDALS[i] ?? `${i + 1}.`} ${row.name} — ${row.points} pts`);
  return ['📊 Tabla de posiciones', ...lines, '', `Detalles: ${APP_URL}`].join('\n');
}

async function cmdProximos(): Promise<string> {
  const result = await db.execute("SELECT * FROM matches WHERE status != 'finalizado'");
  const now = Date.now();
  const upcoming = (result.rows as unknown as Match[])
    .filter((m) => kickoffTimestamp(m.kickoff) >= now - 3 * 60 * 60_000) // incluye los en juego/recientes
    .sort((a, b) => kickoffTimestamp(a.kickoff) - kickoffTimestamp(b.kickoff))
    .slice(0, 6);
  if (upcoming.length === 0) {
    return 'No hay partidos próximos.';
  }
  const lines = upcoming.map(
    (m) =>
      `⚽ ${homeWithFlag(m.home_team)} vs ${awayWithFlag(m.away_team)}\n   🕐 ${whenLabel(m.kickoff)}${m.venue ? ` · ${m.venue}` : ''}`,
  );
  return ['📅 Próximos partidos', ...lines].join('\n');
}

async function cmdResultados(): Promise<string> {
  const result = await db.execute(
    "SELECT * FROM matches WHERE status = 'finalizado' AND home_score IS NOT NULL AND away_score IS NOT NULL",
  );
  const finished = (result.rows as unknown as Match[])
    .sort((a, b) => kickoffTimestamp(b.kickoff) - kickoffTimestamp(a.kickoff))
    .slice(0, 6);
  if (finished.length === 0) {
    return 'Todavía no hay resultados.';
  }
  const lines = finished.map(
    (m) => `✅ ${homeWithFlag(m.home_team)} ${m.home_score} - ${m.away_score} ${awayWithFlag(m.away_team)}`,
  );
  return ['📋 Últimos resultados', ...lines].join('\n');
}

async function cmdFaltan(): Promise<string> {
  const result = await db.execute("SELECT * FROM matches WHERE status = 'pendiente'");
  const now = Date.now();
  const open = (result.rows as unknown as Match[])
    .filter((m) => kickoffTimestamp(m.kickoff) > now)
    .sort((a, b) => kickoffTimestamp(a.kickoff) - kickoffTimestamp(b.kickoff))
    .slice(0, 5);
  if (open.length === 0) {
    return 'No hay partidos abiertos para predecir ahora.';
  }
  const blocks: string[] = [];
  for (const m of open) {
    const missingResult = await db.execute({
      sql: `
        SELECT p.name FROM participants p
        WHERE NOT EXISTS (
          SELECT 1 FROM predictions pr WHERE pr.participant_id = p.id AND pr.match_id = ?
        )
        ORDER BY p.name COLLATE NOCASE
      `,
      args: [m.id],
    });
    const missing = missingResult.rows.map((r) => String(r.name));
    const head = `⚽ ${homeWithFlag(m.home_team)} vs ${awayWithFlag(m.away_team)} (${whenLabel(m.kickoff)})`;
    blocks.push(`${head}\n   ${missing.length ? `🙈 Faltan: ${missing.join(', ')}` : '✅ Todos al día'}`);
  }
  return ['📝 Predicciones pendientes', ...blocks, '', `Ponla en: ${APP_URL}`].join('\n');
}

async function cmdPuntaje(): Promise<string> {
  const s = await getScoringConfig();
  return [
    '🏆 Cómo se puntúa',
    `🎯 Marcador exacto (único): ${s.exactUnique}`,
    `🎯 Marcador exacto (repetido): ${s.exactShared}`,
    `✅ Acertar ganador/empate: ${s.outcome}`,
    `❌ Fallar: ${s.miss}`,
    '',
    'Empate en la tabla: va primero quien envió su predicción más temprano.',
  ].join('\n');
}

function cmdAyuda(): string {
  return [
    '🤖 Comandos de la Polla',
    '/tabla — posiciones actuales',
    '/proximos — próximos partidos',
    '/resultados — últimos resultados',
    '/faltan — a quién le falta predecir',
    '/puntaje — cómo se puntúa',
    '/ayuda — esta lista',
    '',
    `Web: ${APP_URL}`,
  ].join('\n');
}

export async function handleCommand(cmd: string): Promise<string | null> {
  switch (cmd) {
    case 'tabla':
      return cmdTabla();
    case 'proximos':
      return cmdProximos();
    case 'resultados':
      return cmdResultados();
    case 'faltan':
      return cmdFaltan();
    case 'puntaje':
    case 'reglas':
      return cmdPuntaje();
    case 'ayuda':
    case 'start':
    case 'help':
      return cmdAyuda();
    default:
      return null;
  }
}

// Registra el webhook y el menú de comandos usando el token en runtime (no expuesto fuera).
async function registerWebhook(): Promise<Record<string, unknown>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token) {
    return { ok: false, error: 'Falta TELEGRAM_BOT_TOKEN en el entorno.' };
  }
  const call = (method: string, body: unknown) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json() as Promise<{ ok?: boolean; description?: string }>);

  const wh = await call('setWebhook', {
    url: `${APP_URL}/api/telegram`,
    secret_token: secret,
    allowed_updates: ['message'],
  });
  const cmds = await call('setMyCommands', {
    commands: [
      { command: 'tabla', description: 'Posiciones actuales' },
      { command: 'proximos', description: 'Próximos partidos' },
      { command: 'resultados', description: 'Últimos resultados' },
      { command: 'faltan', description: 'A quién le falta predecir' },
      { command: 'puntaje', description: 'Cómo se puntúa' },
      { command: 'ayuda', description: 'Lista de comandos' },
    ],
  });
  return {
    ok: Boolean(wh.ok && cmds.ok),
    webhook: wh.ok ? 'registrado' : wh.description ?? 'error',
    commands: cmds.ok ? 'registrados' : cmds.description ?? 'error',
  };
}

// Activa/actualiza los comandos del bot. Lo protege el middleware de admin (POST en app.ts).
telegramRouter.post('/setup', async (_req, res) => {
  res.json(await registerWebhook());
});

interface TelegramUpdate {
  message?: { text?: string; chat?: { id?: number } };
}

// Webhook de Telegram: responde a los comandos. Lo protege un token secreto que solo
// conoce Telegram (configurado en setWebhook). El endpoint está exento del admin en app.ts.
telegramRouter.post('/', async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.header('x-telegram-bot-api-secret-token') !== secret) {
    res.sendStatus(401);
    return;
  }
  // Responde 200 de inmediato; Telegram no necesita el cuerpo.
  res.sendStatus(200);

  try {
    const update = req.body as TelegramUpdate;
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat?.id;
    if (!text || chatId === undefined || !text.startsWith('/')) {
      return;
    }
    // "/tabla@PollaMoachosBot extra" → "tabla"
    const cmd = text.slice(1).split(/\s+/)[0].split('@')[0].toLowerCase();
    const reply = await handleCommand(cmd);
    if (reply) {
      await sendTelegramTo(chatId, reply);
    }
  } catch {
    // Nunca propagar errores al webhook (ya respondimos 200).
  }
});
