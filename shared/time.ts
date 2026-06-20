// Las horas de los partidos se guardan como 'YYYY-MM-DDTHH:mm' en hora de Colombia
// (UTC-5, sin horario de verano). Anclar el offset da un instante absoluto correcto
// sin importar la zona horaria del servidor o del navegador.
export const COLOMBIA_UTC_OFFSET = '-05:00';

export function kickoffTimestamp(kickoff: string): number {
  const withZone = kickoff.length === 16 ? `${kickoff}:00${COLOMBIA_UTC_OFFSET}` : kickoff;
  const parsed = Date.parse(withZone);
  return Number.isNaN(parsed) ? Date.parse(kickoff) : parsed;
}

export function kickoffDate(kickoff: string): Date {
  return new Date(kickoffTimestamp(kickoff));
}

// Tras el inicio, las predicciones quedan cerradas para los participantes, pero el
// administrador todavía puede corregirlas durante esta ventana (p. ej. para registrar
// una predicción que llegó a tiempo por otro canal y no se alcanzó a guardar).
export const ADMIN_PREDICTION_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function adminCanEditPredictions(kickoff: string, now: number = Date.now()): boolean {
  return now - kickoffTimestamp(kickoff) <= ADMIN_PREDICTION_EDIT_WINDOW_MS;
}
