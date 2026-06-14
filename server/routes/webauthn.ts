import { Router, type Request } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { db } from '../db';
import { ADMIN_PASSWORD, isAdminPassword, participantPasswordMatches } from '../auth';
import { asId } from '../validate';
import { getSetting, setSetting } from './settings';

export const webauthnRouter = Router();

const RP_NAME = 'Polla Mundialística';
const CHALLENGE_KEY = 'webauthn_challenge';
const REG_OWNER_KEY = 'webauthn_reg_owner';

function relyingParty(req: Request): { rpID: string; origin: string } {
  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  return { rpID: new URL(origin).hostname, origin };
}

interface CredentialRow {
  id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  participant_id: number | null;
}

async function loadCredentials(): Promise<CredentialRow[]> {
  const result = await db.execute(
    'SELECT id, public_key, counter, transports, participant_id FROM webauthn_credentials',
  );
  return result.rows as unknown as CredentialRow[];
}

function parseTransports(value: string | null): AuthenticatorTransportFuture[] {
  try {
    return value ? (JSON.parse(value) as AuthenticatorTransportFuture[]) : [];
  } catch {
    return [];
  }
}

// Identidad de quien registra: admin (sin participantId) o un participante (con su contraseña).
interface Registrant {
  participantId: number | null;
  userName: string;
  userId: string;
}

async function resolveRegistrant(req: Request, participantId: number | null): Promise<Registrant | null> {
  if (participantId !== null) {
    const ok = await participantPasswordMatches(participantId, req.header('x-participant-password'));
    if (!ok) {
      return null;
    }
    const row = await db.execute({ sql: 'SELECT name FROM participants WHERE id = ?', args: [participantId] });
    const name = String(row.rows[0]?.name ?? `Jugador ${participantId}`);
    return { participantId, userName: name, userId: `participant-${participantId}` };
  }
  if (isAdminPassword(req.header('x-admin-password'))) {
    return { participantId: null, userName: 'Administrador', userId: 'polla-admin' };
  }
  return null;
}

// --- Registro (admin o participante; app.ts deja pasar /webauthn/* y se valida aquí) ---
webauthnRouter.post('/register/options', async (req, res) => {
  const participantId = asId((req.body as Record<string, unknown>)?.participantId);
  const registrant = await resolveRegistrant(req, participantId);
  if (!registrant) {
    res.status(401).json({ error: 'No autorizado para registrar una passkey.' });
    return;
  }
  const { rpID } = relyingParty(req);
  const existing = await loadCredentials();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: registrant.userName,
    userID: new TextEncoder().encode(registrant.userId),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: parseTransports(c.transports) })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
  await setSetting(CHALLENGE_KEY, options.challenge);
  await setSetting(REG_OWNER_KEY, registrant.participantId === null ? 'admin' : String(registrant.participantId));
  res.json(options);
});

webauthnRouter.post('/register/verify', async (req, res) => {
  const ownerStr = await getSetting(REG_OWNER_KEY);
  const owner = ownerStr === null || ownerStr === 'admin' ? null : Number(ownerStr);
  // Re-valida que quien verifica sea el mismo dueño que pidió las opciones.
  const registrant = await resolveRegistrant(req, owner);
  if (!registrant || ownerStr === null) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }
  const { rpID, origin } = relyingParty(req);
  const expectedChallenge = await getSetting(CHALLENGE_KEY);
  if (!expectedChallenge) {
    res.status(400).json({ error: 'No hay un registro en curso. Intenta de nuevo.' });
    return;
  }
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: req.body as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }
  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: 'No se pudo verificar la huella/passkey.' });
    return;
  }
  const { credential } = verification.registrationInfo;
  await db.execute({
    sql: `INSERT INTO webauthn_credentials (id, public_key, counter, transports, participant_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET public_key = excluded.public_key, counter = excluded.counter,
                                         participant_id = excluded.participant_id`,
    args: [
      credential.id,
      isoBase64URL.fromBuffer(credential.publicKey),
      credential.counter,
      JSON.stringify(credential.transports ?? []),
      owner,
      new Date().toISOString(),
    ],
  });
  await setSetting(CHALLENGE_KEY, '');
  await setSetting(REG_OWNER_KEY, '');
  res.json({ verified: true });
});

// --- Login (público): passkey descubrible; la credencial dice quién es. ---
webauthnRouter.post('/login/options', async (req, res) => {
  const { rpID } = relyingParty(req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
  await setSetting(CHALLENGE_KEY, options.challenge);
  res.json(options);
});

webauthnRouter.post('/login/verify', async (req, res) => {
  const { rpID, origin } = relyingParty(req);
  const response = req.body as AuthenticationResponseJSON;
  const expectedChallenge = await getSetting(CHALLENGE_KEY);
  if (!expectedChallenge) {
    res.status(400).json({ error: 'No hay un inicio de sesión en curso. Intenta de nuevo.' });
    return;
  }
  const creds = await loadCredentials();
  const cred = creds.find((c) => c.id === response.id);
  if (!cred) {
    res.status(400).json({ error: 'Esta huella/passkey no está registrada.' });
    return;
  }
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.id,
        publicKey: isoBase64URL.toBuffer(cred.public_key),
        counter: cred.counter,
        transports: parseTransports(cred.transports),
      },
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }
  if (!verification.verified) {
    res.status(401).json({ error: 'No se pudo verificar la huella/passkey.' });
    return;
  }
  await db.execute({
    sql: 'UPDATE webauthn_credentials SET counter = ? WHERE id = ?',
    args: [verification.authenticationInfo.newCounter, cred.id],
  });
  await setSetting(CHALLENGE_KEY, '');

  // La passkey ya validó a la persona: se devuelve la "llave" para reusar el mecanismo actual.
  if (cred.participant_id === null) {
    res.json({ verified: true, role: 'admin', secret: ADMIN_PASSWORD });
    return;
  }
  const row = await db.execute({
    sql: 'SELECT password FROM participants WHERE id = ?',
    args: [cred.participant_id],
  });
  const password = row.rows[0]?.password as string | undefined;
  if (!password) {
    res.status(400).json({ error: 'El participante de esta passkey ya no existe.' });
    return;
  }
  res.json({ verified: true, role: 'participant', participantId: cred.participant_id, secret: password });
});
