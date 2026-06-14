// Script de una sola vez: marca los partidos YA finalizados como "resultado ya anunciado"
// para que al activar las alertas de Telegram no se manden resultados viejos de golpe.
// Uso: node scripts/seedResultNotifications.mjs
import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';

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

await db.execute(`
  CREATE TABLE IF NOT EXISTS notifications (
    match_id INTEGER NOT NULL REFERENCES matches(id),
    kind TEXT NOT NULL,
    sent_at TEXT,
    PRIMARY KEY (match_id, kind)
  )
`);

const finished = await db.execute(
  "SELECT id, home_team, away_team FROM matches WHERE status = 'finalizado'",
);

const now = new Date().toISOString();
let seeded = 0;
for (const row of finished.rows) {
  const result = await db.execute({
    sql: "INSERT OR IGNORE INTO notifications (match_id, kind, sent_at) VALUES (?, 'resultado', ?)",
    args: [row.id, now],
  });
  if (result.rowsAffected > 0) {
    seeded += 1;
    console.log(`  marcado: ${row.home_team} vs ${row.away_team}`);
  }
}

console.log(`\nListo. ${seeded} partido(s) finalizado(s) marcados como ya anunciados.`);
console.log(`(${finished.rows.length} finalizados en total; los demás ya estaban marcados.)`);
