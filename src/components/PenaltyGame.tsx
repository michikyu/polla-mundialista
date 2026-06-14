import { useEffect, useRef, useState } from 'react';

// Las 3 imágenes de arquero van en public/keepers/ con estos nombres.
// Si falta alguna, se usa un emoji de respaldo (el juego igual funciona).
const KEEPERS = ['/keepers/keeper1.png', '/keepers/keeper2.png', '/keepers/keeper3.png'];

const COLS = [20, 50, 80]; // x% de cada zona
const ROWS = [34, 66]; // y% (arriba / abajo)
const ZONES = [0, 1, 2, 3, 4, 5].map((i) => ({
  x: COLS[i % 3],
  y: ROWS[Math.floor(i / 3)],
}));

const BALL_HOME = { x: 50, y: 90 };
const KEEPER_HOME = { x: 50, y: 58 };

function randomKeeper(): string {
  return KEEPERS[Math.floor(Math.random() * KEEPERS.length)];
}

export function PenaltyGame({ onClose }: { onClose: () => void }) {
  const [goals, setGoals] = useState(0);
  const [shots, setShots] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [message, setMessage] = useState('Apunta y patea ⚽');
  const [shooting, setShooting] = useState(false);
  const [keeper, setKeeper] = useState(randomKeeper);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [ball, setBall] = useState(BALL_HOME);
  const [keeperPos, setKeeperPos] = useState(KEEPER_HOME);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const shoot = (zoneIndex: number) => {
    if (shooting) {
      return;
    }
    setShooting(true);
    setMessage('');
    const dive = Math.floor(Math.random() * ZONES.length);
    const k = randomKeeper();
    setKeeper(k);
    setBall(ZONES[zoneIndex]);
    setKeeperPos(ZONES[dive]);

    timers.current.push(
      window.setTimeout(() => {
        const saved = dive === zoneIndex;
        setShots((s) => s + 1);
        if (saved) {
          setMessage('¡Atajada! 🧤 Te la comió el arquero.');
          setStreak(0);
        } else {
          setGoals((g) => g + 1);
          setStreak((st) => {
            const next = st + 1;
            setBest((b) => Math.max(b, next));
            return next;
          });
          setMessage('¡GOOOL! ⚽🎉');
        }
      }, 450),
    );
    timers.current.push(
      window.setTimeout(() => {
        setBall(BALL_HOME);
        setKeeperPos(KEEPER_HOME);
        setShooting(false);
      }, 1300),
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pg" role="dialog" aria-label="Penaltis" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚽ Penaltis</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="pg-score">
          <span>⚽ Goles: <strong>{goals}</strong>/{shots}</span>
          <span>🔥 Racha: <strong>{streak}</strong></span>
          <span>🏅 Mejor: <strong>{best}</strong></span>
        </div>

        <div className="pg-pitch">
          <div className="pg-goal">
            <div className="pg-keeper" style={{ left: `${keeperPos.x}%`, top: `${keeperPos.y}%` }}>
              {failed[keeper] ? (
                <span className="pg-keeper-emoji">🧤</span>
              ) : (
                <img
                  src={keeper}
                  alt="Arquero"
                  onError={() => setFailed((prev) => ({ ...prev, [keeper]: true }))}
                />
              )}
            </div>
            {ZONES.map((z, i) => (
              <button
                key={i}
                className="pg-target"
                style={{ left: `${z.x}%`, top: `${z.y}%` }}
                onClick={() => shoot(i)}
                disabled={shooting}
                aria-label={`Patear a la zona ${i + 1}`}
              />
            ))}
            <div className="pg-ball" style={{ left: `${ball.x}%`, top: `${ball.y}%` }}>⚽</div>
          </div>
        </div>

        <p className="pg-msg">{message}</p>
        <p className="muted hint pg-hint">Toca una de las 6 zonas del arco para patear. El arquero ataja al azar.</p>
      </div>
    </div>
  );
}
