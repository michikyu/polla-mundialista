import { Router } from 'express';
import { db } from '../db';
import { asTrimmedString } from '../validate';
import { DEFAULT_SCORING, type ScoringConfig } from '../../shared/scoring';

export const settingsRouter = Router();

// Lee un valor de configuración de la base (o null si no existe).
export async function getSetting(key: string): Promise<string | null> {
  const result = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
  return (result.rows[0]?.value as string | undefined) ?? null;
}

const SCORING_KEYS: Record<keyof ScoringConfig, string> = {
  exactUnique: 'points_exact_unique',
  exactShared: 'points_exact_shared',
  outcome: 'points_outcome',
  miss: 'points_miss',
};

// Config de puntaje guardada por el admin; cae a los valores por defecto (5/4/3/0).
export async function getScoringConfig(): Promise<ScoringConfig> {
  const entries = await Promise.all(
    (Object.keys(SCORING_KEYS) as Array<keyof ScoringConfig>).map(async (field) => {
      const raw = await getSetting(SCORING_KEYS[field]);
      const num = raw === null ? NaN : Number(raw);
      return [field, Number.isInteger(num) ? num : DEFAULT_SCORING[field]] as const;
    }),
  );
  return Object.fromEntries(entries) as unknown as ScoringConfig;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    args: [key, value],
  });
}

// GET público: solo datos NO secretos (título y link del grupo). Del token de
// football-data solo se informa si está configurado, nunca su valor.
settingsRouter.get('/', async (_req, res) => {
  const [title, telegramLink, footballToken, scoring, passkeys] = await Promise.all([
    getSetting('title'),
    getSetting('telegram_link'),
    getSetting('football_token'),
    getScoringConfig(),
    db.execute('SELECT COUNT(*) AS n FROM webauthn_credentials'),
  ]);
  res.json({
    title,
    telegram_link: telegramLink,
    football_configured: Boolean(footballToken) || Boolean(process.env.FOOTBALL_DATA_TOKEN),
    scoring,
    passkey_enabled: Number(passkeys.rows[0]?.n ?? 0) > 0,
  });
});

// PUT admin (lo protege app.ts): actualiza solo los campos enviados.
settingsRouter.put('/', async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates: Array<Promise<void>> = [];

  if (body.title !== undefined) {
    const title = asTrimmedString(body.title);
    if (!title) {
      res.status(400).json({ error: 'El título no puede estar vacío.' });
      return;
    }
    updates.push(setSetting('title', title));
  }
  if (body.telegram_link !== undefined) {
    updates.push(setSetting('telegram_link', asTrimmedString(body.telegram_link)));
  }
  if (body.football_token !== undefined) {
    updates.push(setSetting('football_token', asTrimmedString(body.football_token)));
  }
  // Valores de puntaje (enteros 0-99). Recalculan la tabla retroactivamente.
  const scoringInput = (body.scoring ?? {}) as Record<string, unknown>;
  for (const field of Object.keys(SCORING_KEYS) as Array<keyof ScoringConfig>) {
    if (scoringInput[field] !== undefined) {
      const num = Number(scoringInput[field]);
      if (!Number.isInteger(num) || num < 0 || num > 99) {
        res.status(400).json({ error: 'Los puntos deben ser enteros entre 0 y 99.' });
        return;
      }
      updates.push(setSetting(SCORING_KEYS[field], String(num)));
    }
  }

  await Promise.all(updates);

  const [title, telegramLink, footballToken, scoring] = await Promise.all([
    getSetting('title'),
    getSetting('telegram_link'),
    getSetting('football_token'),
    getScoringConfig(),
  ]);
  res.json({
    title,
    telegram_link: telegramLink,
    football_configured: Boolean(footballToken) || Boolean(process.env.FOOTBALL_DATA_TOKEN),
    scoring,
  });
});
