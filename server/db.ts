import { createClient, type InStatement } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  GROUP_FIXTURES,
  MATCH2_PREDICTIONS,
  MATCH2_PREDICTIONS_BASE_TIME,
  OPENER_PREDICTIONS,
  OPENER_PREDICTIONS_BASE_TIME,
  PARTICIPANT_PASSWORDS,
  SEED_PARTICIPANTS,
  type SeedPrediction,
} from './fixtures';

// Local: archivo SQLite en data/polla.db. En la nube (Vercel): Turso vía variables de entorno.
function localFileUrl(): string {
  const dataDir = path.join(import.meta.dirname, '..', 'data');
  mkdirSync(dataDir, { recursive: true });
  return 'file:' + path.join(dataDir, 'polla.db').replace(/\\/g, '/');
}

const remoteUrl = process.env.TURSO_DATABASE_URL;

export const db = createClient(
  remoteUrl
    ? { url: remoteUrl, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: localFileUrl() },
);

export const ready: Promise<void> = init();

async function init(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      password TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      kickoff TEXT NOT NULL,
      venue TEXT,
      home_score INTEGER,
      away_score INTEGER,
      status TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (status IN ('pendiente', 'cerrado', 'finalizado')),
      stage TEXT NOT NULL DEFAULT 'grupos'
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL REFERENCES participants(id),
      match_id INTEGER NOT NULL REFERENCES matches(id),
      home_goals INTEGER NOT NULL,
      away_goals INTEGER NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE (participant_id, match_id)
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      match_id INTEGER NOT NULL REFERENCES matches(id),
      kind TEXT NOT NULL,
      sent_at TEXT,
      PRIMARY KEY (match_id, kind)
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  await migrate();
  await seedIfEmpty();
}

async function migrate(): Promise<void> {
  const alters = [
    'ALTER TABLE matches ADD COLUMN venue TEXT',
    "ALTER TABLE matches ADD COLUMN stage TEXT NOT NULL DEFAULT 'grupos'",
    'ALTER TABLE participants ADD COLUMN password TEXT',
    'ALTER TABLE participants ADD COLUMN handicap INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE predictions ADD COLUMN created_at TEXT',
    'ALTER TABLE predictions ADD COLUMN updated_at TEXT',
  ];
  for (const sql of alters) {
    try {
      await db.execute(sql);
    } catch {
      // La columna ya existe.
    }
  }
  // Asigna las contraseñas personales a los participantes que aún no tengan una.
  for (const [name, password] of Object.entries(PARTICIPANT_PASSWORDS)) {
    await db.execute({
      sql: "UPDATE participants SET password = ? WHERE name = ? AND (password IS NULL OR password = '')",
      args: [password, name],
    });
  }
}

// Marca de tiempo escalonada: un minuto entre cada predicción, según el orden de envío.
function staggeredTime(baseIso: string, index: number): string {
  return new Date(Date.parse(baseIso) + index * 60_000).toISOString();
}

function predictionStatements(
  predictions: SeedPrediction[],
  matchId: number,
  baseTime: string,
): InStatement[] {
  const statements: InStatement[] = [];
  predictions.forEach(({ name, goals: [homeGoals, awayGoals] }, index) => {
    const participantId = SEED_PARTICIPANTS.indexOf(name) + 1;
    if (participantId > 0) {
      const timestamp = staggeredTime(baseTime, index);
      statements.push({
        sql: `INSERT INTO predictions (participant_id, match_id, home_goals, away_goals, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [participantId, matchId, homeGoals, awayGoals, timestamp, timestamp],
      });
    }
  });
  return statements;
}

async function seedIfEmpty(): Promise<void> {
  const result = await db.execute('SELECT COUNT(*) AS count FROM participants');
  if (Number(result.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const statements: InStatement[] = [];

  SEED_PARTICIPANTS.forEach((name, index) => {
    statements.push({
      sql: 'INSERT INTO participants (id, name, password) VALUES (?, ?, ?)',
      args: [index + 1, name, PARTICIPANT_PASSWORDS[name] ?? null],
    });
  });

  GROUP_FIXTURES.forEach((fixture, index) => {
    const hasResult = fixture.homeScore !== undefined && fixture.awayScore !== undefined;
    statements.push({
      sql: `INSERT INTO matches (id, home_team, away_team, kickoff, venue, home_score, away_score, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        index + 1,
        fixture.home,
        fixture.away,
        fixture.kickoff,
        fixture.venue,
        hasResult ? (fixture.homeScore as number) : null,
        hasResult ? (fixture.awayScore as number) : null,
        hasResult ? 'finalizado' : 'pendiente',
      ],
    });
  });

  const openerId = GROUP_FIXTURES.findIndex((f) => f.home === 'México' && f.away === 'Sudáfrica') + 1;
  if (openerId > 0) {
    statements.push(...predictionStatements(OPENER_PREDICTIONS, openerId, OPENER_PREDICTIONS_BASE_TIME));
  }
  const match2Id = GROUP_FIXTURES.findIndex((f) => f.home === 'Corea del Sur' && f.away === 'Chequia') + 1;
  if (match2Id > 0) {
    statements.push(...predictionStatements(MATCH2_PREDICTIONS, match2Id, MATCH2_PREDICTIONS_BASE_TIME));
  }

  await db.batch(statements, 'write');
}
