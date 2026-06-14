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

export const app = express();

app.use(express.json());

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
// Excepción: guardar predicciones, que también acepta la contraseña personal del
// participante (la valida la propia ruta).
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || (req.method === 'PUT' && req.path === '/predictions')) {
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
