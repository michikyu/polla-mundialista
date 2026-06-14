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
import { ADMIN_PASSWORD } from '../auth';
import { getSetting, setSetting } from './settings';

export const webauthnRouter = Router();

const RP_NAME = 'Polla Mundialística';
const CHALLENGE_KEY = 'webauthn_challenge';
// Un solo "usuario admin" para las passkeys (la app tiene un solo administrador).
const ADMIN_USER_ID = 'polla-admin';

// rpID = dominio (sin protocolo ni puerto); origin = URL completa de la página.
// Se derivan del request para que sirva igual en localhost y en producción.
function relyingParty(req: Request): { rpID: string; origin: string } {
  const origin = req.headers.origin ?? `https://${req.headers.host}`;
  return { rpID: new URL(origin).hostname, origin };
}

interface CredentialRow {
  id: string;
  public_key: string;
  counter: number;
  transports: string | null;
}

async function loadCredentials(): Promise<CredentialRow[]> {
  const result = await db.execute('SELECT id, public_key, counter, transports FROM webauthn_credentials');
  return result.rows as unknown as CredentialRow[];
}

function parseTransports(value: string | null): AuthenticatorTransportFuture[] {
  try {
    return value ? (JSON.parse(value) as AuthenticatorTransportFuture[]) : [];
  } catch {
    return [];
  }
}

// --- Registro (requiere admin; lo protege app.ts porque es POST y no es /login) ---
webauthnRouter.post('/register/options', async (req, res) => {
  const { rpID } = relyingParty(req);
  const existing = await loadCredentials();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: 'Administrador',
    userID: new TextEncoder().encode(ADMIN_USER_ID),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: parseTransports(c.transports) })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await setSetting(CHALLENGE_KEY, options.challenge);
  res.json(options);
});

webauthnRouter.post('/register/verify', async (req, res) => {
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
    sql: `INSERT INTO webauthn_credentials (id, public_key, counter, transports, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET public_key = excluded.public_key, counter = excluded.counter`,
    args: [
      credential.id,
      isoBase64URL.fromBuffer(credential.publicKey),
      credential.counter,
      JSON.stringify(credential.transports ?? []),
      new Date().toISOString(),
    ],
  });
  await setSetting(CHALLENGE_KEY, '');
  res.json({ verified: true });
});

// --- Login (público; app.ts deja pasar /webauthn/login sin contraseña) ---
webauthnRouter.post('/login/options', async (req, res) => {
  const { rpID } = relyingParty(req);
  const creds = await loadCredentials();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({ id: c.id, transports: parseTransports(c.transports) })),
    userVerification: 'preferred',
  });
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
  // La passkey ya validó al admin: devolvemos la contraseña para que el cliente la
  // guarde y siga usando el mismo mecanismo (header x-admin-password) sin cambios.
  res.json({ verified: true, adminPassword: ADMIN_PASSWORD });
});
