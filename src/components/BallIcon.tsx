// Balón Trionda (Mundial 2026) en versión vectorial: paneles azul, rojo y verde
// con patrón interno y cintas azul marino, sobre base blanca — fiel al balón
// oficial pero sin logos registrados, nítido a cualquier tamaño.
export function BallIcon({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="ball-icon"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Balón del Mundial 2026"
    >
      <defs>
        <clipPath id="ball-clip">
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#ffffff" />
      <g clipPath="url(#ball-clip)">
        {/* Panel azul (arriba), rojo (abajo izquierda) y verde (abajo derecha) */}
        <g>
          <path d="M50 4 C 63 4, 75 12, 78 26 C 70 37, 59 42, 50 40 C 41 42, 30 37, 22 26 C 25 12, 37 4, 50 4 Z" fill="#1c7ed6" />
          <path d="M33 12 C 43 8, 57 8, 67 12" stroke="#1255a3" strokeWidth="2.4" fill="none" />
          <path d="M27 20 C 40 14, 60 14, 73 20" stroke="#1255a3" strokeWidth="2.4" fill="none" />
          <rect x="46.6" y="26" width="6.8" height="6.8" fill="#ffffff" transform="rotate(45 50 29.4)" />
        </g>
        <g transform="rotate(120 50 50)">
          <path d="M50 4 C 63 4, 75 12, 78 26 C 70 37, 59 42, 50 40 C 41 42, 30 37, 22 26 C 25 12, 37 4, 50 4 Z" fill="#d6336c" />
          <path d="M33 12 C 43 8, 57 8, 67 12" stroke="#9c1c43" strokeWidth="2.4" fill="none" />
          <path d="M27 20 C 40 14, 60 14, 73 20" stroke="#9c1c43" strokeWidth="2.4" fill="none" />
        </g>
        <g transform="rotate(240 50 50)">
          <path d="M50 4 C 63 4, 75 12, 78 26 C 70 37, 59 42, 50 40 C 41 42, 30 37, 22 26 C 25 12, 37 4, 50 4 Z" fill="#2f9e44" />
          <path d="M33 12 C 43 8, 57 8, 67 12" stroke="#1d6b2e" strokeWidth="2.4" fill="none" />
          <path d="M27 20 C 40 14, 60 14, 73 20" stroke="#1d6b2e" strokeWidth="2.4" fill="none" />
        </g>
        {/* Cintas azul marino que recorren el balón entre paneles */}
        <g stroke="#16265c" strokeWidth="4.5" fill="none" strokeLinecap="round">
          <path d="M79 25 C 90 40, 90 58, 78 70" />
          <path d="M79 25 C 90 40, 90 58, 78 70" transform="rotate(120 50 50)" />
          <path d="M79 25 C 90 40, 90 58, 78 70" transform="rotate(240 50 50)" />
        </g>
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke="#334155" strokeWidth="2.5" />
    </svg>
  );
}
