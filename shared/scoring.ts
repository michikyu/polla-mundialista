export const POINTS_EXACT_UNIQUE = 5;
export const POINTS_EXACT_SHARED = 4;
export const POINTS_OUTCOME = 3;
export const POINTS_MISS = 0;

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
// 5 si fue el único, 4 si fue repetido.
export function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  realHome: number,
  realAway: number,
  exactHitsInMatch: number,
): number {
  if (isExactHit(predictedHome, predictedAway, realHome, realAway)) {
    return exactHitsInMatch <= 1 ? POINTS_EXACT_UNIQUE : POINTS_EXACT_SHARED;
  }
  if (isOutcomeHit(predictedHome, predictedAway, realHome, realAway)) {
    return POINTS_OUTCOME;
  }
  return POINTS_MISS;
}
