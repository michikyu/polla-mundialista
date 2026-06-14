import { rmSync } from 'node:fs';
import path from 'node:path';

const dataDir = path.join(import.meta.dirname, '..', 'data');

try {
  for (const file of ['polla.db', 'polla.db-wal', 'polla.db-shm']) {
    rmSync(path.join(dataDir, file), { force: true });
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'EBUSY') {
    console.error('ATENCION: La app sigue corriendo y tiene la base de datos abierta.');
    console.error('Detén la app primero (Ctrl + C en la terminal donde corre "npm run dev") y vuelve a intentar.');
    process.exit(1);
  }
  throw error;
}

await import('./db');
console.log('Base de datos reiniciada con datos de ejemplo en data/polla.db');
