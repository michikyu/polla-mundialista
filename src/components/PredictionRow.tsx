import { useEffect, useState, type FormEvent } from 'react';
import type { Match, Prediction } from '../../shared/types';
import { adminCanEditPredictions } from '../../shared/time';
import { api } from '../api';
import { formatTime, formatTimestamp, STATUS_ICONS, STATUS_LABELS } from '../format';
import { TeamLabel } from './TeamLabel';

interface Props {
  match: Match;
  participantId: number;
  prediction: Prediction | null;
  onSaved: () => void;
  canCreate: boolean;
  isAdmin: boolean;
}

export function PredictionRow({ match, participantId, prediction, onSaved, canCreate, isAdmin }: Props) {
  const [homeGoals, setHomeGoals] = useState('');
  const [awayGoals, setAwayGoals] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setHomeGoals(prediction?.home_goals?.toString() ?? '');
    setAwayGoals(prediction?.away_goals?.toString() ?? '');
    setEditing(false);
    setError('');
  }, [prediction, participantId]);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAdmin && !window.confirm(`¿Confirmas ${homeGoals} - ${awayGoals}? La predicción se registra UNA sola vez y no se puede cambiar.`)) {
      return;
    }
    setError('');
    try {
      await api.savePrediction({
        participant_id: participantId,
        match_id: match.id,
        home_goals: Number(homeGoals),
        away_goals: Number(awayGoals),
      });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const isOpen = match.status === 'pendiente';
  const isFinished = match.status === 'finalizado';
  // El admin puede corregir hasta 24 h después del inicio; el participante, solo antes del inicio.
  const canAdminEdit = isAdmin && adminCanEditPredictions(match.kickoff);
  // Un solo intento: el dueño solo puede crear; el administrador puede corregir.
  const showInputs =
    (canAdminEdit && (editing || prediction === null)) ||
    (!isAdmin && isOpen && canCreate && prediction === null);
  const goalsHidden = prediction !== null && prediction.home_goals === null;

  return (
    <div className="m-item">
      <div className="m-row static">
        <span className="status-ico" title={STATUS_LABELS[match.status]}>
          {STATUS_ICONS[match.status]}
        </span>
        <div className="m-main">
          <div className="m-teams">
            <TeamLabel name={match.home_team} side="home" />
            {isFinished ? (
              <span className="score">{match.home_score} - {match.away_score}</span>
            ) : (
              <span className="vs">vs</span>
            )}
            <TeamLabel name={match.away_team} side="away" />
          </div>
          <div className="m-sub">
            {formatTime(match.kickoff)}
            {match.venue ? ` · ${match.venue}` : ''}
          </div>
        </div>

        {showInputs ? (
          <form className="pred-inline" onSubmit={handleSave}>
            <input
              type="number"
              min={0}
              max={99}
              value={homeGoals}
              onChange={(e) => setHomeGoals(e.target.value)}
              required
              aria-label={`Goles de ${match.home_team}`}
            />
            <span>-</span>
            <input
              type="number"
              min={0}
              max={99}
              value={awayGoals}
              onChange={(e) => setAwayGoals(e.target.value)}
              required
              aria-label={`Goles de ${match.away_team}`}
            />
            <button type="submit" className="btn btn-primary btn-save" title="Guardar predicción (una sola vez)">
              OK
            </button>
            {isAdmin && prediction !== null && (
              <button
                type="button"
                className="btn btn-save"
                title="Cancelar"
                onClick={() => {
                  setEditing(false);
                  setHomeGoals(prediction.home_goals?.toString() ?? '');
                  setAwayGoals(prediction.away_goals?.toString() ?? '');
                }}
              >
                ✕
              </button>
            )}
          </form>
        ) : (
          <div className="pred-locked">
            {prediction ? (
              goalsHidden ? (
                <span className="pred-value-wrap">
                  <span className="pred-secret" title="Se revela cuando empiece el partido">✔️ Puesta 🤫</span>
                  {prediction.updated_at && <span className="pred-time">{formatTimestamp(prediction.updated_at)}</span>}
                </span>
              ) : (
                <span className="pred-value-wrap">
                  <span className="pred-value">{prediction.home_goals} - {prediction.away_goals}</span>
                  {prediction.updated_at && (
                    <span className="pred-time" title="Cuándo se registró esta predicción">
                      {formatTimestamp(prediction.updated_at)}
                    </span>
                  )}
                </span>
              )
            ) : (
              <span className="muted">{isOpen ? 'Sin predicción' : '—'}</span>
            )}
            {prediction?.points !== null && prediction?.points !== undefined && (
              <span className={`points points-${prediction.points}`}>{prediction.points}</span>
            )}
            {canAdminEdit && prediction !== null && (
              <button
                className="btn-icon"
                title="Corregir predicción (admin, hasta 24 h tras el inicio)"
                onClick={() => setEditing(true)}
              >
                ✏️
              </button>
            )}
            {!isAdmin && isOpen && prediction !== null && !goalsHidden && (
              <span title="Registrada: no se puede cambiar">🔏</span>
            )}
          </div>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
