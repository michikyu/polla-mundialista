interface Props {
  count: number;
  total: number;
}

export function PredictionRing({ count, total }: Props) {
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.min(count / total, 1) : 0;
  // Dentro del círculo solo va el número de quienes ya predijeron.
  const label = `${count}`;
  const fontSize = label.length <= 2 ? 11 : 9;
  const complete = total > 0 && count >= total;
  return (
    <span
      className="ring-wrap"
      title={complete ? '¡Todos ya predijeron! 🎉' : `${count} de ${total} ya predijeron`}
    >
      <svg
        className={complete ? 'ring complete' : 'ring'}
        viewBox="0 0 28 28"
        role="img"
        aria-label={`${count} de ${total} predicciones`}
      >
        <circle cx="14" cy="14" r={radius} className="ring-bg" />
        <circle
          cx="14"
          cy="14"
          r={radius}
          className="ring-fill"
          strokeDasharray={`${circumference * fraction} ${circumference}`}
          transform="rotate(-90 14 14)"
        />
        <text x="14" y="14" textAnchor="middle" dominantBaseline="central" className="ring-text" style={{ fontSize }}>
          {label}
        </text>
      </svg>
    </span>
  );
}
