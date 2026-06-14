export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function asGoals(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < 0 || num > 99) {
    return null;
  }
  return num;
}

// Puntos de handicap (ventaja/penalización inicial). Devuelve null si no es válido
// o no viene, para distinguir "no cambiar" de "poner en 0".
export function asHandicap(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < -999 || num > 999) {
    return null;
  }
  return num;
}

export function asId(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return null;
  }
  return num;
}

const STAGES = ['grupos', 'dieciseisavos', 'octavos', 'cuartos', 'semifinal', 'tercer_puesto', 'final'];

export function asStage(value: unknown): string {
  return typeof value === 'string' && STAGES.includes(value) ? value : 'grupos';
}
