// Re-codifica las imágenes de public/keepers/ a WebP pequeño (256px) y reemplaza
// el contenido de game_stickers (borra y vuelve a insertar).
// Local:       npx tsx server/reseedStickers.ts
// Producción:  SEED_PROD=1 npx tsx server/reseedStickers.ts
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

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
    // Sin .env.local; base local.
  }
}

if (process.env.SEED_PROD === '1') {
  loadEnvLocal();
}

async function main(): Promise<void> {
  const { db, ready } = await import('./db');
  await ready;

  const dir = path.join(import.meta.dirname, '..', 'public', 'keepers');
  const files = readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f) && /keeper/i.test(f))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  if (files.length === 0) {
    console.log('No encontré imágenes en public/keepers/.');
    return;
  }

  const now = new Date().toISOString();
  await db.execute('DELETE FROM game_stickers');
  let totalKb = 0;
  for (const f of files) {
    const buf = await sharp(readFileSync(path.join(dir, f)))
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const data = buf.toString('base64');
    totalKb += buf.length / 1024;
    await db.execute({
      sql: 'INSERT INTO game_stickers (data, mime, created_at) VALUES (?, ?, ?)',
      args: [data, 'image/webp', now],
    });
    console.log(`${f} → webp ${Math.round(buf.length / 1024)} KB`);
  }
  console.log(`Listo: ${files.length} imágenes, ${Math.round(totalKb)} KB en total.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
