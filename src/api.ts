import type { Match, MatchDetail, Participant, Prediction, StandingRow } from '../shared/types';
import type { ScoringConfig } from '../shared/scoring';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser';

export interface AppSettings {
  title: string | null;
  telegram_link: string | null;
  football_configured: boolean;
  scoring: ScoringConfig;
  passkey_enabled: boolean;
}

const PASSWORD_KEY = 'polla-admin-password';
const PARTICIPANT_AUTH_KEY = 'polla-participant-auth';

export interface ParticipantAuth {
  id: number;
  password: string;
}

export function getStoredPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) ?? '';
}

export function setStoredPassword(password: string): void {
  localStorage.setItem(PASSWORD_KEY, password);
}

export function clearStoredPassword(): void {
  localStorage.removeItem(PASSWORD_KEY);
}

export function getParticipantAuth(): ParticipantAuth | null {
  try {
    const raw = localStorage.getItem(PARTICIPANT_AUTH_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as ParticipantAuth;
    return Number.isInteger(parsed.id) && typeof parsed.password === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function setParticipantAuth(auth: ParticipantAuth): void {
  localStorage.setItem(PARTICIPANT_AUTH_KEY, JSON.stringify(auth));
}

export function clearParticipantAuth(): void {
  localStorage.removeItem(PARTICIPANT_AUTH_KEY);
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const password = getStoredPassword();
  if (password) {
    headers['x-admin-password'] = password;
  }
  const participantAuth = getParticipantAuth();
  if (participantAuth) {
    headers['x-participant-password'] = participantAuth.password;
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getAuthStatus: () => request<{ required: boolean; admin: boolean }>('/api/auth/status'),
  checkPassword: (password: string) =>
    request<{ ok: boolean }>('/api/auth/check', { method: 'POST', body: JSON.stringify({ password }) }),
  checkParticipantPassword: (participantId: number, password: string) =>
    request<{ ok: boolean }>('/api/auth/participant-check', {
      method: 'POST',
      body: JSON.stringify({ participant_id: participantId, password }),
    }),

  getParticipants: () => request<Participant[]>('/api/participants'),
  createParticipant: (name: string, password?: string, handicap?: number) =>
    request<Participant>('/api/participants', {
      method: 'POST',
      body: JSON.stringify({ name, password, handicap }),
    }),
  updateParticipant: (id: number, name: string, password?: string, handicap?: number) =>
    request<Participant>(`/api/participants/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, password, handicap }),
    }),
  deleteParticipant: (id: number) =>
    request<{ ok: boolean }>(`/api/participants/${id}`, { method: 'DELETE' }),

  getMatches: () => request<Match[]>('/api/matches'),
  getMatchDetail: (id: number) => request<MatchDetail>(`/api/matches/${id}`),
  createMatch: (data: { home_team: string; away_team: string; kickoff: string; venue: string; stage: string }) =>
    request<Match>('/api/matches', { method: 'POST', body: JSON.stringify(data) }),
  updateMatch: (
    id: number,
    data: { home_team: string; away_team: string; kickoff: string; venue: string; stage: string },
  ) => request<Match>(`/api/matches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  reopenMatch: (id: number) =>
    request<Match>(`/api/matches/${id}/reopen`, { method: 'POST' }),
  registerResult: (id: number, homeScore: number, awayScore: number) =>
    request<Match>(`/api/matches/${id}/result`, {
      method: 'POST',
      body: JSON.stringify({ home_score: homeScore, away_score: awayScore }),
    }),
  deleteMatch: (id: number) => request<{ ok: boolean }>(`/api/matches/${id}`, { method: 'DELETE' }),

  getPredictions: (participantId: number) =>
    request<Prediction[]>(`/api/predictions?participant_id=${participantId}`),
  savePrediction: (data: { participant_id: number; match_id: number; home_goals: number; away_goals: number }) =>
    request<Prediction>('/api/predictions', { method: 'PUT', body: JSON.stringify(data) }),

  getStandings: () => request<StandingRow[]>('/api/standings'),

  getBackup: () => request<Record<string, unknown>>('/api/backup'),
  restoreBackup: (data: unknown) =>
    request<{ ok: boolean; restored: { participants: number; matches: number; predictions: number } }>(
      '/api/backup',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  getSettings: () => request<AppSettings>('/api/settings'),
  updateSettings: (data: {
    title?: string;
    telegram_link?: string;
    football_token?: string;
    scoring?: Partial<ScoringConfig>;
  }) =>
    request<AppSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Passkey / huella (WebAuthn) — admin y participantes.
  webauthnRegisterOptions: (participantId?: number) =>
    request<PublicKeyCredentialCreationOptionsJSON>('/api/webauthn/register/options', {
      method: 'POST',
      body: JSON.stringify({ participantId }),
    }),
  webauthnRegisterVerify: (response: RegistrationResponseJSON) =>
    request<{ verified: boolean }>('/api/webauthn/register/verify', {
      method: 'POST',
      body: JSON.stringify(response),
    }),
  webauthnLoginOptions: () =>
    request<PublicKeyCredentialRequestOptionsJSON>('/api/webauthn/login/options', { method: 'POST' }),
  webauthnLoginVerify: (response: AuthenticationResponseJSON) =>
    request<{
      verified: boolean;
      role: 'admin' | 'participant';
      participantId?: number;
      secret: string;
    }>('/api/webauthn/login/verify', {
      method: 'POST',
      body: JSON.stringify(response),
    }),

  syncResults: () =>
    request<{ checked: number; updated: number; created: number; unmatched: string[] }>('/api/sync-results', {
      method: 'POST',
    }),

  // Mini-juego "Tiro al arco": tabla de mejores puntajes y envío del propio puntaje.
  getHighscores: () =>
    request<Array<{ participant_id: number; name: string; score: number }>>('/api/game/highscores'),
  submitGameScore: (participantId: number, score: number) =>
    request<{ best: number }>('/api/game/score', {
      method: 'POST',
      body: JSON.stringify({ participant_id: participantId, score }),
    }),
};
