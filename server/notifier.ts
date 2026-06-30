import { db } from './db';
import { kickoffTimestamp } from '../shared/time';
import { calculatePoints, isExactHit } from '../shared/scoring';
import { computeStandings } from './standingsCalc';
import { flagEmoji } from '../shared/teams';
import type { Match } from '../shared/types';

// Nombre del equipo con su bandera. Local: bandera a la izquierda; visitante: a la derecha.
function homeWithFlag(name: string): string {
  const flag = flagEmoji(name);
  return flag ? `${flag} ${name}` : name;
}
function awayWithFlag(name: string): string {
  const flag = flagEmoji(name);
  return flag ? `${name} ${flag}` : name;
}

const APP_URL = 'https://polla-moachos.vercel.app';
// Ventana para el aviso previo: avisa si el partido empieza dentro de los próximos 45 min.
const PREMATCH_WINDOW_MS = 45 * 60_000;

const bogotaTime = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

// Envía un mensaje a un chat específico. Devuelve false si falta el token (no rompe nada).
export async function sendTelegramTo(chatId: string | number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return false;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Envía un mensaje al grupo (chat configurado). Devuelve false si falta configurar el bot.
export async function sendTelegram(text: string): Promise<boolean> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    return false;
  }
  return sendTelegramTo(chatId, text);
}

// Aviso previo: partidos que empiezan pronto y a quién le falta predicción.
export async function sendPrematchAlerts(): Promise<number> {
  const now = Date.now();
  const matchesResult = await db.execute("SELECT * FROM matches WHERE status != 'finalizado'");
  const upcoming = (matchesResult.rows as unknown as Match[]).filter((match) => {
    const diff = kickoffTimestamp(match.kickoff) - now;
    return diff > 0 && diff <= PREMATCH_WINDOW_MS;
  });
  if (upcoming.length === 0) {
    return 0;
  }

  const notifiedResult = await db.execute("SELECT match_id FROM notifications WHERE kind = 'previa'");
  const notified = new Set(notifiedResult.rows.map((row) => Number(row.match_id)));

  let sent = 0;
  for (const match of upcoming) {
    if (notified.has(match.id)) {
      continue;
    }
    const missingResult = await db.execute({
      sql: `
        SELECT p.name FROM participants p
        WHERE NOT EXISTS (
          SELECT 1 FROM predictions pr WHERE pr.participant_id = p.id AND pr.match_id = ?
        )
        ORDER BY p.name COLLATE NOCASE
      `,
      args: [match.id],
    });
    const missing = missingResult.rows.map((row) => String(row.name));
    const hora = bogotaTime.format(new Date(kickoffTimestamp(match.kickoff)));

    const text = [
      `⚽ ¡Ya casi! ${homeWithFlag(match.home_team)} vs ${awayWithFlag(match.away_team)}`,
      `🕐 Hoy a las ${hora} (hora Colombia)${match.venue ? ` · ${match.venue}` : ''}`,
      missing.length > 0
        ? `🙈 Sin predicción: ${missing.join(', ')}\n📝 Corre a ponerla: ${APP_URL}`
        : '✅ ¡Todos ya pusieron su predicción! 🎉',
    ].join('\n');

    if (await sendTelegram(text)) {
      await db.execute({
        sql: "INSERT INTO notifications (match_id, kind, sent_at) VALUES (?, 'previa', ?)",
        args: [match.id, new Date().toISOString()],
      });
      sent += 1;
    }
  }
  return sent;
}

interface KickoffPredRow {
  name: string;
  home_goals: number | null;
  away_goals: number | null;
}

// Ventana para revelar predicciones: el partido empezó hace menos de 6 h (el cron corre
// cada 10 min, así que lo agarra a tiempo; evita avisar partidos muy viejos).
const KICKOFF_WINDOW_MS = 6 * 60 * 60_000;

// Al comenzar un partido (se cierran las predicciones), revela qué predijo cada quien.
export async function sendKickoffAlerts(): Promise<number> {
  const now = Date.now();
  const matchesResult = await db.execute('SELECT * FROM matches');
  const started = (matchesResult.rows as unknown as Match[]).filter((match) => {
    const ts = kickoffTimestamp(match.kickoff);
    return ts <= now && ts > now - KICKOFF_WINDOW_MS;
  });
  if (started.length === 0) {
    return 0;
  }

  const notifiedResult = await db.execute("SELECT match_id FROM notifications WHERE kind = 'inicio'");
  const notified = new Set(notifiedResult.rows.map((row) => Number(row.match_id)));

  let sent = 0;
  for (const match of started) {
    if (notified.has(match.id)) {
      continue;
    }
    const predsResult = await db.execute({
      sql: `
        SELECT p.name, pr.home_goals, pr.away_goals
        FROM participants p
        LEFT JOIN predictions pr ON pr.participant_id = p.id AND pr.match_id = ?
        ORDER BY p.name COLLATE NOCASE
      `,
      args: [match.id],
    });
    const rows = predsResult.rows as unknown as KickoffPredRow[];
    const predicted: string[] = [];
    const missing: string[] = [];
    for (const row of rows) {
      if (row.home_goals !== null && row.away_goals !== null) {
        predicted.push(`• ${row.name}: ${row.home_goals}-${row.away_goals}`);
      } else {
        missing.push(row.name);
      }
    }

    const text = [
      `🔓 ¡Empieza! ${homeWithFlag(match.home_team)} vs ${awayWithFlag(match.away_team)}`,
      '📋 Predicciones:',
      ...(predicted.length > 0 ? predicted : ['(nadie predijo este partido)']),
      missing.length > 0 ? `🙈 Sin predicción: ${missing.join(', ')}` : '',
      '',
      `Sigue todo en: ${APP_URL}`,
    ]
      .filter((line) => line !== '')
      .join('\n');

    if (await sendTelegram(text)) {
      await db.execute({
        sql: "INSERT INTO notifications (match_id, kind, sent_at) VALUES (?, 'inicio', ?)",
        args: [match.id, new Date().toISOString()],
      });
      sent += 1;
    }
  }
  return sent;
}

interface FinishedPredRow {
  participant_id: number;
  name: string;
  home_goals: number;
  away_goals: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

// Aviso de resultado: cuando un partido termina, marcador + puntos ganados y tabla actualizada.
export async function sendResultAlerts(): Promise<number> {
  const matchesResult = await db.execute(
    "SELECT * FROM matches WHERE status = 'finalizado' AND home_score IS NOT NULL AND away_score IS NOT NULL",
  );
  const finished = matchesResult.rows as unknown as Match[];
  if (finished.length === 0) {
    return 0;
  }

  const notifiedResult = await db.execute("SELECT match_id FROM notifications WHERE kind = 'resultado'");
  const notified = new Set(notifiedResult.rows.map((row) => Number(row.match_id)));
  const pending = finished.filter((m) => !notified.has(m.id));
  if (pending.length === 0) {
    return 0;
  }

  let sent = 0;
  for (const match of pending) {
    const homeScore = match.home_score as number;
    const awayScore = match.away_score as number;
    const hpTxt = match.home_penalties != null ? ` (${match.home_penalties})` : '';
    const apTxt = match.away_penalties != null ? ` (${match.away_penalties})` : '';

    // Predicciones de este partido para calcular los puntos ganados por cada quien.
    const predsResult = await db.execute({
      sql: `
        SELECT p.id AS participant_id, p.name, pr.home_goals, pr.away_goals
        FROM predictions pr
        JOIN participants p ON p.id = pr.participant_id
        WHERE pr.match_id = ?
      `,
      args: [match.id],
    });
    const preds = predsResult.rows as unknown as FinishedPredRow[];

    const exactHitsInMatch = preds.filter((row) =>
      isExactHit(row.home_goals, row.away_goals, homeScore, awayScore),
    ).length;
    const pointsByParticipant = new Map<number, number>();
    for (const row of preds) {
      pointsByParticipant.set(
        row.participant_id,
        calculatePoints(row.home_goals, row.away_goals, homeScore, awayScore, exactHitsInMatch),
      );
    }

    // Tabla actualizada (ya incluye este partido porque está finalizado en la BD).
    const standings = await computeStandings();
    const tableLines = standings.map((row, index) => {
      const rank = MEDALS[index] ?? `${index + 1}.`;
      const gained = pointsByParticipant.get(row.participant_id);
      const delta = gained === undefined ? '' : ` (+${gained})`;
      return `${rank} ${row.name} — ${row.points} pts${delta}`;
    });

    const text = [
      `✅ Final: ${homeWithFlag(match.home_team)} ${homeScore}${hpTxt} - ${awayScore}${apTxt} ${awayWithFlag(match.away_team)}`,
      '',
      '📊 Tabla actualizada:',
      ...tableLines,
      '',
      `Detalles: ${APP_URL}`,
    ].join('\n');

    if (await sendTelegram(text)) {
      await db.execute({
        sql: "INSERT INTO notifications (match_id, kind, sent_at) VALUES (?, 'resultado', ?)",
        args: [match.id, new Date().toISOString()],
      });
      sent += 1;
    }
  }
  return sent;
}
