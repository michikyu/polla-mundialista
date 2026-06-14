import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

// El campo es lógico (360x540) y se escala al ancho disponible. Todo lo aleatorio
// sale de una semilla FIJA: el blanco aparece en los mismos lugares, con la misma
// velocidad y el mismo ritmo para todos → el puntaje es justo (solo cambia tu pulso).
const W = 360;
const H = 540;
const GRAVITY = 1150; // px/s²
const BALL_HOME = { x: 180, y: 500 };
const BALL_R = 18;
const SEED = 1337;

// Zona interior del arco donde vive el blanco.
const GOAL = { x0: 34, x1: W - 34, y0: 30, y1: 218 };
const SPEED_BASE = 55; // px/s (sube con el puntaje)
const R_BASE = 34;
const R_MIN = 18;

// Mismo balón que el título (BallIcon, balón Trionda) para dibujarlo en el canvas.
const BALL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<defs><clipPath id="bc"><circle cx="50" cy="50" r="47"/></clipPath></defs>' +
  '<circle cx="50" cy="50" r="47" fill="#ffffff"/>' +
  '<g clip-path="url(#bc)">' +
  '<g><path d="M50 4 C 63 4, 75 12, 78 26 C 70 37, 59 42, 50 40 C 41 42, 30 37, 22 26 C 25 12, 37 4, 50 4 Z" fill="#1c7ed6"/>' +
  '<path d="M33 12 C 43 8, 57 8, 67 12" stroke="#1255a3" stroke-width="2.4" fill="none"/>' +
  '<path d="M27 20 C 40 14, 60 14, 73 20" stroke="#1255a3" stroke-width="2.4" fill="none"/>' +
  '<rect x="46.6" y="26" width="6.8" height="6.8" fill="#ffffff" transform="rotate(45 50 29.4)"/></g>' +
  '<g transform="rotate(120 50 50)"><path d="M50 4 C 63 4, 75 12, 78 26 C 70 37, 59 42, 50 40 C 41 42, 30 37, 22 26 C 25 12, 37 4, 50 4 Z" fill="#d6336c"/>' +
  '<path d="M33 12 C 43 8, 57 8, 67 12" stroke="#9c1c43" stroke-width="2.4" fill="none"/>' +
  '<path d="M27 20 C 40 14, 60 14, 73 20" stroke="#9c1c43" stroke-width="2.4" fill="none"/></g>' +
  '<g transform="rotate(240 50 50)"><path d="M50 4 C 63 4, 75 12, 78 26 C 70 37, 59 42, 50 40 C 41 42, 30 37, 22 26 C 25 12, 37 4, 50 4 Z" fill="#2f9e44"/>' +
  '<path d="M33 12 C 43 8, 57 8, 67 12" stroke="#1d6b2e" stroke-width="2.4" fill="none"/>' +
  '<path d="M27 20 C 40 14, 60 14, 73 20" stroke="#1d6b2e" stroke-width="2.4" fill="none"/></g>' +
  '<g stroke="#16265c" stroke-width="4.5" fill="none" stroke-linecap="round">' +
  '<path d="M79 25 C 90 40, 90 58, 78 70"/>' +
  '<path d="M79 25 C 90 40, 90 58, 78 70" transform="rotate(120 50 50)"/>' +
  '<path d="M79 25 C 90 40, 90 58, 78 70" transform="rotate(240 50 50)"/></g>' +
  '</g><circle cx="50" cy="50" r="47" fill="none" stroke="#334155" stroke-width="2.5"/></svg>';

type Phase = 'start' | 'playing' | 'over';

interface HighScore {
  participant_id: number;
  name: string;
  score: number;
}

interface Target {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  golden: boolean;
  points: number;
  imgIdx: number;
}

// PRNG determinista (mulberry32): misma semilla → misma secuencia.
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function FlickGame({
  onClose,
  participantId,
}: {
  onClose: () => void;
  participantId: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const effectsRef = useRef(true);
  const phaseRef = useRef<Phase>('start');
  const [phase, setPhaseState] = useState<Phase>('start');
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [effectsOn, setEffectsOn] = useState(true);
  const [runId, setRunId] = useState(0);
  const [highscores, setHighscores] = useState<HighScore[]>([]);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  useEffect(() => {
    api.getHighscores().then(setHighscores).catch(() => {});
  }, []);

  // Al terminar: guarda tu puntaje (si entraste como participante) y refresca la tabla.
  useEffect(() => {
    if (phase !== 'over') {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        if (participantId) {
          await api.submitGameScore(participantId, score);
        }
      } catch {
        // Sin conexión, etc.
      }
      try {
        const hs = await api.getHighscores();
        if (!cancelled) {
          setHighscores(hs);
        }
      } catch {
        // Ignorar.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, score, participantId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const ballImg = new Image();
    ballImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(BALL_SVG);

    const drawField = () => {
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#3aa757');
      grd.addColorStop(1, '#2f9e44');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
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
    };

    // En la pantalla de inicio / fin solo se ve el campo quieto.
    if (phaseRef.current !== 'playing') {
      drawField();
      return;
    }

    const images: HTMLImageElement[] = [];
    api
      .getStickers()
      .then((list) => {
        for (const { id } of list) {
          const im = new Image();
          im.onload = () => images.push(im);
          im.src = `/api/game/stickers/${id}`;
        }
      })
      .catch(() => {});

    const rng = makeRng(SEED);
    const rr = (a: number, b: number) => a + rng() * (b - a);

    const game = {
      ball: { x: BALL_HOME.x, y: BALL_HOME.y, vx: 0, vy: 0, flying: false },
      target: null as Target | null,
      score: 0,
      misses: 0,
      over: false,
      spawnCount: 0,
      drag: null as null | { sx: number; sy: number; cx: number; cy: number },
      last: 0,
      time: 0,
    };

    // La dificultad sube con el puntaje: el blanco es más pequeño y más rápido.
    const spawn = (): Target => {
      const golden = game.spawnCount % 6 === 5; // 1 de cada 6 es dorado
      game.spawnCount += 1;
      const lvl = Math.floor(game.score / 8); // un nivel cada 8 puntos
      const baseSpeed = SPEED_BASE * Math.min(2.6, 1 + 0.1 * lvl);
      const baseR = Math.max(R_MIN, R_BASE - 1.4 * lvl);
      const speed = golden ? baseSpeed * 1.6 : baseSpeed;
      const r = golden ? Math.max(R_MIN - 2, baseR * 0.85) : baseR;
      const x = rr(GOAL.x0 + r, GOAL.x1 - r);
      const y = rr(GOAL.y0 + r, GOAL.y1 - r);
      const ang = rng() * Math.PI * 2;
      const imgIdx = Math.floor(rng() * 1000);
      return {
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        r,
        golden,
        points: golden ? 5 : 1,
        imgIdx,
      };
    };
    game.target = spawn();

    const resetBall = () => {
      game.ball = { x: BALL_HOME.x, y: BALL_HOME.y, vx: 0, vy: 0, flying: false };
    };

    // --- Sonido + vibración -------------------------------------------------
    const beep = (freq: number, dur: number, type: OscillatorType, vol: number, delay = 0) => {
      const actx = audioRef.current;
      if (!effectsRef.current || !actx) {
        return;
      }
      const t0 = actx.currentTime + delay;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    };
    const vibrate = (pattern: number | number[]) => {
      if (effectsRef.current && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    };
    const soundHit = (golden: boolean) => {
      if (golden) {
        beep(880, 0.1, 'triangle', 0.16);
        beep(1320, 0.14, 'triangle', 0.16, 0.08);
        vibrate([25, 30, 25]);
      } else {
        beep(660, 0.12, 'triangle', 0.15);
        vibrate(25);
      }
    };
    const soundMiss = () => {
      beep(160, 0.26, 'sawtooth', 0.12);
      vibrate([45, 40, 45]);
    };

    const endShotMiss = () => {
      resetBall();
      game.misses += 1;
      setMisses(game.misses);
      soundMiss();
      if (game.misses >= 3) {
        game.over = true;
        setPhase('over');
      }
    };

    // --- Dibujo -------------------------------------------------------------
    const drawBall = (cx: number, cy: number, R: number) => {
      if (ballImg.complete && ballImg.naturalWidth > 0) {
        ctx.drawImage(ballImg, cx - R, cy - R, R * 2, R * 2);
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1f2937';
        ctx.stroke();
      }
    };

    const drawTarget = (t: Target) => {
      const img = images.length ? images[t.imgIdx % images.length] : null;
      const pulse = t.golden ? 1 + 0.1 * Math.sin(game.time * 8) : 1;
      const r = t.r * pulse;
      if (t.golden) {
        ctx.save();
        ctx.shadowColor = 'rgba(255, 196, 0, 0.9)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r + 3, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffc400';
        ctx.stroke();
        ctx.restore();
      }
      if (img) {
        const d = r * 2;
        ctx.drawImage(img, t.x - r, t.y - r, d, d);
      } else {
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fillStyle = t.golden ? '#ffd43b' : '#e9ecef';
        ctx.fill();
      }
    };

    const draw = () => {
      drawField();
      if (game.target) {
        drawTarget(game.target);
      }
      if (game.drag) {
        const dx = game.drag.cx - game.drag.sx;
        const dy = game.drag.cy - game.drag.sy;
        if (Math.hypot(dx, dy) >= 10) {
          const vx = clamp(dx * 3.0, -820, 820);
          const vy = clamp(dy * 3.0, -1750, -280);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          let px = BALL_HOME.x;
          let py = BALL_HOME.y;
          let pvy = vy;
          for (let i = 0; i < 18; i++) {
            const step = 0.035;
            px += vx * step;
            pvy += GRAVITY * step;
            py += pvy * step;
            if (py < 0 || px < 0 || px > W || py > H) {
              break;
            }
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      drawBall(game.ball.x, game.ball.y, BALL_R);
    };

    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.04, game.last ? (t - game.last) / 1000 : 0);
      game.last = t;
      game.time += dt;

      if (!game.over && game.target) {
        const tg = game.target;
        tg.x += tg.vx * dt;
        tg.y += tg.vy * dt;
        if (tg.x < GOAL.x0 + tg.r) {
          tg.x = GOAL.x0 + tg.r;
          tg.vx = Math.abs(tg.vx);
        } else if (tg.x > GOAL.x1 - tg.r) {
          tg.x = GOAL.x1 - tg.r;
          tg.vx = -Math.abs(tg.vx);
        }
        if (tg.y < GOAL.y0 + tg.r) {
          tg.y = GOAL.y0 + tg.r;
          tg.vy = Math.abs(tg.vy);
        } else if (tg.y > GOAL.y1 - tg.r) {
          tg.y = GOAL.y1 - tg.r;
          tg.vy = -Math.abs(tg.vy);
        }

        if (game.ball.flying) {
          game.ball.vy += GRAVITY * dt;
          game.ball.x += game.ball.vx * dt;
          game.ball.y += game.ball.vy * dt;

          const ddx = tg.x - game.ball.x;
          const ddy = tg.y - game.ball.y;
          if (ddx * ddx + ddy * ddy < (tg.r + BALL_R) * (tg.r + BALL_R)) {
            game.score += tg.points;
            setScore(game.score);
            soundHit(tg.golden);
            game.target = spawn();
            resetBall();
          } else if (
            game.ball.y < -40 ||
            game.ball.x < -40 ||
            game.ball.x > W + 40 ||
            game.ball.y > H + 40
          ) {
            endShotMiss();
          }
        }
      }

      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // --- Entrada (flick) ----------------------------------------------------
    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) * W) / rect.width,
        y: ((e.clientY - rect.top) * H) / rect.height,
      };
    };
    const ensureAudio = () => {
      try {
        if (!audioRef.current) {
          const Ctx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioRef.current = new Ctx();
        }
        if (audioRef.current.state === 'suspended') {
          void audioRef.current.resume();
        }
      } catch {
        // Sin audio.
      }
    };
    const onDown = (e: PointerEvent) => {
      if (game.over || game.ball.flying) {
        return;
      }
      ensureAudio();
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
      game.ball.vx = clamp(dx * 3.0, -820, 820);
      game.ball.vy = clamp(dy * 3.0, -1750, -280);
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

  const start = () => {
    setScore(0);
    setMisses(0);
    setPhase('playing');
    setRunId((r) => r + 1);
  };

  const toggleEffects = () => {
    setEffectsOn((v) => {
      effectsRef.current = !v;
      return !v;
    });
  };

  const topScore = highscores[0];

  const board = (
    <ol className="fg-board">
      {highscores.slice(0, 5).map((h) => (
        <li key={h.participant_id} className={h.participant_id === participantId ? 'fg-board-me' : ''}>
          <span className="fg-board-name">{h.name}</span>
          <span className="fg-board-pts">{h.score}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pg" role="dialog" aria-label="Tiro al arco" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎯 Tiro al arco</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {phase !== 'start' && (
          <>
            <div className="pg-score">
              <span>⭐ <strong>{score}</strong></span>
              <span>❌ {misses}/3</span>
              <button type="button" className="fg-mute" onClick={toggleEffects} title="Sonido y vibración">
                {effectsOn ? '🔊' : '🔇'}
              </button>
            </div>
            {topScore && (
              <p className="muted hint fg-record">
                🏆 Récord de todos: <strong>{topScore.name}</strong> con {topScore.score}
              </p>
            )}
          </>
        )}

        <div className="fg-wrap">
          <canvas ref={canvasRef} className="fg-canvas" />

          {phase === 'start' && (
            <div className="fg-over">
              <div className="fg-over-card">
                <div className="fg-over-title">🏆 Mejores del grupo</div>
                {highscores.length > 0 ? (
                  board
                ) : (
                  <p className="muted hint">Aún nadie ha jugado. ¡Sé el primero!</p>
                )}
                <button className="btn btn-primary" onClick={start}>▶ Comenzar</button>
              </div>
            </div>
          )}

          {phase === 'over' && (
            <div className="fg-over">
              <div className="fg-over-card">
                <div className="fg-over-title">¡Fin del juego!</div>
                <div className="fg-over-score">{score} puntos</div>
                {!participantId && (
                  <p className="muted hint">Entra como participante para aparecer en la tabla.</p>
                )}
                {highscores.length > 0 && board}
                <button className="btn btn-primary" onClick={start}>Jugar de nuevo</button>
              </div>
            </div>
          )}
        </div>

        <p className="muted hint pg-hint">
          Desliza con el dedo para lanzar el balón en esa dirección. Aparece <strong>un</strong> blanco a
          la vez: cada acierto vale 1 (el dorado ✨ vale 5). Mientras más puntos, más pequeño y rápido. ¡3
          fallos y se acaba!
        </p>
      </div>
    </div>
  );
}
