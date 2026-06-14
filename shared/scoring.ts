export interface ScoringConfig {
  exactUnique: number; // marcador exacto y fuiste el único
  exactShared: number; // marcador exacto repetido (otros también)
  outcome: number; // acertó ganador o empate (sin marcador exacto)
  miss: number; // no acertó
}

export const DEFAULT_SCORING: ScoringConfig = {
  exactUnique: 5,
  exactShared: 4,
  outcome: 3,
  miss: 0,
};

export function isExactHit(
  predictedHome: number,
  predictedAway: number,
  realHome: number,
  realAway: number,
): boolean {
  return predictedHome === realHome && predictedAway === realAway;
}

export function isOutcomeHit(
  predictedHome: number,
  predictedAway: number,
  realHome: number,
  realAway: number,
): boolean {
  return Math.sign(predictedHome - predictedAway) === Math.sign(realHome - realAway);
}

// El puntaje del marcador exacto depende de cuántos lo acertaron en ese partido:
// exactUnique si fue el único, exactShared si fue repetido. Los valores se pueden
// configurar desde la app (admin); por defecto 5 / 4 / 3 / 0.
export function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  realHome: number,
  realAway: number,
  exactHitsInMatch: number,
  config: ScoringConfig = DEFAULT_SCORING,
): number {
  if (isExactHit(predictedHome, predictedAway, realHome, realAway)) {
    return exactHitsInMatch <= 1 ? config.exactUnique : config.exactShared;
  }
  if (isOutcomeHit(predictedHome, predictedAway, realHome, realAway)) {
    return config.outcome;
  }
  return config.miss;
}
