import { useState, type FormEvent, type MouseEvent } from 'react';
import type { Match, MatchStage } from '../../shared/types';
import { STAGE_LABELS, STAGE_ORDER } from '../../shared/types';
import { api } from '../api';
import { formatTime, scoreLine, STATUS_ICONS, STATUS_LABELS } from '../format';
import { TeamLabel } from './TeamLabel';
import { PredictionRing } from './PredictionRing';

type Mode = 'view' | 'edit' | 'result';

interface Props {
  match: Match;
  onChanged: () => void;
  onOpenMatch: (id: number) => void;
  isAdmin: boolean;
  totalParticipants: number;
  missingPrediction?: boolean;
}

export function MatchAdminRow({
  match,
  onChanged,
  onOpenMatch,
  isAdmin,
  totalParticipants,
  missingPrediction,
}: Props) {
  const [mode, setMode] = useState<Mode>('view');
  const [menuOpen, setMenuOpen] = useState(false);
  const [homeTeam, setHomeTeam] = useState(match.home_team);
  const [awayTeam, setAwayTeam] = useState(match.away_team);
  const [kickoff, setKickoff] = useState(match.kickoff);
  const [venue, setVenue] = useState(match.venue ?? '');
  const [stage, setStage] = useState<MatchStage>(match.stage);
  const [homeScore, setHomeScore] = useState(match.home_score?.toString() ?? '');
  const [awayScore, setAwayScore] = useState(match.away_score?.toString() ?? '');
  const [homePens, setHomePens] = useState(match.home_penalties?.toString() ?? '');
  const [awayPens, setAwayPens] = useState(match.away_penalties?.toString() ?? '');
  const [error, setError] = useState('');

  // Penaltis: solo en eliminatoria y cuando el marcador quedó empatado.
  const tieEntered = homeScore !== '' && homeScore === awayScore;
  const showPenaltyInputs = match.stage !== 'grupos' && tieEntered;

  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
      setMode('view');
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (event: FormEvent) => {
    event.preventDefault();
    void run(() => api.updateMatch(match.id, { home_team: homeTeam, away_team: awayTeam, kickoff, venue, stage }));
  };

  const handleResult = (event: FormEvent) => {
    event.preventDefault();
    const hp = showPenaltyInputs && homePens !== '' ? Number(homePens) : null;
    const ap = showPenaltyInputs && awayPens !== '' ? Number(awayPens) : null;
    void run(() => api.registerResult(match.id, Number(homeScore), Number(awayScore), hp, ap));
  };

  const pickAction = (event: MouseEvent, action: () => void) => {
    event.stopPropagation();
    setMenuOpen(false);
    action();
  };

  const handleDelete = () => {
    if (window.confirm(`¿Eliminar ${match.home_team} vs ${match.away_team}? Se borrarán sus predicciones.`)) {
      void run(() => api.deleteMatch(match.id));
    }
  };

  const handleReopen = () => {
    if (window.confirm('Se borrará el resultado y el partido volverá a estar abierto. ¿Continuar?')) {
      void run(() => api.reopenMatch(match.id));
    }
  };

  return (
    <div className="m-item">
      <div className="m-row" onClick={() => onOpenMatch(match.id)}>
        <span className="status-ico" title={STATUS_LABELS[match.status]}>
          {STATUS_ICONS[match.status]}
        </span>
        <div className="m-main">
          <div className="m-teams">
            <TeamLabel name={match.home_team} side="home" />
            {match.status === 'finalizado' ? (
              <span className="score">{scoreLine(match)}</span>
            ) : (
              <span className="vs">vs</span>
            )}
            <TeamLabel name={match.away_team} side="away" />
          </div>
          <div className="m-sub">
            {formatTime(match.kickoff)}
            {match.venue ? ` · ${match.venue}` : ''}
            {match.stage !== 'grupos' ? ` · ${STAGE_LABELS[match.stage]}` : ''}
          </div>
          {missingPrediction && <span className="missing-pred">⚠️ Te falta tu predicción</span>}
        </div>
        <PredictionRing count={match.predictions_count ?? 0} total={totalParticipants} />
        {isAdmin && (
          <button
            className="kebab"
            aria-label="Opciones del partido"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            ⋮
          </button>
        )}
        {isAdmin && menuOpen && (
          <>
            <div className="menu-backdrop" onClick={(event) => { event.stopPropagation(); setMenuOpen(false); }} />
            <div className="menu" onClick={(event) => event.stopPropagation()}>
              <button onClick={(event) => pickAction(event, () => setMode('edit'))}>✏️ Editar</button>
              <button onClick={(event) => pickAction(event, () => setMode('result'))}>
                {match.status === 'finalizado' ? '🔁 Editar resultado' : '⚽ Registrar resultado'}
              </button>
              {match.status === 'finalizado' && (
                <button onClick={(event) => pickAction(event, handleReopen)}>🔓 Reabrir</button>
              )}
              <button className="menu-danger" onClick={(event) => pickAction(event, handleDelete)}>
                🗑️ Eliminar
              </button>
            </div>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {mode === 'edit' && (
        <form className="match-form" onSubmit={handleEdit}>
          <label>
            Equipo local
            <input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} required />
          </label>
          <label>
            Equipo visitante
            <input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} required />
          </label>
          <label>
            Fecha y hora (hora de Colombia)
            <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} required />
          </label>
          <label>
            Lugar (estadio, ciudad)
            <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Opcional" />
          </label>
          <label>
            Fase
            <select value={stage} onChange={(e) => setStage(e.target.value as MatchStage)}>
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary">Guardar cambios</button>
            <button type="button" className="btn" onClick={() => setMode('view')}>Cancelar</button>
          </div>
        </form>
      )}

      {mode === 'result' && (
        <form className="result-form" onSubmit={handleResult}>
          <span>{match.home_team}</span>
          <input
            type="number"
            min={0}
            max={99}
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            required
          />
          <span>-</span>
          <input
            type="number"
            min={0}
            max={99}
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            required
          />
          <span>{match.away_team}</span>
          {showPenaltyInputs && (
            <div className="penalty-row">
              <span className="penalty-label">🥅 Penaltis (si hubo tanda):</span>
              <input
                type="number"
                min={0}
                max={99}
                value={homePens}
                onChange={(e) => setHomePens(e.target.value)}
                placeholder="0"
                aria-label={`Penaltis ${match.home_team}`}
              />
              <span>-</span>
              <input
                type="number"
                min={0}
                max={99}
                value={awayPens}
                onChange={(e) => setAwayPens(e.target.value)}
                placeholder="0"
                aria-label={`Penaltis ${match.away_team}`}
              />
            </div>
          )}
          <div className="row-actions">
            <button type="submit" className="btn btn-primary">Guardar resultado</button>
            <button type="button" className="btn" onClick={() => setMode('view')}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
