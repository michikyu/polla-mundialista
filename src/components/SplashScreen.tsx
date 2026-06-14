import { useEffect } from 'react';
import { BallIcon } from './BallIcon';
import { playSplashSound } from '../splashSound';

const SPLASH_DURATION_MS = 2600;

const CONFETTI = ['🎉', '🏆', '🇨🇴', '⭐', '🎊', '🥅', '🔥', '🎺'];

// Pantalla de entrada estilo "zumbido de MSN": el balón entra rebotando,
// el título golpea con rebote elástico y cae confeti; luego todo se desvanece.
export function SplashScreen({ title, onDone }: { title: string; onDone: () => void }) {
  useEffect(() => {
    playSplashSound();
    const timer = setTimeout(onDone, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="splash" onClick={onDone} title="Toca para saltar">
      {CONFETTI.map((emoji, index) => (
        <span
          key={index}
          className="splash-confetti"
          style={{
            left: `${8 + index * 11.5}%`,
            animationDelay: `${0.9 + (index % 4) * 0.18}s`,
          }}
        >
          {emoji}
        </span>
      ))}
      <div className="splash-ball">
        <BallIcon size={96} />
      </div>
      <h1 className="splash-title">{title}</h1>
      <p className="splash-sub">🏆 ¡Que gane el mejor! 🏆</p>
    </div>
  );
}
