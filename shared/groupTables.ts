import type { Match } from './types';
import { GROUP_LABELS, TEAMS } from './teams';
import { KNOCKOUT_BRACKET } from './bracket';

export interface TeamStats {
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

export function diff(stats: TeamStats): number {
  return stats.goalsFor - stats.goalsAgainst;
}

export function compareStats(a: TeamStats, b: TeamStats): number {
  return b.points - a.points || diff(b) - diff(a) || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name, 'es');
}

// Tablas de los 12 grupos calculadas a partir de los resultados registrados.
export function buildGroupTables(matches: Match[]): Map<string, TeamStats[]> {
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

// Resuelve los cupos "1.º Grupo X" / "2.º Grupo X" al equipo real, pero SOLO para los
// grupos que ya terminaron (todos sus partidos jugados). Los cupos de "3.º …" no se
// resuelven aquí porque dependen de la tabla de asignación de mejores terceros de la FIFA.
export function resolveGroupSlots(matches: Match[]): Map<string, string> {
  const tables = buildGroupTables(matches);
  const resolved = new Map<string, string>();
  for (const group of GROUP_LABELS) {
    const teams = tables.get(group) ?? [];
    const groupComplete = teams.length > 0 && teams.every((t) => t.played === teams.length - 1);
    if (!groupComplete) {
      continue;
    }
    if (teams[0]) {
      resolved.set(`1.º Grupo ${group}`, teams[0].name);
    }
    if (teams[1]) {
      resolved.set(`2.º Grupo ${group}`, teams[1].name);
    }
  }
  return resolved;
}

// Ganador/perdedor de un partido terminado (por goles; si hay empate, por penaltis).
function decideMatch(m: Match): { winner: string | null; loser: string | null } {
  if (m.home_score == null || m.away_score == null) {
    return { winner: null, loser: null };
  }
  if (m.home_score > m.away_score) {
    return { winner: m.home_team, loser: m.away_team };
  }
  if (m.away_score > m.home_score) {
    return { winner: m.away_team, loser: m.home_team };
  }
  const hp = m.home_penalties;
  const ap = m.away_penalties;
  if (hp != null && ap != null && hp !== ap) {
    return hp > ap
      ? { winner: m.home_team, loser: m.away_team }
      : { winner: m.away_team, loser: m.home_team };
  }
  return { winner: null, loser: null }; // empate sin penaltis definidos
}

// Resuelve TODOS los cupos del cuadro que ya se puedan: "1.º/2.º Grupo X" (grupos
// terminados) y "Gana P##" / "Pierde P##" (partidos del cuadro ya jugados). Así, en
// cuanto un equipo avanza, su nombre aparece aunque el rival siga pendiente.
export function resolveBracketSlots(matches: Match[]): Map<string, string> {
  const resolved = resolveGroupSlots(matches);
  for (const slot of KNOCKOUT_BRACKET) {
    const real = matches.find((m) => m.stage === slot.stage && m.kickoff === slot.kickoff);
    if (!real || real.status !== 'finalizado') {
      continue;
    }
    const { winner, loser } = decideMatch(real);
    if (winner) {
      resolved.set(`Gana P${slot.matchNumber}`, winner);
    }
    if (loser) {
      resolved.set(`Pierde P${slot.matchNumber}`, loser);
    }
  }
  return resolved;
}
