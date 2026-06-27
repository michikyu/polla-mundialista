import { useEffect, useState } from 'react';
import type { Match, StandingRow } from '../../shared/types';
import { api } from '../api';
import { formatKickoff, STATUS_ICONS, STATUS_LABELS } from '../format';
import { TeamLabel } from '../components/TeamLabel';
import { PredictionRing } from '../components/PredictionRing';
import { KnockoutBracket } from '../components/KnockoutBracket';
import { GameLeaderboard } from '../components/GameLeaderboard';

const MEDALS = ['🥇', '🥈', '🥉'];
const TOP_COUNT = 3;

interface Props {
  onOpenMatch: (id: number) => void;
  onOpenParticipant: (id: number) => void;
  viewerParticipantId: number | null;
}

export function DashboardView({ onOpenMatch, onOpenParticipant, viewerParticipantId }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [predictedIds, setPredictedIds] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getMatches(), api.getStandings()])
      .then(([matchRows, standingRows]) => {
        setMatches(matchRows);
        setStandings(standingRows);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  // Para avisarle al usuario con sesión qué partidos abiertos le faltan por predecir.
  useEffect(() => {
    if (viewerParticipantId === null) {
      setPredictedIds(new Set());
      return;
    }
    api
      .getPredictions(viewerParticipantId)
      .then((preds) => setPredictedIds(new Set(preds.map((p) => p.match_id))))
      .catch(() => {});
  }, [viewerParticipantId]);

  const missingPrediction = (match: Match) =>
    viewerParticipantId !== null && match.status === 'pendiente' && !predictedIds.has(match.id);

  const totalParticipants = standings.length;
  const visibleStandings = showAll ? standings : standings.slice(0, TOP_COUNT);
  // Cuando todos los partidos de grupos ya se jugaron, Inicio muestra el cuadro de
  // eliminatorias en vez de "Próximos partidos".
  const groupMatches = matches.filter((m) => m.stage === 'grupos');
  const groupStageDone = groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finalizado');
  const upcoming = matches.filter((m) => m.status !== 'finalizado').slice(0, 5);
  const finished = matches
    .filter((m) => m.status === 'finalizado')
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 5);

  return (
    <div className="stack">
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>🏆 Punteros</h2>
        {standings.length === 0 ? (
          <p className="muted">Aún no hay participantes.</p>
        ) : (
          <>
            <ol className="podium">
              {visibleStandings.map((row, index) => (
                <li
                  key={row.participant_id}
                  className="podium-row"
                  onClick={() => onOpenParticipant(row.participant_id)}
                  title={`Ver las predicciones de ${row.name}`}
                >
                  <span className="podium-medal">{MEDALS[index] ?? `${index + 1}.`}</span>
                  <span className="podium-name">{row.name}</span>
                  <span className="podium-points">{row.points} pts</span>
                </li>
              ))}
            </ol>
            {standings.length > TOP_COUNT && (
              <button className="btn show-all-btn" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Ver menos ▲' : `Ver todos (${standings.length}) ▼`}
              </button>
            )}
          </>
        )}
        <p className="muted hint">Toca un nombre para ver sus predicciones y resultados.</p>
      </section>

      {groupStageDone && (
        <section className="card">
          <h2>🏆 Eliminatorias</h2>
          <KnockoutBracket matches={matches} onOpenMatch={onOpenMatch} pendingOnly mode="tree" />
        </section>
      )}

      {!groupStageDone && (
      <section className="card day-card">
        <h2>📅 Próximos partidos</h2>
        {upcoming.length === 0 ? (
          <p className="muted">No hay partidos pendientes. Créalos en la pestaña Partidos.</p>
        ) : (
          upcoming.map((match) => (
            <div key={match.id} className="m-item">
              <div className="m-row" onClick={() => onOpenMatch(match.id)}>
                <span className="status-ico" title={STATUS_LABELS[match.status]}>
                  {STATUS_ICONS[match.status]}
                </span>
                <div className="m-main">
                  <div className="m-teams">
                    <TeamLabel name={match.home_team} side="home" />
                    <span className="vs">vs</span>
                    <TeamLabel name={match.away_team} side="away" />
                  </div>
                  <div className="m-sub">
                    {formatKickoff(match.kickoff)}
                    {match.venue ? ` · ${match.venue}` : ''}
                  </div>
                  {missingPrediction(match) && (
                    <span className="missing-pred">⚠️ Te falta tu predicción</span>
                  )}
                </div>
                <PredictionRing count={match.predictions_count ?? 0} total={totalParticipants} />
              </div>
            </div>
          ))
        )}
      </section>
      )}

      <section className="card day-card">
        <h2>✅ Últimos resultados</h2>
        {finished.length === 0 ? (
          <p className="muted">Todavía no hay partidos finalizados.</p>
        ) : (
          finished.map((match) => (
            <div key={match.id} className="m-item">
              <div className="m-row" onClick={() => onOpenMatch(match.id)}>
                <span className="status-ico" title="Finalizado">✅</span>
                <div className="m-main">
                  <div className="m-teams">
                    <TeamLabel name={match.home_team} side="home" />
                    <span className="score">{match.home_score} - {match.away_score}</span>
                    <TeamLabel name={match.away_team} side="away" />
                  </div>
                  <div className="m-sub">{formatKickoff(match.kickoff)}</div>
                </div>
                <PredictionRing count={match.predictions_count ?? 0} total={totalParticipants} />
              </div>
            </div>
          ))
        )}
      </section>

      <GameLeaderboard />

      <p className="muted hint">Toca cualquier partido para ver las predicciones de todos.</p>
    </div>
  );
}
