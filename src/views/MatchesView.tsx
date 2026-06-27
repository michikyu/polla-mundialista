import { useEffect, useState, type FormEvent } from 'react';
import type { Match, MatchStage } from '../../shared/types';
import { STAGE_LABELS, STAGE_ORDER } from '../../shared/types';
import { KNOCKOUT_BRACKET } from '../../shared/bracket';
import { resolveGroupSlots } from '../../shared/groupTables';
import { api } from '../api';
import { formatKickoff, formatDayLabel, groupByDay } from '../format';
import { MatchAdminRow } from '../components/MatchAdminRow';

interface Props {
  onOpenMatch: (id: number) => void;
  isAdmin: boolean;
  viewerParticipantId: number | null;
}

export function MatchesView({ onOpenMatch, isAdmin, viewerParticipantId }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictedIds, setPredictedIds] = useState<Set<number>>(new Set());
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [kickoff, setKickoff] = useState('');
  const [venue, setVenue] = useState('');
  const [stage, setStage] = useState<MatchStage>('grupos');
  const [stageFilter, setStageFilter] = useState<'todos' | MatchStage>('todos');
  const [showPast, setShowPast] = useState(false);
  const [error, setError] = useState('');

  const reload = () => {
    api.getMatches().then(setMatches).catch((err: Error) => setError(err.message));
    api.getParticipants().then((rows) => setTotalParticipants(rows.length)).catch(() => {});
  };

  useEffect(reload, []);

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

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await api.createMatch({ home_team: homeTeam, away_team: awayTeam, kickoff, venue, stage });
      setHomeTeam('');
      setAwayTeam('');
      setKickoff('');
      setVenue('');
      setStage('grupos');
      setShowForm(false);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const filtered = stageFilter === 'todos' ? matches : matches.filter((m) => m.stage === stageFilter);
  // Por defecto se ven los próximos y los que están en juego (para registrar resultado);
  // solo los ya finalizados van al colapsable de "pasados".
  const currentDays = groupByDay(filtered.filter((m) => m.status !== 'finalizado'));
  const pastMatches = filtered.filter((m) => m.status === 'finalizado');
  const pastDays = groupByDay(pastMatches);
  const pastMatchCount = pastMatches.length;

  const renderDay = (group: { day: string; items: Match[] }) => (
    <section key={group.day} className="card day-card">
      <h3 className="day-title">{formatDayLabel(group.items[0].kickoff)}</h3>
      {group.items.map((match) => (
        <MatchAdminRow
          key={match.id}
          match={match}
          onChanged={reload}
          onOpenMatch={onOpenMatch}
          isAdmin={isAdmin}
          totalParticipants={totalParticipants}
          missingPrediction={missingPrediction(match)}
        />
      ))}
    </section>
  );

  // Cupos de eliminatoria que AÚN NO tienen partido real (enlazados por hora). Así se
  // muestran los que faltan aunque la fase ya tenga algunos cruces definidos (p. ej.
  // si 16avos tiene 4 reales, aparecen los otros 12 como plantilla oficial P73…).
  const unfilledSlotsByStage = STAGE_ORDER.filter(
    (s) => s !== 'grupos' && (stageFilter === 'todos' || stageFilter === s),
  )
    .map((s) => {
      const takenKickoffs = new Set(matches.filter((m) => m.stage === s).map((m) => m.kickoff));
      const slots = KNOCKOUT_BRACKET.filter((slot) => slot.stage === s && !takenKickoffs.has(slot.kickoff));
      return { stage: s, slots };
    })
    .filter((x) => x.slots.length > 0);

  // Equipos ya decididos por los grupos (para mostrarlos en los cupos "por definir").
  const resolvedSlots = resolveGroupSlots(matches);

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <h2>🗓️ Partidos</h2>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancelar' : '+ Nuevo partido'}
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        <p className="muted hint">
          {isAdmin
            ? 'Toca un partido para ver el detalle. Usa el menú ⋮ para editar, registrar resultado o eliminar. Las predicciones se cierran solas cuando el partido empieza.'
            : 'Toca un partido para ver el detalle y las predicciones de todos.'}
        </p>

        {showForm && (
          <form className="match-form" onSubmit={handleCreate}>
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
              <input
                type="datetime-local"
                value={kickoff}
                onChange={(e) => setKickoff(e.target.value)}
                required
              />
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
            <button type="submit" className="btn btn-primary">Crear partido</button>
          </form>
        )}

        <label className="select-label stage-filter">
          Filtrar por fase
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as 'todos' | MatchStage)}>
            <option value="todos">Todas las fases</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
        </label>
      </section>

      {pastDays.length > 0 && (
        <>
          <button className="btn show-all-btn past-toggle" onClick={() => setShowPast(!showPast)}>
            {showPast
              ? 'Ocultar partidos pasados ▲'
              : `🗂️ Ver partidos pasados (${pastMatchCount}) ▼`}
          </button>
          {showPast && pastDays.map(renderDay)}
        </>
      )}
      {currentDays.map(renderDay)}

      {unfilledSlotsByStage.map(({ stage, slots }) => (
        <section key={stage} className="card day-card">
          <h3 className="day-title">{STAGE_LABELS[stage]} — por definir</h3>
          {slots.map((slot) => (
            <div key={slot.matchNumber} className="m-item bracket-slot">
              <div className="m-row">
                <span className="status-ico" title="Cruce por definir">⬜</span>
                <div className="m-main">
                  <div className="m-teams bracket-teams">
                    <span>{resolvedSlots.get(slot.home) ?? slot.home}</span>
                    <span className="vs">vs</span>
                    <span>{resolvedSlots.get(slot.away) ?? slot.away}</span>
                  </div>
                  <div className="m-sub">
                    <span className="bracket-num">P{slot.matchNumber}</span>
                    {' · '}
                    {formatKickoff(slot.kickoff)}
                    {` · ${slot.venue}`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}

      {matches.length === 0 && (
        <p className="muted">No hay partidos. Crea el primero con el botón de arriba.</p>
      )}
    </div>
  );
}
