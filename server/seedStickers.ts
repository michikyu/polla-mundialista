// Importa las imágenes de public/keepers/ a la tabla game_stickers.
// Local (base de archivo):   npx tsx server/seedStickers.ts
// Producción (Turso):        SEED_PROD=1 npx tsx server/seedStickers.ts
//   (SEED_PROD lee las credenciales TURSO_* de .env.local antes de conectar.)
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function loadEnvLocal(): void {
  try {
    const file = readFileSync(path.join(import.meta.dirname, '..', '.env.local'), 'utf8');
    for (const line of file.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // No hay .env.local; se usa la base local.
  }
}

if (process.env.SEED_PROD === '1') {
  loadEnvLocal();
}

const mimeByExt: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

async function main(): Promise<void> {
  // Importación dinámica DESPUÉS de cargar el entorno (db lee process.env al importarse).
  const { db, ready } = await import('./db');
  await ready;

  const existing = await db.execute('SELECT COUNT(*) AS c FROM game_stickers');
  if (Number(existing.rows[0]?.c ?? 0) > 0) {
    console.log(`Ya hay ${existing.rows[0]?.c} stickers en la base; no hago nada.`);
    return;
  }

  const dir = path.join(import.meta.dirname, '..', 'public', 'keepers');
  const files = readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f) && /keeper/i.test(f))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  if (files.length === 0) {
    console.log('No encontré imágenes en public/keepers/.');
    return;
  }

  const now = new Date().toISOString();
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const mime = mimeByExt[ext] ?? 'image/png';
    const data = readFileSync(path.join(dir, f)).toString('base64');
    await db.execute({
      sql: 'INSERT INTO game_stickers (data, mime, created_at) VALUES (?, ?, ?)',
      args: [data, mime, now],
    });
    console.log(`Insertada ${f} (${mime}, ${Math.round((data.length * 0.75) / 1024)} KB)`);
  }
  console.log(`Listo: ${files.length} imágenes importadas.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
