import { Router, type RequestHandler } from 'express';
import { db } from './db';
import { asId } from './validate';

// La contraseña de administrador viene de la variable de entorno ADMIN_PASSWORD.
// En producción DEBES configurarla (Vercel → Settings → Environment Variables).
// Si no está, usa un valor de marcador para desarrollo local — cámbialo.
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme';

export function isAdminPassword(provided: string | undefined): boolean {
  return provided === ADMIN_PASSWORD;
}

// Cada participante tiene su propia contraseña para registrar sus predicciones.
export async function participantPasswordMatches(
  participantId: number,
  provided: string | undefined,
): Promise<boolean> {
  if (!provided) {
    return false;
  }
  const result = await db.execute({
    sql: 'SELECT password FROM participants WHERE id = ?',
    args: [participantId],
  });
  const stored = result.rows[0]?.password;
  return typeof stored === 'string' && stored.length > 0 && stored === provided;
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (isAdminPassword(req.header('x-admin-password'))) {
    next();
    return;
  }
  res.status(401).json({ error: 'Solo el administrador puede hacer cambios. Desbloquea con la contraseña.' });
};

export const authRouter = Router();

authRouter.get('/status', (req, res) => {
  res.json({ required: true, admin: isAdminPassword(req.header('x-admin-password')) });
});

authRouter.post('/check', (req, res) => {
  const password = String((req.body as Record<string, unknown>)?.password ?? '');
  res.json({ ok: isAdminPassword(password) });
});

authRouter.post('/participant-check', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const participantId = asId(body?.participant_id);
  const password = String(body?.password ?? '');
  if (!participantId) {
    res.status(400).json({ error: 'Falta el participante.' });
    return;
  }
  const ok = isAdminPassword(password) || (await participantPasswordMatches(participantId, password));
  res.json({ ok });
});
