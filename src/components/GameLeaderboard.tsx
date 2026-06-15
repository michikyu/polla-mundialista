import { useEffect, useState } from 'react';
import { api } from '../api';

const GAME_ENABLED = import.meta.env.VITE_ENABLE_GAME === 'true';
const MEDALS = ['🥇', '🥈', '🥉'];

interface HighScore {
  participant_id: number;
  name: string;
  score: number;
}

// Tabla de mejores puntajes del mini-juego "Tiro al arco". Se auto-oculta si el
// juego no está habilitado o si todavía nadie ha jugado.
export function GameLeaderboard() {
  const [scores, setScores] = useState<HighScore[]>([]);

  useEffect(() => {
    if (!GAME_ENABLED) {
      return;
    }
    api.getHighscores().then(setScores).catch(() => {});
  }, []);

  if (!GAME_ENABLED) {
    return null;
  }

  return (
    <section className="card">
      <h2>🏆 Récords · Tiro al arco</h2>
      <p className="muted hint">Toca el reloj 🕐 de arriba para jugar. Los mejores puntajes del grupo:</p>
      {scores.length === 0 ? (
        <p className="muted">Aún nadie ha jugado. ¡Sé el primero en marcar un récord!</p>
      ) : (
        <ol className="gl-board">
          {scores.map((row, index) => (
            <li key={row.participant_id} className="gl-row">
              <span className="gl-medal">{MEDALS[index] ?? `${index + 1}.`}</span>
              <span className="gl-name">{row.name}</span>
              <span className="gl-pts">{row.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
