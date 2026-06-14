import { Router } from 'express';
import { db } from '../db';
import { asTrimmedString } from '../validate';

export const settingsRouter = Router();

// Lee un valor de configuración de la base (o null si no existe).
export async function getSetting(key: string): Promise<string | null> {
  const result = await db.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] });
  return (result.rows[0]?.value as string | undefined) ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    args: [key, value],
  });
}

// GET público: solo datos NO secretos (título y link del grupo). Del token de
// football-data solo se informa si está configurado, nunca su valor.
settingsRouter.get('/', async (_req, res) => {
  const [title, telegramLink, footballToken] = await Promise.all([
    getSetting('title'),
    getSetting('telegram_link'),
    getSetting('football_token'),
  ]);
  res.json({
    title,
    telegram_link: telegramLink,
    football_configured: Boolean(footballToken) || Boolean(process.env.FOOTBALL_DATA_TOKEN),
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

  await Promise.all(updates);

  const [title, telegramLink, footballToken] = await Promise.all([
    getSetting('title'),
    getSetting('telegram_link'),
    getSetting('football_token'),
  ]);
  res.json({
    title,
    telegram_link: telegramLink,
    football_configured: Boolean(footballToken) || Boolean(process.env.FOOTBALL_DATA_TOKEN),
  });
});
