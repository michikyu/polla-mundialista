export type MatchStatus = 'pendiente' | 'cerrado' | 'finalizado';

export type MatchStage =
  | 'grupos'
  | 'dieciseisavos'
  | 'octavos'
  | 'cuartos'
  | 'semifinal'
  | 'tercer_puesto'
  | 'final';

export const STAGE_ORDER: MatchStage[] = [
  'grupos',
  'dieciseisavos',
  'octavos',
  'cuartos',
  'semifinal',
  'tercer_puesto',
  'final',
];

export const STAGE_LABELS: Record<MatchStage, string> = {
  grupos: 'Fase de grupos',
  dieciseisavos: 'Dieciseisavos de final',
  octavos: 'Octavos de final',
  cuartos: 'Cuartos de final',
  semifinal: 'Semifinales',
  tercer_puesto: 'Tercer puesto',
  final: 'Final',
};

export interface Participant {
  id: number;
  name: string;
}

export interface Match {
  id: number;
  home_team: string;
  away_team: string;
  kickoff: string;
  venue: string | null;
  home_score: number | null;
  away_score: number | null;
  home_penalties?: number | null;
  away_penalties?: number | null;
  status: MatchStatus;
  stage: MatchStage;
  predictions_count?: number;
}

// Los goles llegan en null cuando la predicción es de otra persona y el partido
// no ha empezado (las predicciones son secretas hasta el inicio).
export interface Prediction {
  id: number;
  participant_id: number;
  match_id: number;
  home_goals: number | null;
  away_goals: number | null;
  created_at: string | null;
  updated_at: string | null;
  points: number | null;
}

export interface MatchPredictionRow {
  participant_id: number;
  participant_name: string;
  home_goals: number | null;
  away_goals: number | null;
  has_prediction: boolean;
  predicted_at: string | null;
  points: number | null;
}

export interface MatchDetail {
  match: Match;
  predictions: MatchPredictionRow[];
}

export interface StandingRow {
  participant_id: number;
  name: string;
  points: number;
  exact_hits: number;
  outcome_hits: number;
  misses: number;
  handicap: number;
}
