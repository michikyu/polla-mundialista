import { useState, type FormEvent } from 'react';
import { api } from '../api';

interface Props {
  currentTitle: string;
  currentTelegramLink: string;
  footballConfigured: boolean;
  onSaved: (settings: { title: string | null; telegram_link: string | null; football_configured: boolean }) => void;
  onClose: () => void;
}

export function AdminSettingsModal({
  currentTitle,
  currentTelegramLink,
  footballConfigured,
  onSaved,
  onClose,
}: Props) {
  const [title, setTitle] = useState(currentTitle);
  const [telegramLink, setTelegramLink] = useState(currentTelegramLink);
  const [footballToken, setFootballToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data: { title?: string; telegram_link?: string; football_token?: string } = {
        title: title.trim(),
        telegram_link: telegramLink.trim(),
      };
      if (footballToken.trim()) {
        data.football_token = footballToken.trim();
      }
      const result = await api.updateSettings(data);
      onSaved(result);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Configuración" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Configuración</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <form className="settings-form" onSubmit={handleSubmit}>
          <label className="settings-field">
            <span className="settings-label">📛 Título de la polla</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className="settings-field">
            <span className="settings-label">⚽ Token de football-data.org (resultados automáticos)</span>
            <input
              type="text"
              value={footballToken}
              onChange={(e) => setFootballToken(e.target.value)}
              placeholder={footballConfigured ? '•••••••• (ya configurado — escribe para cambiarlo)' : 'Pega aquí tu token'}
            />
            <span className="settings-help">
              Regístrate gratis en{' '}
              <a href="https://www.football-data.org/client/register" target="_blank" rel="noopener noreferrer">
                football-data.org
              </a>
              ; te llega un token por correo. Pégalo aquí y los resultados se actualizarán solos.
            </span>
          </label>

          <label className="settings-field">
            <span className="settings-label">💬 Link del grupo de Telegram (acceso rápido)</span>
            <input
              type="text"
              value={telegramLink}
              onChange={(e) => setTelegramLink(e.target.value)}
              placeholder="https://t.me/+..."
            />
            <span className="settings-help">
              En Telegram: abre el grupo → nombre del grupo → <em>Invite Link</em> → copia y pégalo aquí.
              Aparecerá un botón para que todos entren al grupo. Para las alertas automáticas también
              necesitas las variables <code>TELEGRAM_BOT_TOKEN</code> y <code>TELEGRAM_CHAT_ID</code> (ver README).
            </span>
          </label>

          {error && <p className="error">{error}</p>}

          <div className="row-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
