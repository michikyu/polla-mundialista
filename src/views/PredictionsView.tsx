import { useCallback, useEffect, useState } from 'react';
import type { Match, MatchStage, Participant, Prediction } from '../../shared/types';
import { STAGE_LABELS, STAGE_ORDER } from '../../shared/types';
import { KNOCKOUT_BRACKET } from '../../shared/bracket';
import { api } from '../api';
import { formatDayLabel, formatKickoff, groupByDay } from '../format';
import { PredictionRow } from '../components/PredictionRow';

interface Props {
  isAdmin: boolean;
  participantId: number | null;
  onSelectParticipant: (id: number | null) => void;
  unlockedId: number | null;
  onRequestLogin: () => void;
}

export function PredictionsView({
  isAdmin,
  participantId,
  onSelectParticipant,
  unlockedId,
  onRequestLogin,
}: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [stageFilter, setStageFilter] = useState<'todos' | MatchStage>('todos');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getParticipants(), api.getMatches()])
      .then(([participantRows, matchRows]) => {
        setParticipants(participantRows);
        setMatches(matchRows);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const loadPredictions = useCallback(() => {
    if (participantId === null) {
      setPredictions([]);
      return;
    }
    api.getPredictions(participantId).then(setPredictions).catch((err: Error) => setError(err.message));
  }, [participantId]);

  useEffect(loadPredictions, [loadPredictions]);

  const selected = participants.find((p) => p.id === participantId) ?? null;
  const canEdit = isAdmin || (selected !== null && unlockedId === selected.id);
  // Invitado: ni admin ni participante con sesión.
  const isGuest = !isAdmin && unlockedId === null;

  // Por defecto solo se ven los partidos que aún NO empezaron (predecibles).
  // Los que ya arrancaron o terminaron van en el colapsable de "pasados".
  const byStage = stageFilter === 'todos' ? matches : matches.filter((m) => m.stage === stageFilter);
  const currentDays = groupByDay(byStage.filter((m) => m.status === 'pendiente'));
  const pastMatches = byStage.filter((m) => m.status !== 'pendiente');
  const pastDays = groupByDay(pastMatches);
  const pastMatchCount = pastMatches.length;

  // Eliminatorias aún sin equipos: se muestran bloqueadas (con fecha y cruce), no predecibles.
  const knockoutStages = STAGE_ORDER.filter((s) => s !== 'grupos');
  const lockedStages = knockoutStages.filter(
    (s) =>
      (stageFilter === 'todos' || stageFilter === s) && !matches.some((m) => m.stage === s),
  );

  const renderDay = (group: { day: string; items: Match[] }) => (
    <section key={group.day} className="card day-card">
      <h3 className="day-title">{formatDayLabel(group.items[0].kickoff)}</h3>
      {group.items.map((match) => (
        <PredictionRow
          key={match.id}
          match={match}
          participantId={(selected as Participant).id}
          prediction={predictions.find((p) => p.match_id === match.id) ?? null}
          onSaved={loadPredictions}
          canCreate={canEdit}
          isAdmin={isAdmin}
        />
      ))}
    </section>
  );

  return (
    <div className="stack">
      <section className="card">
        <h2>📝 {isAdmin ? 'Predicciones' : 'Mis predicciones'}</h2>
        {error && <p className="error">{error}</p>}

        {isGuest ? (
          <>
            <p className="muted">Entra con tu nombre y contraseña para ver y registrar tus predicciones.</p>
            <button className="btn btn-primary unlock-btn" onClick={onRequestLogin}>🔑 Entrar</button>
          </>
        ) : isAdmin ? (
          <label className="select-label">
            Ver / editar predicciones de:
            <select
              value={selected ? String(selected.id) : ''}
              onChange={(e) => onSelectParticipant(Number(e.target.value) > 0 ? Number(e.target.value) : null)}
            >
              <option value="">Elige un participante…</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted hint">
            Registrando como <strong>{selected?.name}</strong>. Cada predicción va <strong>una sola vez</strong>;
            las de los demás son secretas 🤫 hasta que empiece el partido. Reglas completas en 📜 arriba.
          </p>
        )}

        {selected && (
          <label className="select-label stage-filter">
            Filtrar por fase
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as 'todos' | MatchStage)}>
              <option value="todos">Todas las fases</option>
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          </label>
        )}
      </section>

      {selected && pastDays.length > 0 && (
        <>
          <button className="btn show-all-btn past-toggle" onClick={() => setShowPast(!showPast)}>
            {showPast
              ? 'Ocultar partidos pasados ▲'
              : `🗂️ Ver partidos pasados (${pastMatchCount}) ▼`}
          </button>
          {showPast && pastDays.map(renderDay)}
        </>
      )}
      {selected && currentDays.map(renderDay)}

      {selected &&
        lockedStages.map((stage) => (
          <section key={stage} className="card day-card">
            <h3 className="day-title">{STAGE_LABELS[stage]} 🔒</h3>
            <p className="muted hint">
              Podrás predecir estos partidos cuando se conozcan los equipos clasificados.
            </p>
            {KNOCKOUT_BRACKET.filter((s) => s.stage === stage).map((slot) => (
              <div key={slot.matchNumber} className="m-item">
                <div className="m-row static">
                  <span className="status-ico" title="Por definir">🔒</span>
                  <div className="m-main">
                    <div className="m-teams bracket-teams">
                      <span>{slot.home}</span>
                      <span className="vs">vs</span>
                      <span>{slot.away}</span>
                    </div>
                    <div className="m-sub">
                      {formatKickoff(slot.kickoff)}
                      {slot.venue ? ` · ${slot.venue}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        ))}

      {selected && matches.length === 0 && (
        <p className="muted">No hay partidos creados todavía.</p>
      )}
    </div>
  );
}
