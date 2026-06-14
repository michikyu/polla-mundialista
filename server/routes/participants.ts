import { Router } from 'express';
import { db } from '../db';
import { asTrimmedString, asId, asHandicap } from '../validate';
import type { Participant } from '../../shared/types';

export const participantsRouter = Router();

// Nunca exponer la columna password en las respuestas.
const PUBLIC_COLUMNS = 'id, name';

participantsRouter.get('/', async (_req, res) => {
  const result = await db.execute(`SELECT ${PUBLIC_COLUMNS} FROM participants ORDER BY name COLLATE NOCASE`);
  res.json(result.rows as unknown as Participant[]);
});

participantsRouter.post('/', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const name = asTrimmedString(body?.name);
  const password = asTrimmedString(body?.password);
  const handicap = asHandicap(body?.handicap) ?? 0;
  if (!name) {
    res.status(400).json({ error: 'El nombre es obligatorio.' });
    return;
  }
  try {
    const info = await db.execute({
      sql: 'INSERT INTO participants (name, password, handicap) VALUES (?, ?, ?)',
      args: [name, password || null, handicap],
    });
    const row = await db.execute({
      sql: `SELECT ${PUBLIC_COLUMNS} FROM participants WHERE id = ?`,
      args: [Number(info.lastInsertRowid)],
    });
    res.status(201).json(row.rows[0]);
  } catch {
    res.status(409).json({ error: 'Ya existe un participante con ese nombre.' });
  }
});

participantsRouter.put('/:id', async (req, res) => {
  const id = asId(req.params.id);
  const body = req.body as Record<string, unknown>;
  const name = asTrimmedString(body?.name);
  const password = asTrimmedString(body?.password);
  const handicap = asHandicap(body?.handicap);
  if (!id || !name) {
    res.status(400).json({ error: 'El nombre es obligatorio.' });
    return;
  }
  // Solo se actualizan los campos que vienen: la contraseña vacía no la borra,
  // y el handicap solo cambia si se envió un número válido.
  const sets = ['name = ?'];
  const args: (string | number)[] = [name];
  if (password) {
    sets.push('password = ?');
    args.push(password);
  }
  if (handicap !== null) {
    sets.push('handicap = ?');
    args.push(handicap);
  }
  args.push(id);
  try {
    const info = await db.execute({
      sql: `UPDATE participants SET ${sets.join(', ')} WHERE id = ?`,
      args,
    });
    if (info.rowsAffected === 0) {
      res.status(404).json({ error: 'Participante no encontrado.' });
      return;
    }
    const row = await db.execute({
      sql: `SELECT ${PUBLIC_COLUMNS} FROM participants WHERE id = ?`,
      args: [id],
    });
    res.json(row.rows[0]);
  } catch {
    res.status(409).json({ error: 'Ya existe un participante con ese nombre.' });
  }
});

participantsRouter.delete('/:id', async (req, res) => {
  const id = asId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Identificador inválido.' });
    return;
  }
  const results = await db.batch(
    [
      { sql: 'DELETE FROM predictions WHERE participant_id = ?', args: [id] },
      { sql: 'DELETE FROM participants WHERE id = ?', args: [id] },
    ],
    'write',
  );
  if (results[1].rowsAffected === 0) {
    res.status(404).json({ error: 'Participante no encontrado.' });
    return;
  }
  res.json({ ok: true });
});
