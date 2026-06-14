interface Props {
  count: number;
  total: number;
}

export function PredictionRing({ count, total }: Props) {
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.min(count / total, 1) : 0;
  return (
    <span className="ring-wrap" title={`${count} de ${total} ya predijeron`}>
      <svg className="ring" viewBox="0 0 28 28" role="img" aria-label={`${count} de ${total} predicciones`}>
        <circle cx="14" cy="14" r={radius} className="ring-bg" />
        <circle
          cx="14"
          cy="14"
          r={radius}
          className="ring-fill"
          strokeDasharray={`${circumference * fraction} ${circumference}`}
          transform="rotate(-90 14 14)"
        />
        <text x="14" y="17" textAnchor="middle" className="ring-text">
          {count}/{total}
        </text>
      </svg>
    </span>
  );
}
