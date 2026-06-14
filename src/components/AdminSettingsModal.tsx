import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
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
  const [backupMsg, setBackupMsg] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const handleDownload = async () => {
    setError('');
    setBackupMsg('');
    try {
      const data = await api.getBackup();
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo-polla-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg('✅ Respaldo descargado.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRestore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!window.confirm('⚠️ Esto REEMPLAZARÁ todos los datos actuales (participantes, partidos y predicciones) por los del archivo. ¿Continuar?')) {
      return;
    }
    setError('');
    setBackupMsg('');
    try {
      const data = JSON.parse(await file.text());
      const result = await api.restoreBackup(data);
      setBackupMsg(`✅ Restaurado: ${result.restored.participants} participantes, ${result.restored.predictions} predicciones.`);
    } catch (err) {
      setError('No se pudo restaurar: ' + (err as Error).message);
    }
  };

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

        <div className="settings-backup">
          <span className="settings-label">💾 Respaldo de datos</span>
          <span className="settings-help">
            Descarga un archivo con todas las predicciones y participantes. Hazlo cada cierto tiempo
            (la base en la nube no tiene copia automática). Para recuperar, sube ese archivo.
          </span>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => void handleDownload()}>⬇️ Descargar respaldo</button>
            <button type="button" className="btn" onClick={() => fileInput.current?.click()}>↩️ Restaurar</button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => void handleRestore(e)}
            />
          </div>
          {backupMsg && <p className="muted hint">{backupMsg}</p>}
        </div>
      </div>
    </div>
  );
}
