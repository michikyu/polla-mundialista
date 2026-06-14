import { Router } from 'express';
import { db } from '../db';
import { sendResultAlerts } from '../notifier';
import { TEAMS } from '../../shared/teams';
import { KNOCKOUT_BRACKET } from '../../shared/bracket';
import type { Match, MatchStage } from '../../shared/types';

export const syncRouter = Router();

// Código FIFA (MEX, COL, …) → nombre en español como está en la base de datos.
const NAME_BY_CODE = new Map(Object.entries(TEAMS).map(([name, info]) => [info.code, name]));

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Nombres en inglés tal como los devuelve football-data.org → nombre en español.
const NAME_ALIASES = new Map<string, string>(
  Object.entries({
    mexico: 'México',
    'south africa': 'Sudáfrica',
    'south korea': 'Corea del Sur',
    'korea republic': 'Corea del Sur',
    czechia: 'Chequia',
    'czech republic': 'Chequia',
    canada: 'Canadá',
    'bosnia and herzegovina': 'Bosnia y Herzegovina',
    qatar: 'Catar',
    switzerland: 'Suiza',
    brazil: 'Brasil',
    morocco: 'Marruecos',
    haiti: 'Haití',
    scotland: 'Escocia',
    'united states': 'Estados Unidos',
    usa: 'Estados Unidos',
    paraguay: 'Paraguay',
    australia: 'Australia',
    turkey: 'Turquía',
    turkiye: 'Turquía',
    germany: 'Alemania',
    curacao: 'Curazao',
    'ivory coast': 'Costa de Marfil',
    'cote divoire': 'Costa de Marfil',
    ecuador: 'Ecuador',
    netherlands: 'Países Bajos',
    japan: 'Japón',
    sweden: 'Suecia',
    tunisia: 'Túnez',
    belgium: 'Bélgica',
    egypt: 'Egipto',
    iran: 'Irán',
    'new zealand': 'Nueva Zelanda',
    spain: 'España',
    'cape verde': 'Cabo Verde',
    'cabo verde': 'Cabo Verde',
    'saudi arabia': 'Arabia Saudita',
    uruguay: 'Uruguay',
    france: 'Francia',
    senegal: 'Senegal',
    iraq: 'Irak',
    norway: 'Noruega',
    argentina: 'Argentina',
    algeria: 'Argelia',
    austria: 'Austria',
    jordan: 'Jordania',
    portugal: 'Portugal',
    'dr congo': 'RD Congo',
    'congo dr': 'RD Congo',
    uzbekistan: 'Uzbekistán',
    colombia: 'Colombia',
    england: 'Inglaterra',
    croatia: 'Croacia',
    ghana: 'Ghana',
    panama: 'Panamá',
  }),
);

interface ApiTeam {
  name: string | null;
  shortName: string | null;
  tla: string | null;
}

interface ApiMatch {
  utcDate: string;
  status: string;
  stage: string;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: { fullTime: { home: number | null; away: number | null } };
}

function resolveTeamName(team: ApiTeam): string | null {
  if (team.tla && NAME_BY_CODE.has(team.tla)) {
    return NAME_BY_CODE.get(team.tla) as string;
  }
  for (const candidate of [team.name, team.shortName]) {
    if (candidate) {
      const alias = NAME_ALIASES.get(normalize(candidate));
      if (alias) {
        return alias;
      }
    }
  }
  return null;
}

// Día calendario en Colombia de un instante dado (para desambiguar cruces repetidos).
const bogotaDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Fases de football-data.org → fases internas de la app.
const STAGE_MAP: Record<string, MatchStage> = {
  GROUP_STAGE: 'grupos',
  LAST_32: 'dieciseisavos',
  LAST_16: 'octavos',
  QUARTER_FINALS: 'cuartos',
  SEMI_FINALS: 'semifinal',
  THIRD_PLACE: 'tercer_puesto',
  FINAL: 'final',
};

// utcDate (ISO en UTC) → 'YYYY-MM-DDTHH:mm' en hora de Colombia (UTC-5, sin horario de verano),
// que es el formato con que la app guarda y bloquea los partidos.
function toColombiaKickoff(utcDate: string): string {
  const shifted = new Date(new Date(utcDate).getTime() - 5 * 60 * 60_000);
  return shifted.toISOString().slice(0, 16);
}

// Estadio sugerido para un cruce de eliminatoria recién creado: lo toma del bracket oficial
// (misma fase y mismo día). Best-effort: si no hay match único, queda sin estadio.
function venueForKnockout(stage: MatchStage, colombiaKickoff: string): string | null {
  const day = colombiaKickoff.slice(0, 10);
  const sameDay = KNOCKOUT_BRACKET.filter((s) => s.stage === stage && s.kickoff.slice(0, 10) === day);
  return sameDay.length === 1 ? sameDay[0].venue : null;
}

export interface SyncCounts {
  checked: number;
  updated: number;
  created: number;
  unmatched: string[];
}

// Error con código HTTP para que la ruta sepa qué responder.
export class SyncError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Trae resultados de football-data.org: actualiza marcadores y crea los cruces de
// eliminatoria cuando ya tienen equipos definidos. NO manda avisos (eso lo decide quien llama).
// Requiere la variable de entorno FOOTBALL_DATA_TOKEN (registro gratuito).
export async function syncFromFootballData(): Promise<SyncCounts> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    throw new SyncError(
      400,
      'Falta configurar FOOTBALL_DATA_TOKEN. Regístrate gratis en football-data.org y agrega el token como variable de entorno.',
    );
  }

  let apiMatches: ApiMatch[];
  try {
    const response = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': token },
    });
    if (!response.ok) {
      throw new SyncError(502, `football-data.org respondió ${response.status}. Intenta de nuevo en un minuto.`);
    }
    const body = (await response.json()) as { matches?: ApiMatch[] };
    apiMatches = body.matches ?? [];
  } catch (err) {
    if (err instanceof SyncError) {
      throw err;
    }
    throw new SyncError(502, 'No se pudo contactar a football-data.org.');
  }

  const result = await db.execute('SELECT * FROM matches');
  const ourMatches = result.rows as unknown as Match[];

  let updated = 0; // resultados actualizados
  let created = 0; // cruces de eliminatoria creados (con sus equipos ya definidos)
  let checked = 0; // partidos finalizados revisados
  const unmatched: string[] = [];

  // Busca nuestro partido equivalente al de la API: mismo cruce y misma fase
  // (en grupos también el mismo día, por si un cruce se repite en otra ronda).
  const findOurs = (home: string, away: string, stage: MatchStage, apiDay: string): Match | undefined => {
    const candidates = ourMatches.filter(
      (m) => m.home_team === home && m.away_team === away && m.stage === stage,
    );
    if (candidates.length <= 1) {
      return candidates[0];
    }
    return candidates.find((m) => m.kickoff.slice(0, 10) === apiDay);
  };

  for (const apiMatch of apiMatches) {
    const stage = STAGE_MAP[apiMatch.stage] ?? 'grupos';
    const home = resolveTeamName(apiMatch.homeTeam);
    const away = resolveTeamName(apiMatch.awayTeam);
    // Eliminatoria aún sin equipos definidos: se deja el bracket de plantilla.
    if (!home || !away) {
      continue;
    }
    const homeScore = apiMatch.score.fullTime.home;
    const awayScore = apiMatch.score.fullTime.away;
    const finished = apiMatch.status === 'FINISHED' && homeScore !== null && awayScore !== null;
    if (finished) {
      checked += 1;
    }
    const apiDay = bogotaDay.format(new Date(apiMatch.utcDate));
    const match = findOurs(home, away, stage, apiDay);

    if (!match) {
      // No existe: solo creamos cruces de eliminatoria (la fase de grupos ya viene cargada).
      if (stage === 'grupos') {
        if (finished) {
          unmatched.push(`${home} vs ${away}`);
        }
        continue;
      }
      const kickoff = toColombiaKickoff(apiMatch.utcDate);
      await db.execute({
        sql: `INSERT INTO matches (home_team, away_team, kickoff, venue, stage, home_score, away_score, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          home,
          away,
          kickoff,
          venueForKnockout(stage, kickoff),
          stage,
          finished ? homeScore : null,
          finished ? awayScore : null,
          finished ? 'finalizado' : 'pendiente',
        ],
      });
      created += 1;
      continue;
    }

    // Ya existe: actualiza el resultado si terminó y cambió.
    if (finished) {
      const alreadyCorrect =
        match.status === 'finalizado' &&
        match.home_score === homeScore &&
        match.away_score === awayScore;
      if (!alreadyCorrect) {
        await db.execute({
          sql: "UPDATE matches SET home_score = ?, away_score = ?, status = 'finalizado' WHERE id = ?",
          args: [homeScore, awayScore, match.id],
        });
        updated += 1;
      }
    }
  }

  return { checked, updated, created, unmatched };
}

// Ruta del botón 🔄 (solo admin): sincroniza y, si hubo cambios, anuncia al grupo.
syncRouter.post('/', async (_req, res) => {
  try {
    const counts = await syncFromFootballData();
    if (counts.updated > 0 || counts.created > 0) {
      try {
        await sendResultAlerts();
      } catch {
        // No romper la sincronización si la notificación falla.
      }
    }
    res.json(counts);
  } catch (err) {
    const status = err instanceof SyncError ? err.status : 500;
    res.status(status).json({ error: (err as Error).message });
  }
});
