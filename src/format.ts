import type { MatchStatus } from '../shared/types';
import { kickoffDate } from '../shared/time';

// Todos los horarios de partidos se muestran en hora de Colombia (UTC-5),
// sin importar la zona horaria del navegador del usuario.
const BOGOTA_TZ = 'America/Bogota';

const dayFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: BOGOTA_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const timeFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: BOGOTA_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const shortFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: BOGOTA_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

// Las marcas de tiempo de predicciones se muestran en hora local del navegador.
const timestampFormatter = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

// Los kickoffs se interpretan como hora de Colombia y se muestran en la hora local de quien mira.
export function formatKickoff(kickoff: string): string {
  const date = kickoffDate(kickoff);
  return Number.isNaN(date.getTime()) ? kickoff : shortFormatter.format(date);
}

export function formatDayLabel(kickoff: string): string {
  const date = kickoffDate(kickoff);
  return Number.isNaN(date.getTime()) ? kickoff : dayFormatter.format(date);
}

export function formatTime(kickoff: string): string {
  const date = kickoffDate(kickoff);
  return Number.isNaN(date.getTime()) ? kickoff : timeFormatter.format(date);
}

// Para las marcas de tiempo de las predicciones (ISO UTC -> hora local del navegador).
export function formatTimestamp(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : timestampFormatter.format(date);
}

// Clave de agrupación: la fecha del partido en hora de Colombia (no la del navegador).
const bogotaDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BOGOTA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function localDayKey(kickoff: string): string {
  const date = kickoffDate(kickoff);
  if (Number.isNaN(date.getTime())) {
    return kickoff.slice(0, 10);
  }
  return bogotaDayFormatter.format(date); // → 'YYYY-MM-DD' en zona Colombia
}

// Fecha de hoy en Colombia, en el mismo formato que las claves de groupByDay.
export function colombiaTodayKey(): string {
  return bogotaDayFormatter.format(new Date());
}

export function groupByDay<T extends { kickoff: string }>(items: T[]): Array<{ day: string; items: T[] }> {
  const groups: Array<{ day: string; items: T[] }> = [];
  const sorted = [...items].sort((a, b) => kickoffTimestampSafe(a.kickoff) - kickoffTimestampSafe(b.kickoff));
  for (const item of sorted) {
    const day = localDayKey(item.kickoff);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
  }
  return groups;
}

function kickoffTimestampSafe(kickoff: string): number {
  const time = kickoffDate(kickoff).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export const STATUS_LABELS: Record<MatchStatus, string> = {
  pendiente: 'Pendiente',
  cerrado: 'En juego / cerrado',
  finalizado: 'Finalizado',
};

export const STATUS_ICONS: Record<MatchStatus, string> = {
  pendiente: '⏳',
  cerrado: '🔒',
  finalizado: '✅',
};

export function pointsLabel(points: number | null): string {
  if (points === null) {
    return '—';
  }
  return `${points} pt${points === 1 ? '' : 's'}`;
}
