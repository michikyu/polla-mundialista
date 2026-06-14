import { Router } from 'express';
import { db } from '../db';
import { isAdminPassword, participantPasswordMatches } from '../auth';
import { asId } from '../validate';

export const gameRouter = Router();

// Tabla de mejores puntajes del mini-juego "Tiro al arco" (los 10 mejores).
gameRouter.get('/highscores', async (_req, res) => {
  const result = await db.execute(`
    SELECT gs.participant_id, gs.score, p.name
    FROM game_scores gs
    JOIN participants p ON p.id = gs.participant_id
    WHERE gs.score > 0
    ORDER BY gs.score DESC, gs.updated_at ASC
    LIMIT 10
  `);
  res.json(
    result.rows.map((r) => ({
      participant_id: Number(r.participant_id),
      name: String(r.name),
      score: Number(r.score),
    })),
  );
});

// Guarda el puntaje del participante (solo se queda con el mejor). Requiere su contraseña.
gameRouter.post('/score', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const participantId = asId(body?.participant_id);
  const rawScore = Number(body?.score);
  if (!participantId || !Number.isFinite(rawScore) || rawScore < 0) {
    res.status(400).json({ error: 'Datos del puntaje inválidos.' });
    return;
  }

  const isOwner = await participantPasswordMatches(participantId, req.header('x-participant-password'));
  const isAdmin = isAdminPassword(req.header('x-admin-password'));
  if (!isOwner && !isAdmin) {
    res.status(401).json({ error: 'Inicia sesión para guardar tu puntaje.' });
    return;
  }

  const score = Math.floor(rawScore);
  const now = new Date().toISOString();
  await db.execute({
    sql: `
      INSERT INTO game_scores (participant_id, score, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT (participant_id) DO UPDATE SET
        score = MAX(game_scores.score, excluded.score),
        updated_at = CASE
          WHEN excluded.score > game_scores.score THEN excluded.updated_at
          ELSE game_scores.updated_at
        END
    `,
    args: [participantId, score, now],
  });

  const row = await db.execute({
    sql: 'SELECT score FROM game_scores WHERE participant_id = ?',
    args: [participantId],
  });
  res.json({ best: Number(row.rows[0]?.score ?? score) });
});
