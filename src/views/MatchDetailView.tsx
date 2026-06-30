import { useCallback, useEffect, useState } from 'react';
import type { MatchDetail } from '../../shared/types';
import { api } from '../api';
import { formatKickoff, formatTimestamp, pointsLabel, scoreLine } from '../format';
import { StatusBadge } from '../components/StatusBadge';
import { TeamLabel } from '../components/TeamLabel';

interface Props {
  matchId: number;
  onBack: () => void;
  viewerParticipantId: number | null;
}

export function MatchDetailView({ matchId, onBack, viewerParticipantId }: Props) {
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [homeGoals, setHomeGoals] = useState('');
  const [awayGoals, setAwayGoals] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.getMatchDetail(matchId).then(setDetail).catch((err: Error) => setError(err.message));
  }, [matchId]);

  useEffect(load, [load]);

  const handleAdd = async () => {
    if (viewerParticipantId === null) {
      return;
    }
    if (!window.confirm(`¿Confirmas ${homeGoals} - ${awayGoals}? La predicción se registra una sola vez.`)) {
      return;
    }
    setError('');
    try {
      await api.savePrediction({
        participant_id: viewerParticipantId,
        match_id: matchId,
        home_goals: Number(homeGoals),
        away_goals: Number(awayGoals),
      });
      setHomeGoals('');
      setAwayGoals('');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (error) {
    return (
      <div className="stack">
        <p className="error">{error}</p>
        <button className="btn" onClick={onBack}>← Volver</button>
      </div>
    );
  }
  if (!detail) {
    return <p className="muted">Cargando…</p>;
  }

  const { match, predictions } = detail;
  const isFinished = match.status === 'finalizado';
  const viewerRow = predictions.find((p) => p.participant_id === viewerParticipantId);
  const canAddOwn = match.status === 'pendiente' && viewerParticipantId !== null && viewerRow && !viewerRow.has_prediction;

  return (
    <div className="stack">
      <button className="btn back-btn" onClick={onBack}>← Volver</button>

      <section className="card">
        <div className="match-card-top">
          <div>
            <div className="match-teams big">
              <TeamLabel name={match.home_team} side="home" full />
              {isFinished ? (
                <span className="score">{scoreLine(match)}</span>
              ) : (
                <span className="vs">vs</span>
              )}
              <TeamLabel name={match.away_team} side="away" full />
            </div>
            <span className="muted">
              {formatKickoff(match.kickoff)}
              {match.venue ? ` · ${match.venue}` : ''}
            </span>
          </div>
          <StatusBadge status={match.status} />
        </div>
      </section>

      {canAddOwn && (
        <section className="card">
          <h2>📝 Tu predicción</h2>
          <p className="muted hint">Aún no la has puesto. Va una sola vez y no se puede cambiar.</p>
          <div className="add-pred-form">
            <TeamLabel name={match.home_team} side="home" />
            <input
              type="number"
              min={0}
              max={99}
              value={homeGoals}
              onChange={(e) => setHomeGoals(e.target.value)}
              aria-label={`Goles de ${match.home_team}`}
            />
            <span>-</span>
            <input
              type="number"
              min={0}
              max={99}
              value={awayGoals}
              onChange={(e) => setAwayGoals(e.target.value)}
              aria-label={`Goles de ${match.away_team}`}
            />
            <TeamLabel name={match.away_team} side="away" />
            <button
              className="btn btn-primary"
              disabled={homeGoals === '' || awayGoals === ''}
              onClick={() => void handleAdd()}
            >
              Guardar
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Predicciones de todos</h2>
        {match.status === 'pendiente' && (
          <p className="muted hint">
            🤫 Los marcadores son secretos hasta que empiece el partido; por ahora solo se ve quién ya puso su
            predicción.
          </p>
        )}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="left">Participante</th>
                <th>Predicción</th>
                <th>Puntos</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((row) => (
                <tr key={row.participant_id}>
                  <td className="left">{row.participant_name}</td>
                  <td>
                    {row.home_goals !== null && row.away_goals !== null ? (
                      <span className="pred-value-wrap centered">
                        <span>{row.home_goals} - {row.away_goals}</span>
                        {row.predicted_at && (
                          <span className="pred-time" title="Cuándo se registró esta predicción">
                            {formatTimestamp(row.predicted_at)}
                          </span>
                        )}
                      </span>
                    ) : row.has_prediction ? (
                      <span className="pred-value-wrap centered">
                        <span title="Se revela cuando empiece el partido">✔️ 🤫</span>
                        {row.predicted_at && (
                          <span className="pred-time">{formatTimestamp(row.predicted_at)}</span>
                        )}
                      </span>
                    ) : (
                      'Sin predicción'
                    )}
                  </td>
                  <td>
                    {row.points !== null ? (
                      <span className={`points points-${row.points}`}>{pointsLabel(row.points)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
