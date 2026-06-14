import { useEffect, useState } from 'react';
import type { Match, Prediction, StandingRow } from '../../shared/types';
import { api } from '../api';
import { formatKickoff } from '../format';
import { TeamLabel } from './TeamLabel';

interface Props {
  participantId: number;
  name: string;
  onClose: () => void;
}

interface Step {
  match: Match;
  prediction: Prediction;
  gained: number;
  total: number;
}

export function ParticipantProgressModal({ participantId, name, onClose }: Props) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [handicap, setHandicap] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getPredictions(participantId), api.getMatches(), api.getStandings()])
      .then(([predictions, matches, standings]) => {
        const matchById = new Map(matches.map((m) => [m.id, m]));
        const row = standings.find((s: StandingRow) => s.participant_id === participantId);
        const h = row?.handicap ?? 0;
        setHandicap(h);
        setFinalTotal(row?.points ?? h);

        // Solo partidos finalizados (tienen puntos), en orden cronológico.
        const scored = predictions
          .filter((p) => p.points !== null && matchById.has(p.match_id))
          .map((p) => ({ p, m: matchById.get(p.match_id) as Match }))
          .sort((a, b) => a.m.kickoff.localeCompare(b.m.kickoff));

        let running = h;
        const built: Step[] = scored.map(({ p, m }) => {
          running += p.points ?? 0;
          return { match: m, prediction: p, gained: p.points ?? 0, total: running };
        });
        setSteps(built);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [participantId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={`Avance de ${name}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📊 {name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {loading && <p className="muted">Cargando…</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && (
          <>
            <p className="muted hint">
              Total actual: <strong>{finalTotal} pts</strong>
              {handicap !== 0 && ` (arrancó con ${handicap > 0 ? '+' : ''}${handicap} de handicap)`}.
            </p>

            <ol className="progress-list">
              <li className="progress-step start">
                <span className="progress-when">Inicio</span>
                <span className="progress-detail">{handicap !== 0 ? `Handicap ${handicap > 0 ? '+' : ''}${handicap}` : 'Sin handicap'}</span>
                <span className="progress-total">{handicap}</span>
              </li>
              {steps.map((step) => (
                <li key={step.match.id} className="progress-step">
                  <span className="progress-when">
                    <TeamLabel name={step.match.home_team} side="home" />
                    <span className="muted"> {step.match.home_score}-{step.match.away_score} </span>
                    <TeamLabel name={step.match.away_team} side="away" />
                    <span className="progress-date">{formatKickoff(step.match.kickoff)}</span>
                  </span>
                  <span className="progress-detail">
                    Tu predicción: {step.prediction.home_goals}-{step.prediction.away_goals}{' '}
                    <span className={`points points-${step.gained}`}>+{step.gained}</span>
                  </span>
                  <span className="progress-total">{step.total}</span>
                </li>
              ))}
            </ol>

            {steps.length === 0 && (
              <p className="muted">Aún no hay partidos finalizados con su predicción.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
