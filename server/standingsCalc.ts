import { db } from './db';
import { calculatePoints, isExactHit, POINTS_OUTCOME } from '../shared/scoring';
import type { StandingRow } from '../shared/types';

interface ParticipantWithHandicap {
  id: number;
  name: string;
  handicap: number;
}

interface ScoredPredictionRow {
  participant_id: number;
  match_id: number;
  home_goals: number;
  away_goals: number;
  home_score: number;
  away_score: number;
  created_at: string | null;
}

// Calcula la tabla de posiciones a partir de los partidos finalizados.
// Mismo criterio en toda la app: exacto único 5, exacto repetido 4, acierto 3, fallo 0.
// Desempate: a igual puntaje, primero quien envió su predicción más temprano.
export async function computeStandings(): Promise<StandingRow[]> {
  const participantsResult = await db.execute(
    'SELECT id, name, handicap FROM participants ORDER BY name COLLATE NOCASE',
  );
  const participants = participantsResult.rows as unknown as ParticipantWithHandicap[];

  const scoredResult = await db.execute(`
    SELECT pr.participant_id, pr.match_id, pr.home_goals, pr.away_goals, pr.created_at,
           m.home_score, m.away_score
    FROM predictions pr
    JOIN matches m ON m.id = pr.match_id
    WHERE m.status = 'finalizado' AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
  `);
  const scored = scoredResult.rows as unknown as ScoredPredictionRow[];

  const exactHitsByMatch = new Map<number, number>();
  for (const row of scored) {
    if (isExactHit(row.home_goals, row.away_goals, row.home_score, row.away_score)) {
      exactHitsByMatch.set(row.match_id, (exactHitsByMatch.get(row.match_id) ?? 0) + 1);
    }
  }

  // El puntaje arranca en el handicap (ventaja inicial por entrar tarde, etc.).
  const byParticipant = new Map<number, StandingRow>(
    participants.map((p) => [
      p.id,
      {
        participant_id: p.id,
        name: p.name,
        points: p.handicap ?? 0,
        exact_hits: 0,
        outcome_hits: 0,
        misses: 0,
        handicap: p.handicap ?? 0,
      },
    ]),
  );
  const earliestByParticipant = new Map<number, string>();

  for (const row of scored) {
    const standing = byParticipant.get(row.participant_id);
    if (!standing) {
      continue;
    }
    const points = calculatePoints(
      row.home_goals,
      row.away_goals,
      row.home_score,
      row.away_score,
      exactHitsByMatch.get(row.match_id) ?? 0,
    );
    standing.points += points;
    if (isExactHit(row.home_goals, row.away_goals, row.home_score, row.away_score)) {
      standing.exact_hits += 1;
    } else if (points === POINTS_OUTCOME) {
      standing.outcome_hits += 1;
    } else {
      standing.misses += 1;
    }
    if (row.created_at) {
      const current = earliestByParticipant.get(row.participant_id);
      if (!current || row.created_at < current) {
        earliestByParticipant.set(row.participant_id, row.created_at);
      }
    }
  }

  const NO_TIMESTAMP = '9999';
  return [...byParticipant.values()].sort(
    (a, b) =>
      b.points - a.points ||
      (earliestByParticipant.get(a.participant_id) ?? NO_TIMESTAMP).localeCompare(
        earliestByParticipant.get(b.participant_id) ?? NO_TIMESTAMP,
      ) ||
      b.exact_hits - a.exact_hits ||
      a.name.localeCompare(b.name, 'es'),
  );
}
