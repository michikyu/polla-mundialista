import { useEffect, useState, type FormEvent } from 'react';
import { startAuthentication, browserSupportsWebAuthnAutofill } from '@simplewebauthn/browser';
import { api, setStoredPassword } from '../api';

interface Props {
  passkeyEnabled: boolean;
  onLoggedIn: () => void;
  onClose: () => void;
}

export function LoginModal({ passkeyEnabled, onLoggedIn, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Arma el autocompletado de passkey: el navegador la ofrece sola al enfocar el campo.
  // Si el usuario escribe la contraseña, simplemente la ignora.
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
        if (result.verified) {
          setStoredPassword(result.adminPassword);
          onLoggedIn();
        }
      } catch {
        // El usuario canceló o el navegador abortó el autocompletado: se ignora.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [passkeyEnabled, onLoggedIn]);

  const handlePassword = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.checkPassword(password);
      if (result.ok) {
        setStoredPassword(password);
        onLoggedIn();
      } else {
        setError('Contraseña incorrecta.');
      }
    } catch {
      setError('No se pudo verificar la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Entrar como administrador" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔒 Entrar como administrador</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <form className="settings-form" onSubmit={handlePassword}>
          <label className="settings-field">
            <span className="settings-label">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password webauthn"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña de administrador"
              autoFocus
            />
            {passkeyEnabled && (
              <span className="settings-help">
                🔐 Si registraste tu huella/Face ID en este dispositivo, el navegador te la ofrecerá al
                tocar el campo — no necesitas escribir nada.
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
