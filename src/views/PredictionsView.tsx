import { useCallback, useEffect, useState } from 'react';
import type { Match, Participant, Prediction } from '../../shared/types';
import { api, setParticipantAuth } from '../api';
import { formatDayLabel, groupByDay } from '../format';
import { PredictionRow } from '../components/PredictionRow';

interface Props {
  isAdmin: boolean;
  participantId: number | null;
  onSelectParticipant: (id: number | null) => void;
  unlockedId: number | null;
  onUnlockedChange: (id: number | null) => void;
}

export function PredictionsView({
  isAdmin,
  participantId,
  onSelectParticipant,
  unlockedId,
  onUnlockedChange,
}: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showPast, setShowPast] = useState(false);
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

  const handleUnlock = async () => {
    if (!selected) {
      return;
    }
    const password = window.prompt(`Contraseña de ${selected.name}:`);
    if (!password) {
      return;
    }
    try {
      const result = await api.checkParticipantPassword(selected.id, password);
      if (result.ok) {
        setParticipantAuth({ id: selected.id, password });
        onUnlockedChange(selected.id);
      } else {
        window.alert('Contraseña incorrecta.');
      }
    } catch {
      window.alert('No se pudo verificar la contraseña.');
    }
  };

  // Por defecto solo se ven los partidos que aún NO empezaron (predecibles).
  // Los que ya arrancaron o terminaron van en el colapsable de "pasados".
  const currentDays = groupByDay(matches.filter((m) => m.status === 'pendiente'));
  const pastMatches = matches.filter((m) => m.status !== 'pendiente');
  const pastDays = groupByDay(pastMatches);
  const pastMatchCount = pastMatches.length;

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
        <h2>📝 Mis predicciones</h2>
        {error && <p className="error">{error}</p>}
        <label className="select-label">
          ¿Quién eres?
          <select
            value={selected ? String(selected.id) : ''}
            onChange={(e) => onSelectParticipant(Number(e.target.value) > 0 ? Number(e.target.value) : null)}
          >
            <option value="">Elige tu nombre…</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        {selected && !canEdit && (
          <button className="btn btn-primary unlock-btn" onClick={() => void handleUnlock()}>
            🔑 Ingresar mi contraseña para predecir
          </button>
        )}
        {selected && canEdit && !isAdmin && (
          <p className="muted hint">✅ Desbloqueado: puedes registrar tus predicciones.</p>
        )}

        <p className="muted hint">
          ⏳ abierto · 🔒 ya empezó · ✅ finalizado. La predicción se registra <strong>una sola vez</strong> y no
          se puede cambiar, así que piénsala bien. Las predicciones de los demás son secretas (🤫) hasta que
          empiece el partido; solo se ve quién ya puso la suya.
        </p>
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
      {selected && matches.length === 0 && (
        <p className="muted">No hay partidos creados todavía.</p>
      )}
    </div>
  );
}
