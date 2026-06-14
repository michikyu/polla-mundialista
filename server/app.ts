import express, { type ErrorRequestHandler } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ready } from './db';
import { authRouter, requireAdmin } from './auth';
import { participantsRouter } from './routes/participants';
import { matchesRouter } from './routes/matches';
import { predictionsRouter } from './routes/predictions';
import { standingsRouter } from './routes/standings';
import { syncRouter } from './routes/sync';
import { notifyRouter } from './routes/notify';
import { settingsRouter } from './routes/settings';
import { backupRouter } from './routes/backup';
import { webauthnRouter } from './routes/webauthn';
import { gameRouter } from './routes/game';

export const app = express();

// Límite alto para permitir subir imágenes del mini-juego y restaurar respaldos.
app.use(express.json({ limit: '8mb' }));

// Garantiza que el esquema y los datos iniciales existan antes de atender peticiones.
app.use(async (_req, _res, next) => {
  try {
    await ready;
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRouter);

// Lectura libre para todos; cualquier cambio exige la contraseña de administrador.
// Excepciones públicas: guardar predicciones (valida contraseña del participante) y
// el login con passkey (su propósito es entrar sin contraseña).
app.use('/api', (req, res, next) => {
  if (
    req.method === 'GET' ||
    (req.method === 'PUT' && req.path === '/predictions') ||
    (req.method === 'POST' && req.path === '/game/score') ||
    (req.method === 'POST' && req.path.startsWith('/webauthn/'))
  ) {
    next();
    return;
  }
  requireAdmin(req, res, next);
});

app.use('/api/participants', participantsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/standings', standingsRouter);
app.use('/api/sync-results', syncRouter);
app.use('/api/notify', notifyRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/backup', backupRouter);
app.use('/api/webauthn', webauthnRouter);
app.use('/api/game', gameRouter);

// Si el frontend fue compilado (npm run build), servirlo directamente (modo local).
const distDir = path.join(import.meta.dirname, '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(distDir, 'index.html'));
      return;
    }
    next();
  });
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
};
app.use(errorHandler);
