import { Router } from 'express';
import { isAdminPassword } from '../auth';
import { sendPrematchAlerts, sendKickoffAlerts, sendResultAlerts } from '../notifier';
import { syncFromFootballData, autoCreateKnockoutFromGroups } from './sync';

export const notifyRouter = Router();

// Lo llama el cron de Vercel (cada 10 min en horario de partidos) y también el admin manualmente.
// Hace que la página se mantenga sola: primero baja resultados/cruces de football-data.org,
// y luego manda los avisos al grupo (previo a cada partido y de resultado al terminar).
notifyRouter.get('/', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret) && req.header('authorization') === `Bearer ${cronSecret}`;
  if (!isCron && !isAdminPassword(req.header('x-admin-password'))) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }

  // 1) Sincroniza resultados y cruces. Si falla (token/API), seguimos con los avisos.
  let sync = null;
  try {
    sync = await syncFromFootballData();
  } catch {
    // football-data.org no disponible: se reintenta en la próxima corrida.
  }

  // 1b) Crea los cruces de eliminatoria ya decididos por los grupos (no depende de la API).
  let autoCreated = 0;
  try {
    autoCreated = await autoCreateKnockoutFromGroups();
  } catch {
    // No romper el cron si esto falla.
  }

  // 2) Avisos al grupo (sin duplicados, los controla la tabla notifications).
  const prematch = await sendPrematchAlerts();
  const kickoff = await sendKickoffAlerts();
  const results = await sendResultAlerts();

  res.json({ sync, autoCreated, prematch, kickoff, results });
});
