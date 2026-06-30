import type { MatchStage } from './types';

// Bracket oficial de eliminatorias del Mundial 2026 (partidos 73 a 104).
// Fuente: calendario oficial FIFA. Horas en hora de Colombia (UTC-5).
// Los cruces "3.º A/B/…" indican de qué grupos puede venir el mejor tercero.
export interface BracketSlot {
  matchNumber: number;
  stage: MatchStage;
  home: string;
  away: string;
  kickoff: string; // 'YYYY-MM-DDTHH:mm' hora de Colombia
  venue: string;
}

export const KNOCKOUT_BRACKET: BracketSlot[] = [
  // Dieciseisavos de final (32avos) — partidos 73-88
  { matchNumber: 73, stage: 'dieciseisavos', home: '2.º Grupo A', away: '2.º Grupo B', kickoff: '2026-06-28T14:00', venue: 'SoFi Stadium, Los Ángeles' },
  { matchNumber: 76, stage: 'dieciseisavos', home: '1.º Grupo C', away: '2.º Grupo F', kickoff: '2026-06-29T12:00', venue: 'NRG Stadium, Houston' },
  { matchNumber: 74, stage: 'dieciseisavos', home: '1.º Grupo E', away: '3.º A/B/C/D/F', kickoff: '2026-06-29T15:30', venue: 'Gillette Stadium, Boston' },
  { matchNumber: 75, stage: 'dieciseisavos', home: '1.º Grupo F', away: '2.º Grupo C', kickoff: '2026-06-29T20:00', venue: 'Estadio BBVA, Monterrey' },
  { matchNumber: 78, stage: 'dieciseisavos', home: '2.º Grupo E', away: '2.º Grupo I', kickoff: '2026-06-30T12:00', venue: 'AT&T Stadium, Dallas' },
  { matchNumber: 77, stage: 'dieciseisavos', home: '1.º Grupo I', away: '3.º C/D/F/G/H', kickoff: '2026-06-30T16:00', venue: 'MetLife Stadium, Nueva York' },
  { matchNumber: 79, stage: 'dieciseisavos', home: '1.º Grupo A', away: '3.º C/E/F/H/I', kickoff: '2026-06-30T20:00', venue: 'Estadio Azteca, Ciudad de México' },
  { matchNumber: 80, stage: 'dieciseisavos', home: '1.º Grupo L', away: '3.º E/H/I/J/K', kickoff: '2026-07-01T11:00', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { matchNumber: 82, stage: 'dieciseisavos', home: '1.º Grupo G', away: '3.º A/E/H/I/J', kickoff: '2026-07-01T15:00', venue: 'Lumen Field, Seattle' },
  { matchNumber: 81, stage: 'dieciseisavos', home: '1.º Grupo D', away: '3.º B/E/F/I/J', kickoff: '2026-07-01T19:00', venue: "Levi's Stadium, San Francisco" },
  { matchNumber: 84, stage: 'dieciseisavos', home: '1.º Grupo H', away: '2.º Grupo J', kickoff: '2026-07-02T14:00', venue: 'SoFi Stadium, Los Ángeles' },
  { matchNumber: 83, stage: 'dieciseisavos', home: '2.º Grupo K', away: '2.º Grupo L', kickoff: '2026-07-02T18:00', venue: 'BMO Field, Toronto' },
  { matchNumber: 85, stage: 'dieciseisavos', home: '1.º Grupo B', away: '3.º E/F/G/I/J', kickoff: '2026-07-02T22:00', venue: 'BC Place, Vancouver' },
  { matchNumber: 88, stage: 'dieciseisavos', home: '2.º Grupo D', away: '2.º Grupo G', kickoff: '2026-07-03T13:00', venue: 'AT&T Stadium, Dallas' },
  { matchNumber: 86, stage: 'dieciseisavos', home: '1.º Grupo J', away: '2.º Grupo H', kickoff: '2026-07-03T17:00', venue: 'Hard Rock Stadium, Miami' },
  { matchNumber: 87, stage: 'dieciseisavos', home: '1.º Grupo K', away: '3.º D/E/I/J/L', kickoff: '2026-07-03T20:30', venue: 'Arrowhead Stadium, Kansas City' },

  // Octavos de final — partidos 89-96
  { matchNumber: 90, stage: 'octavos', home: 'Gana P73', away: 'Gana P75', kickoff: '2026-07-04T12:00', venue: 'NRG Stadium, Houston' },
  { matchNumber: 89, stage: 'octavos', home: 'Gana P74', away: 'Gana P77', kickoff: '2026-07-04T16:00', venue: 'Lincoln Financial Field, Filadelfia' },
  { matchNumber: 91, stage: 'octavos', home: 'Gana P76', away: 'Gana P78', kickoff: '2026-07-05T15:00', venue: 'MetLife Stadium, Nueva York' },
  { matchNumber: 92, stage: 'octavos', home: 'Gana P79', away: 'Gana P80', kickoff: '2026-07-05T19:00', venue: 'Estadio Azteca, Ciudad de México' },
  { matchNumber: 93, stage: 'octavos', home: 'Gana P83', away: 'Gana P84', kickoff: '2026-07-06T14:00', venue: 'AT&T Stadium, Dallas' },
  { matchNumber: 94, stage: 'octavos', home: 'Gana P81', away: 'Gana P82', kickoff: '2026-07-06T19:00', venue: 'Lumen Field, Seattle' },
  { matchNumber: 95, stage: 'octavos', home: 'Gana P86', away: 'Gana P88', kickoff: '2026-07-07T11:00', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { matchNumber: 96, stage: 'octavos', home: 'Gana P85', away: 'Gana P87', kickoff: '2026-07-07T15:00', venue: 'BC Place, Vancouver' },

  // Cuartos de final — partidos 97-100
  { matchNumber: 97, stage: 'cuartos', home: 'Gana P89', away: 'Gana P90', kickoff: '2026-07-09T15:00', venue: 'Gillette Stadium, Boston' },
  { matchNumber: 98, stage: 'cuartos', home: 'Gana P93', away: 'Gana P94', kickoff: '2026-07-10T14:00', venue: 'SoFi Stadium, Los Ángeles' },
  { matchNumber: 99, stage: 'cuartos', home: 'Gana P91', away: 'Gana P92', kickoff: '2026-07-11T16:00', venue: 'Hard Rock Stadium, Miami' },
  { matchNumber: 100, stage: 'cuartos', home: 'Gana P95', away: 'Gana P96', kickoff: '2026-07-11T20:00', venue: 'Arrowhead Stadium, Kansas City' },

  // Semifinales — partidos 101-102
  { matchNumber: 101, stage: 'semifinal', home: 'Gana P97', away: 'Gana P98', kickoff: '2026-07-14T14:00', venue: 'AT&T Stadium, Dallas' },
  { matchNumber: 102, stage: 'semifinal', home: 'Gana P99', away: 'Gana P100', kickoff: '2026-07-15T14:00', venue: 'Mercedes-Benz Stadium, Atlanta' },

  // Tercer puesto y final
  { matchNumber: 103, stage: 'tercer_puesto', home: 'Pierde P101', away: 'Pierde P102', kickoff: '2026-07-18T16:00', venue: 'Hard Rock Stadium, Miami' },
  { matchNumber: 104, stage: 'final', home: 'Gana P101', away: 'Gana P102', kickoff: '2026-07-19T14:00', venue: 'MetLife Stadium, Nueva York' },
];

// Orden vertical de cada cruce dentro del cuadro: recorrido in-order del árbol desde la
// final, para que cada partido quede entre sus dos alimentadores (Gana P##). Sin esto, las
// columnas salían en el orden del arreglo y un octavo caía junto a 16avos que no lo alimentan.
function computeBracketOrder(): number[] {
  const byNum = new Map(KNOCKOUT_BRACKET.map((s) => [s.matchNumber, s]));
  const childrenOf = (n: number): number[] => {
    const slot = byNum.get(n);
    if (!slot) {
      return [];
    }
    const kids: number[] = [];
    for (const side of [slot.home, slot.away]) {
      const m = side.match(/Gana P(\d+)/);
      if (m) {
        kids.push(Number(m[1]));
      }
    }
    return kids;
  };
  const inorder = (n: number): number[] => {
    const kids = childrenOf(n);
    if (kids.length < 2) {
      return [n];
    }
    return [...inorder(kids[0]), n, ...inorder(kids[1])];
  };
  const finalSlot = KNOCKOUT_BRACKET.find((s) => s.stage === 'final');
  return finalSlot ? inorder(finalSlot.matchNumber) : KNOCKOUT_BRACKET.map((s) => s.matchNumber);
}

const BRACKET_RANK = new Map(computeBracketOrder().map((n, i) => [n, i]));

// Posición (de arriba a abajo) de un cruce en su columna del cuadro.
export function bracketRank(matchNumber: number): number {
  return BRACKET_RANK.get(matchNumber) ?? matchNumber;
}
