import { useEffect, useState, type FormEvent } from 'react';
import { startAuthentication, browserSupportsWebAuthnAutofill } from '@simplewebauthn/browser';
import type { Participant } from '../../shared/types';
import { api, setStoredPassword, setParticipantAuth } from '../api';

interface Props {
  participants: Participant[];
  passkeyEnabled: boolean;
  onAdminLoggedIn: () => void;
  onParticipantLoggedIn: (id: number) => void;
  onClose: () => void;
}

const ADMIN = 'admin';

export function LoginModal({
  participants,
  passkeyEnabled,
  onAdminLoggedIn,
  onParticipantLoggedIn,
  onClose,
}: Props) {
  const [who, setWho] = useState<string>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Autocompletado de passkey (admin): el navegador la ofrece sola al enfocar el campo.
  useEffect(() => {
    if (!passkeyEnabled) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (!(await browserSupportsWebAuthnAutofill())) {
          return;
        }
        const optionsJSON = await api.webauthnLoginOptions();
        const response = await startAuthentication({ optionsJSON, useBrowserAutofill: true });
        if (cancelled) {
          return;
        }
        const result = await api.webauthnLoginVerify(response);
        if (cancelled || !result.verified) {
          return;
        }
        if (result.role === 'participant' && result.participantId) {
          setParticipantAuth({ id: result.participantId, password: result.secret });
          onParticipantLoggedIn(result.participantId);
        } else {
          setStoredPassword(result.secret);
          onAdminLoggedIn();
        }
      } catch {
        // cancelado / no soportado: se ignora
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [passkeyEnabled, onAdminLoggedIn, onParticipantLoggedIn]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!who) {
      setError('Elige quién eres.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (who === ADMIN) {
        const result = await api.checkPassword(password);
        if (result.ok) {
          setStoredPassword(password);
          onAdminLoggedIn();
        } else {
          setError('Contraseña de administrador incorrecta.');
        }
      } else {
        const id = Number(who);
        const result = await api.checkParticipantPassword(id, password);
        if (result.ok) {
          setParticipantAuth({ id, password });
          onParticipantLoggedIn(id);
        } else {
          setError('Contraseña incorrecta.');
        }
      }
    } catch {
      setError('No se pudo verificar la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Entrar" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔑 Entrar</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <form className="settings-form" onSubmit={handleSubmit}>
          <label className="settings-field">
            <span className="settings-label">¿Quién eres?</span>
            <select value={who} onChange={(e) => setWho(e.target.value)} autoFocus>
              <option value="">Elige…</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value={ADMIN}>🔒 Administrador</option>
            </select>
          </label>

          <label className="settings-field">
            <span className="settings-label">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password webauthn"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
            />
            {passkeyEnabled && who === ADMIN && (
              <span className="settings-help">
                🔐 Si registraste tu huella/Face ID, el navegador te la ofrecerá al tocar el campo.
              </span>
            )}
          </label>

          {error && <p className="error">{error}</p>}

          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
