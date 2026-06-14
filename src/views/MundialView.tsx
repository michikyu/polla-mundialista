import { useEffect, useState } from 'react';
import type { Match, MatchStage } from '../../shared/types';
import { STAGE_LABELS, STAGE_ORDER } from '../../shared/types';
import { GROUP_LABELS, TEAMS } from '../../shared/teams';
import { KNOCKOUT_BRACKET } from '../../shared/bracket';
import { api } from '../api';
import { formatKickoff, STATUS_ICONS, STATUS_LABELS } from '../format';
import { TeamLabel } from '../components/TeamLabel';

interface TeamStats {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function emptyStats(name: string): TeamStats {
  return { name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

function applyResult(stats: TeamStats, scored: number, conceded: number): void {
  stats.played += 1;
  stats.goalsFor += scored;
  stats.goalsAgainst += conceded;
  if (scored > conceded) {
    stats.won += 1;
    stats.points += 3;
  } else if (scored === conceded) {
    stats.drawn += 1;
    stats.points += 1;
  } else {
    stats.lost += 1;
  }
}

function diff(stats: TeamStats): number {
  return stats.goalsFor - stats.goalsAgainst;
}

function compareStats(a: TeamStats, b: TeamStats): number {
  return b.points - a.points || diff(b) - diff(a) || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name, 'es');
}

// Tablas de los 12 grupos calculadas a partir de los resultados registrados.
function buildGroupTables(matches: Match[]): Map<string, TeamStats[]> {
  const statsByTeam = new Map<string, TeamStats>();
  for (const [name, info] of Object.entries(TEAMS)) {
    if (info.group) {
      statsByTeam.set(name, emptyStats(name));
    }
  }
  for (const match of matches) {
    if (match.stage !== 'grupos' || match.status !== 'finalizado') {
      continue;
    }
    if (match.home_score === null || match.away_score === null) {
      continue;
    }
    const home = statsByTeam.get(match.home_team);
    const away = statsByTeam.get(match.away_team);
    if (home) {
      applyResult(home, match.home_score, match.away_score);
    }
    if (away) {
      applyResult(away, match.away_score, match.home_score);
    }
  }
  const tables = new Map<string, TeamStats[]>();
  for (const group of GROUP_LABELS) {
    const teams = Object.entries(TEAMS)
      .filter(([, info]) => info.group === group)
      .map(([name]) => statsByTeam.get(name) as TeamStats)
      .sort(compareStats);
    tables.set(group, teams);
  }
  return tables;
}

interface MundialProps {
  onOpenMatch: (id: number) => void;
  isAdmin: boolean;
}

export function MundialView({ onOpenMatch, isAdmin }: MundialProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    api.getMatches().then(setMatches).catch((err: Error) => setError(err.message));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    setError('');
    try {
      const result = await api.syncResults();
      const parts: string[] = [];
      if (result.updated > 0) {
        parts.push(`${result.updated} resultado${result.updated === 1 ? '' : 's'} actualizado${result.updated === 1 ? '' : 's'}`);
      }
      if (result.created > 0) {
        parts.push(`${result.created} cruce${result.created === 1 ? '' : 's'} de eliminatoria creado${result.created === 1 ? '' : 's'}`);
      }
      setSyncMessage(
        parts.length > 0
          ? `✅ ${parts.join(' y ')} (${result.checked} partidos revisados).`
          : `Sin novedades (${result.checked} partidos revisados).`,
      );
      setMatches(await api.getMatches());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const tables = buildGroupTables(matches);

  // Mejores terceros: los 8 mejores avanzan a dieciseisavos junto con los 2 primeros de cada grupo.
  const thirds = GROUP_LABELS.map((group) => ({ group, stats: (tables.get(group) as TeamStats[])[2] }))
    .sort((a, b) => compareStats(a.stats, b.stats));

  const knockoutStages = STAGE_ORDER.filter((stage) => stage !== 'grupos');
  // Partidos reales de eliminatoria por fase (los crea el sync cuando se definen los cruces).
  const realByStage = new Map<MatchStage, Match[]>();
  for (const stage of knockoutStages) {
    realByStage.set(
      stage,
      matches
        .filter((m) => m.stage === stage)
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    );
  }

  return (
    <div className="stack">
      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="card-header">
          <h2>🌎 Fase de grupos</h2>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => void handleSync()} disabled={syncing}>
              {syncing ? 'Buscando…' : '🔄 Actualizar resultados'}
            </button>
          )}
        </div>
        {syncMessage && <p className="muted hint">{syncMessage}</p>}
        <p className="muted hint">
          Se calcula sola con los resultados registrados. Avanzan los 2 primeros de cada grupo (verde) y los
          8 mejores terceros.
        </p>
      </section>

      <div className="groups-grid">
        {GROUP_LABELS.map((group) => (
          <section key={group} className="card group-card">
            <h3 className="day-title">Grupo {group}</h3>
            <table className="table group-table">
              <thead>
                <tr>
                  <th className="left">Equipo</th>
                  <th title="Partidos jugados">PJ</th>
                  <th title="Ganados">G</th>
                  <th title="Empatados">E</th>
                  <th title="Perdidos">P</th>
                  <th title="Diferencia de gol">DIF</th>
                  <th title="Puntos">PTS</th>
                </tr>
              </thead>
              <tbody>
                {(tables.get(group) as TeamStats[]).map((team, index) => (
                  <tr key={team.name} className={index < 2 ? 'qualifying' : ''}>
                    <td className="left">
                      <TeamLabel name={team.name} side="home" />
                    </td>
                    <td>{team.played}</td>
                    <td>{team.won}</td>
                    <td>{team.drawn}</td>
                    <td>{team.lost}</td>
                    <td>{diff(team) > 0 ? `+${diff(team)}` : diff(team)}</td>
                    <td className="strong">{team.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <section className="card">
        <h2>🥉 Mejores terceros</h2>
        <p className="muted hint">Los 8 primeros de esta lista (verde) también avanzan a dieciseisavos.</p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th className="left">Equipo</th>
                <th>Grupo</th>
                <th>PJ</th>
                <th>DIF</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              {thirds.map(({ group, stats }, index) => (
                <tr key={group} className={index < 8 ? 'qualifying' : ''}>
                  <td>{index + 1}</td>
                  <td className="left">
                    <TeamLabel name={stats.name} side="home" />
                  </td>
                  <td>{group}</td>
                  <td>{stats.played}</td>
                  <td>{diff(stats) > 0 ? `+${diff(stats)}` : diff(stats)}</td>
                  <td className="strong">{stats.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card day-card">
        <h2>🏆 Eliminatorias</h2>
        <p className="muted hint">
          Bracket oficial de la FIFA. Cada fase muestra la plantilla de cruces (P73…P104) y se llena sola
          con los equipos clasificados cuando se actualizan los resultados.
        </p>
        {knockoutStages.map((stage) => {
          const real = realByStage.get(stage) ?? [];
          const slots = KNOCKOUT_BRACKET.filter((s) => s.stage === stage);
          return (
            <div key={stage}>
              <h3 className="day-title">{STAGE_LABELS[stage]}</h3>
              {real.length > 0
                ? real.map((match) => (
                    <div key={match.id} className="m-item">
                      <div className="m-row" onClick={() => onOpenMatch(match.id)}>
                        <span className="status-ico" title={STATUS_LABELS[match.status]}>
                          {STATUS_ICONS[match.status]}
                        </span>
                        <div className="m-main">
                          <div className="m-teams">
                            <TeamLabel name={match.home_team} side="home" />
                            {match.status === 'finalizado' ? (
                              <span className="score">{match.home_score} - {match.away_score}</span>
                            ) : (
                              <span className="vs">vs</span>
                            )}
                            <TeamLabel name={match.away_team} side="away" />
                          </div>
                          <div className="m-sub">
                            {formatKickoff(match.kickoff)}
                            {match.venue ? ` · ${match.venue}` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                : slots.map((slot) => (
                    <div key={slot.matchNumber} className="m-item bracket-slot">
                      <div className="m-row">
                        <span className="status-ico" title="Cruce por definir">⬜</span>
                        <div className="m-main">
                          <div className="m-teams bracket-teams">
                            <span>{slot.home}</span>
                            <span className="vs">vs</span>
                            <span>{slot.away}</span>
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
            </div>
          );
        })}
      </section>
    </div>
  );
}
