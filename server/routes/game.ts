import { Router } from 'express';
import { db } from '../db';
import { isAdminPassword, participantPasswordMatches } from '../auth';
import { asId } from '../validate';

export const gameRouter = Router();

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_STICKER_BYTES = 1_500_000; // ~1.5 MB por imagen

// Lista de imágenes del juego (solo los ids; cada imagen se baja por separado).
gameRouter.get('/stickers', async (_req, res) => {
  const result = await db.execute('SELECT id FROM game_stickers ORDER BY id');
  res.json(result.rows.map((r) => ({ id: Number(r.id) })));
});

// Sirve los bytes de una imagen.
gameRouter.get('/stickers/:id', async (req, res) => {
  const id = asId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Id inválido.' });
    return;
  }
  const result = await db.execute({
    sql: 'SELECT data, mime FROM game_stickers WHERE id = ?',
    args: [id],
  });
  const row = result.rows[0] as unknown as { data: string; mime: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Imagen no encontrada.' });
    return;
  }
  res.setHeader('Content-Type', row.mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(row.data, 'base64'));
});

// Añade una imagen (solo admin; lo exige el middleware global por ser POST).
gameRouter.post('/stickers', async (req, res) => {
  const body = req.body as { data?: unknown; mime?: unknown };
  let data = typeof body?.data === 'string' ? body.data : '';
  let mime = typeof body?.mime === 'string' ? body.mime : '';
  // Acepta data URLs ("data:image/png;base64,....").
  const match = data.match(/^data:([^;]+);base64,(.*)$/s);
  if (match) {
    mime = mime || match[1];
    data = match[2];
  }
  data = data.trim();
  if (!data || !ALLOWED_MIME.has(mime)) {
    res.status(400).json({ error: 'Imagen inválida. Usa PNG, JPG, WEBP o GIF.' });
    return;
  }
  // base64 ≈ 4/3 del tamaño real.
  if (data.length * 0.75 > MAX_STICKER_BYTES) {
    res.status(413).json({ error: 'La imagen es muy grande (máx. ~1.5 MB).' });
    return;
  }
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: 'INSERT INTO game_stickers (data, mime, created_at) VALUES (?, ?, ?)',
    args: [data, mime, now],
  });
  res.json({ id: Number(result.lastInsertRowid) });
});

// Elimina una imagen (solo admin).
gameRouter.delete('/stickers/:id', async (req, res) => {
  const id = asId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Id inválido.' });
    return;
  }
  await db.execute({ sql: 'DELETE FROM game_stickers WHERE id = ?', args: [id] });
  res.json({ ok: true });
});

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
