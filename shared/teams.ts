export interface TeamInfo {
  code: string;
  alpha2: string | null;
  group: string | null;
}

// 48 selecciones del Mundial 2026, indexadas por su nombre en español (como se guardan en la BD).
// alpha2 = código ISO para la imagen de la bandera (flagcdn.com). group = grupo del Mundial.
export const TEAMS: Record<string, TeamInfo> = {
  // Grupo A
  'México': { code: 'MEX', alpha2: 'mx', group: 'A' },
  'Sudáfrica': { code: 'RSA', alpha2: 'za', group: 'A' },
  'Corea del Sur': { code: 'KOR', alpha2: 'kr', group: 'A' },
  'Chequia': { code: 'CZE', alpha2: 'cz', group: 'A' },
  // Grupo B
  'Canadá': { code: 'CAN', alpha2: 'ca', group: 'B' },
  'Bosnia y Herzegovina': { code: 'BIH', alpha2: 'ba', group: 'B' },
  'Catar': { code: 'QAT', alpha2: 'qa', group: 'B' },
  'Suiza': { code: 'SUI', alpha2: 'ch', group: 'B' },
  // Grupo C
  'Brasil': { code: 'BRA', alpha2: 'br', group: 'C' },
  'Marruecos': { code: 'MAR', alpha2: 'ma', group: 'C' },
  'Haití': { code: 'HAI', alpha2: 'ht', group: 'C' },
  'Escocia': { code: 'SCO', alpha2: 'gb-sct', group: 'C' },
  // Grupo D
  'Estados Unidos': { code: 'USA', alpha2: 'us', group: 'D' },
  'Paraguay': { code: 'PAR', alpha2: 'py', group: 'D' },
  'Australia': { code: 'AUS', alpha2: 'au', group: 'D' },
  'Turquía': { code: 'TUR', alpha2: 'tr', group: 'D' },
  // Grupo E
  'Alemania': { code: 'GER', alpha2: 'de', group: 'E' },
  'Curazao': { code: 'CUW', alpha2: 'cw', group: 'E' },
  'Costa de Marfil': { code: 'CIV', alpha2: 'ci', group: 'E' },
  'Ecuador': { code: 'ECU', alpha2: 'ec', group: 'E' },
  // Grupo F
  'Países Bajos': { code: 'NED', alpha2: 'nl', group: 'F' },
  'Japón': { code: 'JPN', alpha2: 'jp', group: 'F' },
  'Suecia': { code: 'SWE', alpha2: 'se', group: 'F' },
  'Túnez': { code: 'TUN', alpha2: 'tn', group: 'F' },
  // Grupo G
  'Bélgica': { code: 'BEL', alpha2: 'be', group: 'G' },
  'Egipto': { code: 'EGY', alpha2: 'eg', group: 'G' },
  'Irán': { code: 'IRN', alpha2: 'ir', group: 'G' },
  'Nueva Zelanda': { code: 'NZL', alpha2: 'nz', group: 'G' },
  // Grupo H
  'España': { code: 'ESP', alpha2: 'es', group: 'H' },
  'Cabo Verde': { code: 'CPV', alpha2: 'cv', group: 'H' },
  'Arabia Saudita': { code: 'KSA', alpha2: 'sa', group: 'H' },
  'Uruguay': { code: 'URU', alpha2: 'uy', group: 'H' },
  // Grupo I
  'Francia': { code: 'FRA', alpha2: 'fr', group: 'I' },
  'Senegal': { code: 'SEN', alpha2: 'sn', group: 'I' },
  'Irak': { code: 'IRQ', alpha2: 'iq', group: 'I' },
  'Noruega': { code: 'NOR', alpha2: 'no', group: 'I' },
  // Grupo J
  'Argentina': { code: 'ARG', alpha2: 'ar', group: 'J' },
  'Argelia': { code: 'ALG', alpha2: 'dz', group: 'J' },
  'Austria': { code: 'AUT', alpha2: 'at', group: 'J' },
  'Jordania': { code: 'JOR', alpha2: 'jo', group: 'J' },
  // Grupo K
  'Portugal': { code: 'POR', alpha2: 'pt', group: 'K' },
  'RD Congo': { code: 'COD', alpha2: 'cd', group: 'K' },
  'Uzbekistán': { code: 'UZB', alpha2: 'uz', group: 'K' },
  'Colombia': { code: 'COL', alpha2: 'co', group: 'K' },
  // Grupo L
  'Inglaterra': { code: 'ENG', alpha2: 'gb-eng', group: 'L' },
  'Croacia': { code: 'CRO', alpha2: 'hr', group: 'L' },
  'Ghana': { code: 'GHA', alpha2: 'gh', group: 'L' },
  'Panamá': { code: 'PAN', alpha2: 'pa', group: 'L' },
};

export const GROUP_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// Para equipos creados a mano que no estén en la lista (p. ej. fases eliminatorias con apodos).
export function getTeam(name: string): TeamInfo {
  return TEAMS[name] ?? { code: name.slice(0, 3).toUpperCase(), alpha2: null, group: null };
}

// Emoji de la bandera a partir del código ISO (se arma con caracteres regionales,
// sin pegar bytes de emoji al archivo). Inglaterra y Escocia usan secuencias especiales.
export function flagEmoji(name: string): string {
  const { alpha2 } = getTeam(name);
  if (!alpha2) {
    return '';
  }
  if (alpha2 === 'gb-eng') {
    return String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f);
  }
  if (alpha2 === 'gb-sct') {
    return String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0073, 0xe0063, 0xe0074, 0xe007f);
  }
  if (alpha2.length === 2) {
    return String.fromCodePoint(
      ...[...alpha2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
    );
  }
  return '';
}
