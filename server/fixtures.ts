export interface Fixture {
  home: string;
  away: string;
  kickoff: string;
  venue: string;
  homeScore?: number;
  awayScore?: number;
}

// Fase de grupos del Mundial 2026 (72 partidos). Horas en hora de Colombia (UTC-5).
// Fuente: calendario oficial FIFA vía Wikipedia (grupos A-L), consultado el 11 jun 2026.
export const GROUP_FIXTURES: Fixture[] = [
  // Grupo A
  { home: 'México', away: 'Sudáfrica', kickoff: '2026-06-11T14:00', venue: 'Estadio Azteca, Ciudad de México' },
  { home: 'Corea del Sur', away: 'Chequia', kickoff: '2026-06-11T21:00', venue: 'Estadio Akron, Guadalajara' },
  { home: 'Chequia', away: 'Sudáfrica', kickoff: '2026-06-18T11:00', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'México', away: 'Corea del Sur', kickoff: '2026-06-18T20:00', venue: 'Estadio Akron, Guadalajara' },
  { home: 'Chequia', away: 'México', kickoff: '2026-06-24T20:00', venue: 'Estadio Azteca, Ciudad de México' },
  { home: 'Sudáfrica', away: 'Corea del Sur', kickoff: '2026-06-24T20:00', venue: 'Estadio BBVA, Monterrey' },
  // Grupo B
  { home: 'Canadá', away: 'Bosnia y Herzegovina', kickoff: '2026-06-12T14:00', venue: 'BMO Field, Toronto' },
  { home: 'Catar', away: 'Suiza', kickoff: '2026-06-13T14:00', venue: "Levi's Stadium, San Francisco" },
  { home: 'Suiza', away: 'Bosnia y Herzegovina', kickoff: '2026-06-18T14:00', venue: 'SoFi Stadium, Los Ángeles' },
  { home: 'Canadá', away: 'Catar', kickoff: '2026-06-18T17:00', venue: 'BC Place, Vancouver' },
  { home: 'Suiza', away: 'Canadá', kickoff: '2026-06-24T14:00', venue: 'BC Place, Vancouver' },
  { home: 'Bosnia y Herzegovina', away: 'Catar', kickoff: '2026-06-24T14:00', venue: 'Lumen Field, Seattle' },
  // Grupo C
  { home: 'Brasil', away: 'Marruecos', kickoff: '2026-06-13T17:00', venue: 'MetLife Stadium, Nueva York' },
  { home: 'Haití', away: 'Escocia', kickoff: '2026-06-13T20:00', venue: 'Gillette Stadium, Boston' },
  { home: 'Escocia', away: 'Marruecos', kickoff: '2026-06-19T17:00', venue: 'Gillette Stadium, Boston' },
  { home: 'Brasil', away: 'Haití', kickoff: '2026-06-19T19:30', venue: 'Lincoln Financial Field, Filadelfia' },
  { home: 'Escocia', away: 'Brasil', kickoff: '2026-06-24T17:00', venue: 'Hard Rock Stadium, Miami' },
  { home: 'Marruecos', away: 'Haití', kickoff: '2026-06-24T17:00', venue: 'Mercedes-Benz Stadium, Atlanta' },
  // Grupo D
  { home: 'Estados Unidos', away: 'Paraguay', kickoff: '2026-06-12T20:00', venue: 'SoFi Stadium, Los Ángeles' },
  { home: 'Australia', away: 'Turquía', kickoff: '2026-06-13T23:00', venue: 'BC Place, Vancouver' },
  { home: 'Estados Unidos', away: 'Australia', kickoff: '2026-06-19T14:00', venue: 'Lumen Field, Seattle' },
  { home: 'Turquía', away: 'Paraguay', kickoff: '2026-06-19T22:00', venue: "Levi's Stadium, San Francisco" },
  { home: 'Turquía', away: 'Estados Unidos', kickoff: '2026-06-25T21:00', venue: 'SoFi Stadium, Los Ángeles' },
  { home: 'Paraguay', away: 'Australia', kickoff: '2026-06-25T21:00', venue: "Levi's Stadium, San Francisco" },
  // Grupo E
  { home: 'Alemania', away: 'Curazao', kickoff: '2026-06-14T12:00', venue: 'NRG Stadium, Houston' },
  { home: 'Costa de Marfil', away: 'Ecuador', kickoff: '2026-06-14T18:00', venue: 'Lincoln Financial Field, Filadelfia' },
  { home: 'Alemania', away: 'Costa de Marfil', kickoff: '2026-06-20T15:00', venue: 'BMO Field, Toronto' },
  { home: 'Ecuador', away: 'Curazao', kickoff: '2026-06-20T19:00', venue: 'Arrowhead Stadium, Kansas City' },
  { home: 'Curazao', away: 'Costa de Marfil', kickoff: '2026-06-25T15:00', venue: 'Lincoln Financial Field, Filadelfia' },
  { home: 'Ecuador', away: 'Alemania', kickoff: '2026-06-25T15:00', venue: 'MetLife Stadium, Nueva York' },
  // Grupo F
  { home: 'Países Bajos', away: 'Japón', kickoff: '2026-06-14T15:00', venue: 'AT&T Stadium, Dallas' },
  { home: 'Suecia', away: 'Túnez', kickoff: '2026-06-14T21:00', venue: 'Estadio BBVA, Monterrey' },
  { home: 'Países Bajos', away: 'Suecia', kickoff: '2026-06-20T12:00', venue: 'NRG Stadium, Houston' },
  { home: 'Túnez', away: 'Japón', kickoff: '2026-06-20T23:00', venue: 'Estadio BBVA, Monterrey' },
  { home: 'Japón', away: 'Suecia', kickoff: '2026-06-25T18:00', venue: 'AT&T Stadium, Dallas' },
  { home: 'Túnez', away: 'Países Bajos', kickoff: '2026-06-25T18:00', venue: 'Arrowhead Stadium, Kansas City' },
  // Grupo G
  { home: 'Bélgica', away: 'Egipto', kickoff: '2026-06-15T14:00', venue: 'Lumen Field, Seattle' },
  { home: 'Irán', away: 'Nueva Zelanda', kickoff: '2026-06-15T20:00', venue: 'SoFi Stadium, Los Ángeles' },
  { home: 'Bélgica', away: 'Irán', kickoff: '2026-06-21T14:00', venue: 'SoFi Stadium, Los Ángeles' },
  { home: 'Nueva Zelanda', away: 'Egipto', kickoff: '2026-06-21T20:00', venue: 'BC Place, Vancouver' },
  { home: 'Egipto', away: 'Irán', kickoff: '2026-06-26T22:00', venue: 'Lumen Field, Seattle' },
  { home: 'Nueva Zelanda', away: 'Bélgica', kickoff: '2026-06-26T22:00', venue: 'BC Place, Vancouver' },
  // Grupo H
  { home: 'España', away: 'Cabo Verde', kickoff: '2026-06-15T11:00', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'Arabia Saudita', away: 'Uruguay', kickoff: '2026-06-15T17:00', venue: 'Hard Rock Stadium, Miami' },
  { home: 'España', away: 'Arabia Saudita', kickoff: '2026-06-21T11:00', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { home: 'Uruguay', away: 'Cabo Verde', kickoff: '2026-06-21T17:00', venue: 'Hard Rock Stadium, Miami' },
  { home: 'Cabo Verde', away: 'Arabia Saudita', kickoff: '2026-06-26T19:00', venue: 'NRG Stadium, Houston' },
  { home: 'Uruguay', away: 'España', kickoff: '2026-06-26T19:00', venue: 'Estadio Akron, Guadalajara' },
  // Grupo I
  { home: 'Francia', away: 'Senegal', kickoff: '2026-06-16T14:00', venue: 'MetLife Stadium, Nueva York' },
  { home: 'Irak', away: 'Noruega', kickoff: '2026-06-16T17:00', venue: 'Gillette Stadium, Boston' },
  { home: 'Francia', away: 'Irak', kickoff: '2026-06-22T16:00', venue: 'Lincoln Financial Field, Filadelfia' },
  { home: 'Noruega', away: 'Senegal', kickoff: '2026-06-22T19:00', venue: 'MetLife Stadium, Nueva York' },
  { home: 'Noruega', away: 'Francia', kickoff: '2026-06-26T14:00', venue: 'Gillette Stadium, Boston' },
  { home: 'Senegal', away: 'Irak', kickoff: '2026-06-26T14:00', venue: 'BMO Field, Toronto' },
  // Grupo J
  { home: 'Argentina', away: 'Argelia', kickoff: '2026-06-16T20:00', venue: 'Arrowhead Stadium, Kansas City' },
  { home: 'Austria', away: 'Jordania', kickoff: '2026-06-16T23:00', venue: "Levi's Stadium, San Francisco" },
  { home: 'Argentina', away: 'Austria', kickoff: '2026-06-22T12:00', venue: 'AT&T Stadium, Dallas' },
  { home: 'Jordania', away: 'Argelia', kickoff: '2026-06-22T22:00', venue: "Levi's Stadium, San Francisco" },
  { home: 'Argelia', away: 'Austria', kickoff: '2026-06-27T21:00', venue: 'Arrowhead Stadium, Kansas City' },
  { home: 'Jordania', away: 'Argentina', kickoff: '2026-06-27T21:00', venue: 'AT&T Stadium, Dallas' },
  // Grupo K
  { home: 'Portugal', away: 'RD Congo', kickoff: '2026-06-17T12:00', venue: 'NRG Stadium, Houston' },
  { home: 'Uzbekistán', away: 'Colombia', kickoff: '2026-06-17T21:00', venue: 'Estadio Azteca, Ciudad de México' },
  { home: 'Portugal', away: 'Uzbekistán', kickoff: '2026-06-23T12:00', venue: 'NRG Stadium, Houston' },
  { home: 'Colombia', away: 'RD Congo', kickoff: '2026-06-23T21:00', venue: 'Estadio Akron, Guadalajara' },
  { home: 'Colombia', away: 'Portugal', kickoff: '2026-06-27T18:30', venue: 'Hard Rock Stadium, Miami' },
  { home: 'RD Congo', away: 'Uzbekistán', kickoff: '2026-06-27T18:30', venue: 'Mercedes-Benz Stadium, Atlanta' },
  // Grupo L
  { home: 'Inglaterra', away: 'Croacia', kickoff: '2026-06-17T15:00', venue: 'AT&T Stadium, Dallas' },
  { home: 'Ghana', away: 'Panamá', kickoff: '2026-06-17T18:00', venue: 'BMO Field, Toronto' },
  { home: 'Inglaterra', away: 'Ghana', kickoff: '2026-06-23T15:00', venue: 'Gillette Stadium, Boston' },
  { home: 'Panamá', away: 'Croacia', kickoff: '2026-06-23T18:00', venue: 'BMO Field, Toronto' },
  { home: 'Panamá', away: 'Inglaterra', kickoff: '2026-06-27T16:00', venue: 'MetLife Stadium, Nueva York' },
  { home: 'Croacia', away: 'Ghana', kickoff: '2026-06-27T16:00', venue: 'Lincoln Financial Field, Filadelfia' },
];

// Participantes de ejemplo. Personalízalos: agrégalos/edítalos desde la pestaña
// "Tabla" en modo administrador, o cambia esta lista antes del primer arranque.
export const SEED_PARTICIPANTS = ['Ana', 'Bruno', 'Carla', 'Diego'];

// Contraseña personal de ejemplo de cada participante (para registrar sus predicciones).
// CÁMBIALAS: dale a cada quien la suya desde "Tabla" → ⋮ → Editar.
export const PARTICIPANT_PASSWORDS: Record<string, string> = {
  Ana: 'clave-ana',
  Bruno: 'clave-bruno',
  Carla: 'clave-carla',
  Diego: 'clave-diego',
};

// Predicciones iniciales (opcional). El ORDEN importa: refleja quién mandó primero
// su predicción (se usa para desempatar en la tabla) y se traduce en marcas de tiempo
// escalonadas. Por defecto vacío: la polla arranca sin predicciones.
export interface SeedPrediction {
  name: string;
  goals: [number, number];
}

export const OPENER_PREDICTIONS: SeedPrediction[] = [];
export const OPENER_PREDICTIONS_BASE_TIME = '2026-06-11T15:00:00.000Z';

export const MATCH2_PREDICTIONS: SeedPrediction[] = [];
export const MATCH2_PREDICTIONS_BASE_TIME = '2026-06-11T23:30:00.000Z';
