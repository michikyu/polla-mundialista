import { Router } from 'express';
import { db } from '../db';
import { isAdminPassword } from '../auth';
import type { InStatement } from '@libsql/client';

export const backupRouter = Router();

const BACKUP_VERSION = 1;

// Exportar TODO (incluye contraseñas) → solo admin. El GET es público por defecto en
// app.ts, así que aquí se exige admin explícitamente.
backupRouter.get('/', async (req, res) => {
  if (!isAdminPassword(req.header('x-admin-password'))) {
    res.status(401).json({ error: 'Solo el administrador puede descargar el respaldo.' });
    return;
  }
  const [participants, matches, predictions, settings] = await Promise.all([
    db.execute('SELECT * FROM participants'),
    db.execute('SELECT * FROM matches'),
    db.execute('SELECT * FROM predictions'),
    db.execute('SELECT * FROM settings'),
  ]);
  res.json({
    version: BACKUP_VERSION,
    participants: participants.rows,
    matches: matches.rows,
    predictions: predictions.rows,
    settings: settings.rows,
  });
});

type Row = Record<string, unknown>;

function insertStatement(table: string, row: Row): InStatement {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(', ');
  return {
    sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
    args: cols.map((c) => row[c] as never),
  };
}

// Restaurar: reemplaza TODOS los datos por los del respaldo (en una sola transacción).
backupRouter.post('/', async (req, res) => {
  const body = req.body as {
    version?: number;
    participants?: Row[];
    matches?: Row[];
    predictions?: Row[];
    settings?: Row[];
  };
  if (!body || !Array.isArray(body.participants) || !Array.isArray(body.matches)) {
    res.status(400).json({ error: 'Respaldo inválido: faltan datos.' });
    return;
  }

  const statements: InStatement[] = [
    // Borrar en orden seguro por las llaves foráneas.
    { sql: 'DELETE FROM notifications', args: [] },
    { sql: 'DELETE FROM predictions', args: [] },
    { sql: 'DELETE FROM settings', args: [] },
    { sql: 'DELETE FROM participants', args: [] },
    { sql: 'DELETE FROM matches', args: [] },
  ];
  for (const row of body.participants) {
    statements.push(insertStatement('participants', row));
  }
  for (const row of body.matches) {
    statements.push(insertStatement('matches', row));
  }
  for (const row of body.predictions ?? []) {
    statements.push(insertStatement('predictions', row));
  }
  for (const row of body.settings ?? []) {
    statements.push(insertStatement('settings', row));
  }

  await db.batch(statements, 'write');
  res.json({
    ok: true,
    restored: {
      participants: body.participants.length,
      matches: body.matches.length,
      predictions: body.predictions?.length ?? 0,
    },
  });
});
