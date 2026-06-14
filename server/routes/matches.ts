import { Router } from 'express';
import { db } from '../db';
import { isAdminPassword } from '../auth';
import { withEffectiveStatus } from '../matchStatus';
import { sendResultAlerts } from '../notifier';
import { calculatePoints, isExactHit } from '../../shared/scoring';
import { getScoringConfig } from './settings';
import { asTrimmedString, asGoals, asId, asStage } from '../validate';
import type { Match, MatchDetail, MatchPredictionRow } from '../../shared/types';

export const matchesRouter = Router();

async function getMatch(id: number): Promise<Match | undefined> {
  const result = await db.execute({ sql: 'SELECT * FROM matches WHERE id = ?', args: [id] });
  const row = result.rows[0] as unknown as Match | undefined;
  return row ? withEffectiveStatus(row) : undefined;
}

matchesRouter.get('/', async (_req, res) => {
  const result = await db.execute('SELECT * FROM matches ORDER BY kickoff, id');
  const countsResult = await db.execute(
    'SELECT match_id, COUNT(*) AS prediction_count FROM predictions GROUP BY match_id',
  );
  const counts = new Map(
    countsResult.rows.map((row) => [Number(row.match_id), Number(row.prediction_count)]),
  );
  res.json(
    (result.rows as unknown as Match[]).map((match) => ({
      ...withEffectiveStatus(match),
      predictions_count: counts.get(match.id) ?? 0,
    })),
  );
});

matchesRouter.get('/:id', async (req, res) => {
  const id = asId(req.params.id);
  const match = id ? await getMatch(id) : undefined;
  if (!match) {
    res.status(404).json({ error: 'Partido no encontrado.' });
    return;
  }
  const result = await db.execute({
    sql: `
      SELECT p.id AS participant_id, p.name AS participant_name,
             pr.home_goals, pr.away_goals, pr.updated_at AS predicted_at
      FROM participants p
      LEFT JOIN predictions pr ON pr.participant_id = p.id AND pr.match_id = ?
      ORDER BY p.name COLLATE NOCASE
    `,
    args: [match.id],
  });
  const rows = result.rows as unknown as MatchPredictionRow[];

  const finished = match.status === 'finalizado' && match.home_score !== null && match.away_score !== null;
  const exactHitsInMatch = finished
    ? rows.filter(
        (row) =>
          row.home_goals !== null &&
          row.away_goals !== null &&
          isExactHit(row.home_goals, row.away_goals, match.home_score as number, match.away_score as number),
      ).length
    : 0;
  // Las predicciones de otros son secretas hasta que empiece el partido
  // (el administrador sí puede verlas).
  const hideGoals = match.status === 'pendiente' && !isAdminPassword(req.header('x-admin-password'));
  const scoring = finished ? await getScoringConfig() : undefined;

  const predictions = rows.map((row) => {
    const hasPrediction = row.home_goals !== null && row.away_goals !== null;
    return {
      ...row,
      has_prediction: hasPrediction,
      home_goals: hideGoals ? null : row.home_goals,
      away_goals: hideGoals ? null : row.away_goals,
      points:
        finished && hasPrediction
          ? calculatePoints(
              row.home_goals as number,
              row.away_goals as number,
              match.home_score as number,
              match.away_score as number,
              exactHitsInMatch,
              scoring,
            )
          : null,
    };
  });

  const detail: MatchDetail = { match, predictions };
  res.json(detail);
});

matchesRouter.post('/', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const homeTeam = asTrimmedString(body?.home_team);
  const awayTeam = asTrimmedString(body?.away_team);
  const kickoff = asTrimmedString(body?.kickoff);
  const venue = asTrimmedString(body?.venue);
  const stage = asStage(body?.stage);
  if (!homeTeam || !awayTeam || !kickoff) {
    res.status(400).json({ error: 'Equipo local, visitante y fecha son obligatorios.' });
    return;
  }
  const info = await db.execute({
    sql: 'INSERT INTO matches (home_team, away_team, kickoff, venue, stage) VALUES (?, ?, ?, ?, ?)',
    args: [homeTeam, awayTeam, kickoff, venue || null, stage],
  });
  res.status(201).json(await getMatch(Number(info.lastInsertRowid)));
});

matchesRouter.put('/:id', async (req, res) => {
  const id = asId(req.params.id);
  const body = req.body as Record<string, unknown>;
  const homeTeam = asTrimmedString(body?.home_team);
  const awayTeam = asTrimmedString(body?.away_team);
  const kickoff = asTrimmedString(body?.kickoff);
  const venue = asTrimmedString(body?.venue);
  const stage = asStage(body?.stage);
  if (!id || !homeTeam || !awayTeam || !kickoff) {
    res.status(400).json({ error: 'Equipo local, visitante y fecha son obligatorios.' });
    return;
  }
  const info = await db.execute({
    sql: 'UPDATE matches SET home_team = ?, away_team = ?, kickoff = ?, venue = ?, stage = ? WHERE id = ?',
    args: [homeTeam, awayTeam, kickoff, venue || null, stage, id],
  });
  if (info.rowsAffected === 0) {
    res.status(404).json({ error: 'Partido no encontrado.' });
    return;
  }
  res.json(await getMatch(id));
});

// Reabrir un partido finalizado: borra el resultado y vuelve a pendiente.
// (El bloqueo de predicciones es automático según la hora de inicio.)
matchesRouter.post('/:id/reopen', async (req, res) => {
  const id = asId(req.params.id);
  const match = id ? await getMatch(id) : undefined;
  if (!match) {
    res.status(404).json({ error: 'Partido no encontrado.' });
    return;
  }
  await db.batch(
    [
      {
        sql: "UPDATE matches SET status = 'pendiente', home_score = NULL, away_score = NULL WHERE id = ?",
        args: [match.id],
      },
      // Borra el aviso de resultado para que, al volver a registrarlo, se anuncie de nuevo.
      { sql: "DELETE FROM notifications WHERE match_id = ? AND kind = 'resultado'", args: [match.id] },
    ],
    'write',
  );
  res.json(await getMatch(match.id));
});

matchesRouter.post('/:id/result', async (req, res) => {
  const id = asId(req.params.id);
  const body = req.body as Record<string, unknown>;
  const homeScore = asGoals(body?.home_score);
  const awayScore = asGoals(body?.away_score);
  const match = id ? await getMatch(id) : undefined;
  if (!match) {
    res.status(404).json({ error: 'Partido no encontrado.' });
    return;
  }
  if (homeScore === null || awayScore === null) {
    res.status(400).json({ error: 'El marcador debe ser un número entero entre 0 y 99.' });
    return;
  }
  await db.execute({
    sql: "UPDATE matches SET home_score = ?, away_score = ?, status = 'finalizado' WHERE id = ?",
    args: [homeScore, awayScore, match.id],
  });
  // Anuncio inmediato al grupo (marcador + tabla). Si Telegram falla, el cron reintenta.
  try {
    await sendResultAlerts();
  } catch {
    // No romper el registro del resultado si la notificación falla.
  }
  res.json(await getMatch(match.id));
});

matchesRouter.delete('/:id', async (req, res) => {
  const id = asId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Identificador inválido.' });
    return;
  }
  const results = await db.batch(
    [
      { sql: 'DELETE FROM predictions WHERE match_id = ?', args: [id] },
      { sql: 'DELETE FROM matches WHERE id = ?', args: [id] },
    ],
    'write',
  );
  if (results[1].rowsAffected === 0) {
    res.status(404).json({ error: 'Partido no encontrado.' });
    return;
  }
  res.json({ ok: true });
});
