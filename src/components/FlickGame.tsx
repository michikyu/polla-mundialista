import { useEffect, useRef, useState } from 'react';

// Stickers como blancos: public/keepers/keeper1.png … keeper7.png (los que existan).
// Si no hay ninguno, se usan emojis de respaldo.
const STICKER_PATHS = Array.from({ length: 7 }, (_, i) => `/keepers/keeper${i + 1}.png`);
const FALLBACK_EMOJI = ['😎', '🧤', '🥅', '🔥', '🎯', '🙌', '🤡'];

const W = 360;
const H = 540;
const GRAVITY = 1150; // px/s²
const BALL_HOME = { x: 180, y: 500 };
const BALL_R = 12;

interface Target {
  x: number;
  y: number;
  r: number;
  img: HTMLImageElement | null;
  emoji: string;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function FlickGame({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [misses, setMisses] = useState(0);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem('polla-flick-best') || 0));
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const images: HTMLImageElement[] = [];
    for (const src of STICKER_PATHS) {
      const im = new Image();
      im.onload = () => images.push(im);
      im.src = src;
    }

    const game = {
      ball: { x: BALL_HOME.x, y: BALL_HOME.y, vx: 0, vy: 0, flying: false },
      targets: [] as Target[],
      score: 0,
      combo: 1,
      misses: 0,
      over: false,
      drag: null as null | { sx: number; sy: number; cx: number; cy: number },
      last: 0,
      sinceMove: 0,
    };

    const spawn = (): Target => {
      const img = images.length ? images[Math.floor(Math.random() * images.length)] : null;
      const r = rand(26, 34);
      return {
        x: rand(40 + r, W - 40 - r),
        y: rand(45 + r, 200),
        r,
        img,
        emoji: FALLBACK_EMOJI[Math.floor(Math.random() * FALLBACK_EMOJI.length)],
      };
    };
    game.targets = [spawn(), spawn()];

    const resetBall = () => {
      game.ball = { x: BALL_HOME.x, y: BALL_HOME.y, vx: 0, vy: 0, flying: false };
    };

    const endShotMiss = () => {
      resetBall();
      game.combo = 1;
      setCombo(1);
      game.misses += 1;
      setMisses(game.misses);
      if (game.misses >= 3) {
        game.over = true;
        setOver(true);
        setBest((b) => {
          const nb = Math.max(b, game.score);
          localStorage.setItem('polla-flick-best', String(nb));
          return nb;
        });
      }
    };

    const draw = () => {
      // Cancha
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#3aa757');
      grd.addColorStop(1, '#2f9e44');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // Arco
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(28, 24, W - 56, 200);
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      for (let x = 40; x < W - 40; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, 26);
        ctx.lineTo(x, 222);
        ctx.stroke();
      }
      for (let y = 38; y < 222; y += 14) {
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(W - 30, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Blancos
      for (const t of game.targets) {
        if (t.img) {
          const d = t.r * 2;
          ctx.drawImage(t.img, t.x - t.r, t.y - t.r, d, d);
        } else {
          ctx.font = `${t.r * 1.6}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(t.emoji, t.x, t.y);
        }
      }

      // Guía de apuntado
      if (game.drag) {
        const dx = game.drag.cx - game.drag.sx;
        const dy = game.drag.cy - game.drag.sy;
        const len = Math.min(160, Math.hypot(dx, dy));
        const ang = Math.atan2(-Math.abs(dy), dx);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(BALL_HOME.x, BALL_HOME.y);
        ctx.lineTo(BALL_HOME.x + Math.cos(ang) * len, BALL_HOME.y + Math.sin(ang) * len);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Balón
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚽', game.ball.x, game.ball.y);
    };

    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.04, game.last ? (t - game.last) / 1000 : 0);
      game.last = t;

      if (!game.over) {
        if (game.ball.flying) {
          game.ball.vy += GRAVITY * dt;
          game.ball.x += game.ball.vx * dt;
          game.ball.y += game.ball.vy * dt;

          for (let i = game.targets.length - 1; i >= 0; i--) {
            const tg = game.targets[i];
            const dx = tg.x - game.ball.x;
            const dy = tg.y - game.ball.y;
            if (dx * dx + dy * dy < (tg.r + BALL_R) * (tg.r + BALL_R)) {
              game.targets.splice(i, 1);
              game.targets.push(spawn());
              game.score += 10 * game.combo;
              game.combo += 1;
              setScore(game.score);
              setCombo(game.combo);
              resetBall();
              break;
            }
          }

          if (game.ball.flying && (game.ball.y < -40 || game.ball.x < -40 || game.ball.x > W + 40 || game.ball.y > H + 40)) {
            endShotMiss();
          }
        }

        // Los blancos se reubican cada cierto tiempo (más rápido al subir el puntaje).
        game.sinceMove += dt;
        const interval = Math.max(1.1, 2.8 - game.score / 200);
        if (game.sinceMove > interval) {
          game.sinceMove = 0;
          const t0 = game.targets[Math.floor(Math.random() * game.targets.length)];
          if (t0) {
            const fresh = spawn();
            t0.x = fresh.x;
            t0.y = fresh.y;
          }
        }
      }

      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const toLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    };
    const onDown = (e: PointerEvent) => {
      if (game.over || game.ball.flying) {
        return;
      }
      const p = toLocal(e);
      game.drag = { sx: p.x, sy: p.y, cx: p.x, cy: p.y };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (game.drag) {
        const p = toLocal(e);
        game.drag.cx = p.x;
        game.drag.cy = p.y;
      }
    };
    const onUp = () => {
      if (!game.drag) {
        return;
      }
      const dx = game.drag.cx - game.drag.sx;
      const dy = game.drag.cy - game.drag.sy;
      game.drag = null;
      if (Math.hypot(dx, dy) < 10) {
        return;
      }
      // Siempre sale hacia arriba; la fuerza/altura dependen del deslizamiento.
      game.ball.vx = Math.max(-700, Math.min(700, dx * 2.4));
      game.ball.vy = Math.max(-1500, Math.min(-260, -Math.abs(dy) * 2.7 - 140));
      game.ball.flying = true;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [runId]);

  const restart = () => {
    setScore(0);
    setCombo(1);
    setMisses(0);
    setOver(false);
    setRunId((r) => r + 1);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pg" role="dialog" aria-label="Tiro al arco" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎯 Tiro al arco</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="pg-score">
          <span>⭐ <strong>{score}</strong></span>
          <span>🔥 x{combo}</span>
          <span>❌ {misses}/3</span>
          <span>🏅 {best}</span>
        </div>

        <div className="fg-wrap">
          <canvas ref={canvasRef} className="fg-canvas" />
          {over && (
            <div className="fg-over">
              <div className="fg-over-card">
                <div className="fg-over-title">¡Fin del juego!</div>
                <div className="fg-over-score">{score} puntos</div>
                <button className="btn btn-primary" onClick={restart}>Jugar de nuevo</button>
              </div>
            </div>
          )}
        </div>

        <p className="muted hint pg-hint">
          Desliza con el dedo desde abajo para lanzar el balón ⚽ y pegarle a los stickers. La fuerza y la
          altura dependen de tu deslizamiento. ¡3 fallos y se acaba!
        </p>
      </div>
    </div>
  );
}
