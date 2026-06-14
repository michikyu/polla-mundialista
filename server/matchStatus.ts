import type { Match } from '../shared/types';
import { kickoffTimestamp } from '../shared/time';

// El estado 'cerrado' es derivado: un partido se bloquea solo cuando llega su hora de inicio.
export function withEffectiveStatus(match: Match): Match {
  if (match.status === 'finalizado') {
    return match;
  }
  const started = kickoffTimestamp(match.kickoff) <= Date.now();
  return { ...match, status: started ? 'cerrado' : 'pendiente' };
}

export function predictionsAreOpen(match: Match): boolean {
  return withEffectiveStatus(match).status === 'pendiente';
}
