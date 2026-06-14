import { Router } from 'express';
import { db } from '../db';
import { isAdminPassword, participantPasswordMatches } from '../auth';
import { predictionsAreOpen } from '../matchStatus';
import { calculatePoints } from '../../shared/scoring';
import { getScoringConfig } from './settings';
import { asGoals, asId } from '../validate';
import type { Match, MatchStatus } from '../../shared/types';

export const predictionsRouter = Router();

interface PredictionWithMatchRow {
  id: number;
  participant_id: number;
  match_id: number;
  home_goals: number;
  away_goals: number;
  created_at: string | null;
  updated_at: string | null;
  kickoff: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
}

predictionsRouter.get('/', async (req, res) => {
  const participantId = asId(req.query.participant_id);
  if (!participantId) {
    res.status(400).json({ error: 'Falta el participante.' });
    return;
  }

  const result = await db.execute({
    sql: `
      SELECT pr.id, pr.participant_id, pr.match_id, pr.home_goals, pr.away_goals,
             pr.created_at, pr.updated_at,
             m.kickoff, m.status, m.home_score, m.away_score
      FROM predictions pr
      JOIN matches m ON m.id = pr.match_id
      WHERE pr.participant_id = ?
    `,
    args: [participantId],
  });
  const rows = result.rows as unknown as PredictionWithMatchRow[];

  // Cuántos acertaron el marcador exacto por partido (el exacto único vale 5; repetido, 4).
  const exactResult = await db.execute(`
    SELECT pr.match_id, COUNT(*) AS exact_count
    FROM predictions pr
    JOIN matches m ON m.id = pr.match_id
    WHERE m.status = 'finalizado' AND m.home_score IS NOT NULL
      AND pr.home_goals = m.home_score AND pr.away_goals = m.away_score
    GROUP BY pr.match_id
  `);
  const exactByMatch = new Map(
    exactResult.rows.map((row) => [Number(row.match_id), Number(row.exact_count)]),
  );

  // Las predicciones son secretas hasta que empiece el partido: solo el dueño
  // (con su contraseña) o el administrador ven los goles antes del inicio.
  const isAdmin = isAdminPassword(req.header('x-admin-password'));
  const isOwner = await participantPasswordMatches(participantId, req.header('x-participant-password'));
  const scoring = await getScoringConfig();

  const predictions = rows.map((row) => {
    const matchLike = { kickoff: row.kickoff, status: row.status } as Match;
    const stillSecret = predictionsAreOpen(matchLike) && !isAdmin && !isOwner;
    const finished = row.status === 'finalizado' && row.home_score !== null && row.away_score !== null;
    return {
      id: row.id,
      participant_id: row.participant_id,
      match_id: row.match_id,
      home_goals: stillSecret ? null : row.home_goals,
      away_goals: stillSecret ? null : row.away_goals,
      created_at: row.created_at,
      updated_at: row.updated_at,
      points: finished
        ? calculatePoints(
            row.home_goals,
            row.away_goals,
            row.home_score as number,
            row.away_score as number,
            exactByMatch.get(row.match_id) ?? 0,
            scoring,
          )
        : null,
    };
  });
  res.json(predictions);
});

// La predicción se registra UNA sola vez. Solo el administrador puede corregirla.
predictionsRouter.put('/', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const participantId = asId(body?.participant_id);
  const matchId = asId(body?.match_id);
  const homeGoals = asGoals(body?.home_goals);
  const awayGoals = asGoals(body?.away_goals);

  if (!participantId || !matchId) {
    res.status(400).json({ error: 'Faltan datos de la predicción.' });
    return;
  }
  if (homeGoals === null || awayGoals === null) {
    res.status(400).json({ error: 'Los goles deben ser números enteros entre 0 y 99.' });
    return;
  }

  // Puede guardar el administrador, o el propio participante con su contraseña personal.
  const isAdmin = isAdminPassword(req.header('x-admin-password'));
  const isOwner = await participantPasswordMatches(participantId, req.header('x-participant-password'));
  if (!isAdmin && !isOwner) {
    res.status(401).json({ error: 'Necesitas tu contraseña para guardar la predicción.' });
    return;
  }

  const participant = await db.execute({ sql: 'SELECT id FROM participants WHERE id = ?', args: [participantId] });
  if (participant.rows.length === 0) {
    res.status(404).json({ error: 'Participante no encontrado.' });
    return;
  }
  const matchResult = await db.execute({ sql: 'SELECT * FROM matches WHERE id = ?', args: [matchId] });
  const match = matchResult.rows[0] as unknown as Match | undefined;
  if (!match) {
    res.status(404).json({ error: 'Partido no encontrado.' });
    return;
  }
  if (!predictionsAreOpen(match)) {
    res.status(409).json({ error: 'El partido ya empezó: las predicciones están cerradas.' });
    return;
  }

  const existing = await db.execute({
    sql: 'SELECT id FROM predictions WHERE participant_id = ? AND match_id = ?',
    args: [participantId, matchId],
  });
  if (existing.rows.length > 0 && !isAdmin) {
    res.status(409).json({ error: 'Tu predicción ya quedó registrada y no se puede cambiar.' });
    return;
  }

  const now = new Date().toISOString();
  await db.execute({
    sql: `
      INSERT INTO predictions (participant_id, match_id, home_goals, away_goals, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (participant_id, match_id)
      DO UPDATE SET
        home_goals = excluded.home_goals,
        away_goals = excluded.away_goals,
        updated_at = excluded.updated_at
    `,
    args: [participantId, matchId, homeGoals, awayGoals, now, now],
  });

  const row = await db.execute({
    sql: 'SELECT * FROM predictions WHERE participant_id = ? AND match_id = ?',
    args: [participantId, matchId],
  });
  res.json(row.rows[0]);
});
