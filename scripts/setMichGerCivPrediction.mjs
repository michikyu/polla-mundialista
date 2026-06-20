// Script de una sola vez: registra la predicción de "Mich" para Alemania vs Costa de Marfil
// (GER 4-1). Mich la mandó a tiempo (5 min antes del inicio) pero no quedó en la app, así
// que aquí se graba con su marca de tiempo real: el inicio del partido menos 5 minutos.
//
// El inicio se guarda en hora de Colombia (UTC-5). Para Alemania vs Costa de Marfil
// (2026-06-20T15:00) eso equivale a 2026-06-20T19:55:00.000Z (5 min antes).
//
// Uso: node scripts/setMichGerCivPrediction.mjs
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';

const PARTICIPANT = 'Mich';
const HOME_TEAM = 'Alemania';
const AWAY_TEAM = 'Costa de Marfil';
const HOME_GOALS = 4; // GER
const AWAY_GOALS = 1; // CIV
const MINUTES_BEFORE_KICKOFF = 5;

// Hora de Colombia (UTC-5), igual que shared/time.ts.
const COLOMBIA_UTC_OFFSET = '-05:00';
function kickoffTimestamp(kickoff) {
  const withZone = kickoff.length === 16 ? `${kickoff}:00${COLOMBIA_UTC_OFFSET}` : kickoff;
  const parsed = Date.parse(withZone);
  return Number.isNaN(parsed) ? Date.parse(kickoff) : parsed;
}

// Lee TURSO_* desde .env.local sin depender de dotenv.
const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
}

const db = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const participantRes = await db.execute({
  sql: 'SELECT id, name FROM participants WHERE name = ?',
  args: [PARTICIPANT],
});
if (participantRes.rows.length === 0) {
  const all = await db.execute('SELECT name FROM participants ORDER BY name COLLATE NOCASE');
  console.error(`No se encontró el participante "${PARTICIPANT}".`);
  console.error(`Participantes en la BD: ${all.rows.map((r) => r.name).join(', ')}`);
  process.exit(1);
}
const participant = participantRes.rows[0];

const matchRes = await db.execute({
  sql: 'SELECT id, home_team, away_team, kickoff FROM matches WHERE home_team = ? AND away_team = ?',
  args: [HOME_TEAM, AWAY_TEAM],
});
if (matchRes.rows.length === 0) {
  console.error(`No se encontró el partido ${HOME_TEAM} vs ${AWAY_TEAM}.`);
  process.exit(1);
}
const match = matchRes.rows[0];

// Marca de tiempo real de envío: inicio del partido menos 5 minutos.
const timestamp = new Date(
  kickoffTimestamp(match.kickoff) - MINUTES_BEFORE_KICKOFF * 60_000,
).toISOString();

const before = await db.execute({
  sql: 'SELECT home_goals, away_goals, created_at, updated_at FROM predictions WHERE participant_id = ? AND match_id = ?',
  args: [participant.id, match.id],
});
if (before.rows.length > 0) {
  const p = before.rows[0];
  console.log(`Predicción actual de ${participant.name}: ${p.home_goals}-${p.away_goals} (created_at ${p.created_at})`);
} else {
  console.log(`${participant.name} no tenía predicción registrada para este partido.`);
}

await db.execute({
  sql: `
    INSERT INTO predictions (participant_id, match_id, home_goals, away_goals, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (participant_id, match_id)
    DO UPDATE SET
      home_goals = excluded.home_goals,
      away_goals = excluded.away_goals,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `,
  args: [participant.id, match.id, HOME_GOALS, AWAY_GOALS, timestamp, timestamp],
});

const after = await db.execute({
  sql: 'SELECT home_goals, away_goals, created_at FROM predictions WHERE participant_id = ? AND match_id = ?',
  args: [participant.id, match.id],
});
const p = after.rows[0];
console.log(
  `\nListo. ${participant.name} → ${HOME_TEAM} ${p.home_goals}-${p.away_goals} ${AWAY_TEAM}` +
    ` (created_at ${p.created_at}, 5 min antes del inicio ${match.kickoff} hora Colombia).`,
);
