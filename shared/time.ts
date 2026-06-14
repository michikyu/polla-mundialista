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
