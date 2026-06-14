import { useEffect, useState, type FormEvent } from 'react';
import type { Match, MatchStage } from '../../shared/types';
import { STAGE_LABELS, STAGE_ORDER } from '../../shared/types';
import { api } from '../api';
import { formatDayLabel, groupByDay } from '../format';
import { MatchAdminRow } from '../components/MatchAdminRow';

export function MatchesView({ onOpenMatch, isAdmin }: { onOpenMatch: (id: number) => void; isAdmin: boolean }) {
  const [matches, setMatches] = useState<Match[]>([]);
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
        />
      ))}
    </section>
  );

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
      {matches.length === 0 && (
        <p className="muted">No hay partidos. Crea el primero con el botón de arriba.</p>
      )}
    </div>
  );
}
