import { Router } from 'express';
import { db } from '../db';
import { asTrimmedString } from '../validate';

export const settingsRouter = Router();

// Configuración editable por el administrador. Por ahora: el título de la app.
// GET es público (lo lee el frontend al cargar); PUT exige admin (lo valida app.ts).
settingsRouter.get('/', async (_req, res) => {
  const result = await db.execute("SELECT value FROM settings WHERE key = 'title'");
  const title = (result.rows[0]?.value as string | undefined) ?? null;
  res.json({ title });
});

settingsRouter.put('/', async (req, res) => {
  const title = asTrimmedString((req.body as Record<string, unknown>)?.title);
  if (!title) {
    res.status(400).json({ error: 'El título no puede estar vacío.' });
    return;
  }
  await db.execute({
    sql: `INSERT INTO settings (key, value) VALUES ('title', ?)
          ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    args: [title],
  });
  res.json({ title });
});
