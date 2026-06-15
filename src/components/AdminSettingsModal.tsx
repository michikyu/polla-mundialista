import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { api, type AppSettings } from '../api';
import type { ScoringConfig } from '../../shared/scoring';

const GAME_ENABLED = import.meta.env.VITE_ENABLE_GAME === 'true';

// Reduce la imagen a máx. 256px y la comprime a WebP: queda en pocos KB.
function fileToScaledDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        // WebP si el navegador lo soporta; si no, PNG.
        const webp = canvas.toDataURL('image/webp', 0.8);
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface Props {
  currentTitle: string;
  currentTelegramLink: string;
  footballConfigured: boolean;
  currentScoring: ScoringConfig;
  onSaved: (settings: AppSettings) => void;
  onPasskeyRegistered: () => void;
  onClose: () => void;
}

export function AdminSettingsModal({
  currentTitle,
  currentTelegramLink,
  footballConfigured,
  currentScoring,
  onSaved,
  onPasskeyRegistered,
  onClose,
}: Props) {
  const [title, setTitle] = useState(currentTitle);
  const [telegramLink, setTelegramLink] = useState(currentTelegramLink);
  const [footballToken, setFootballToken] = useState('');
  const [scoring, setScoring] = useState<ScoringConfig>(currentScoring);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [backupMsg, setBackupMsg] = useState('');
  const [passkeyMsg, setPasskeyMsg] = useState('');
  const [telegramMsg, setTelegramMsg] = useState('');
  const [telegramBusy, setTelegramBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleSetupTelegram = async () => {
    setTelegramMsg('');
    setError('');
    setTelegramBusy(true);
    try {
      const result = await api.setupTelegram();
      if (result.ok) {
        setTelegramMsg('✅ Comandos activados. Prueba /ayuda en el grupo.');
      } else {
        setError('No se pudieron activar: ' + (result.error ?? result.webhook ?? 'revisa el token del bot.'));
      }
    } catch (err) {
      setError('No se pudieron activar: ' + (err as Error).message);
    } finally {
      setTelegramBusy(false);
    }
  };
  const [stickers, setStickers] = useState<number[]>([]);
  const [stickerMsg, setStickerMsg] = useState('');
  const [stickerBusy, setStickerBusy] = useState(false);
  const stickerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!GAME_ENABLED) {
      return;
    }
    api.getStickers().then((l) => setStickers(l.map((s) => s.id))).catch(() => {});
  }, []);

  const handleAddStickers = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }
    setStickerBusy(true);
    setStickerMsg('');
    setError('');
    try {
      let added = 0;
      for (const file of files) {
        const dataUrl = await fileToScaledDataUrl(file);
        await api.addSticker(dataUrl, 'image/png');
        added += 1;
      }
      const list = await api.getStickers();
      setStickers(list.map((s) => s.id));
      setStickerMsg(`✅ ${added} imagen${added === 1 ? '' : 'es'} añadida${added === 1 ? '' : 's'}.`);
    } catch (err) {
      setError('No se pudo subir la imagen: ' + (err as Error).message);
    } finally {
      setStickerBusy(false);
    }
  };

  const handleDeleteSticker = async (id: number) => {
    if (!window.confirm('¿Eliminar esta imagen del mini-juego?')) {
      return;
    }
    setStickerMsg('');
    setError('');
    try {
      await api.deleteSticker(id);
      setStickers((prev) => prev.filter((s) => s !== id));
    } catch (err) {
      setError('No se pudo eliminar: ' + (err as Error).message);
    }
  };

  const handleRegisterPasskey = async () => {
    setError('');
    setPasskeyMsg('');
    try {
      const optionsJSON = await api.webauthnRegisterOptions();
      const response = await startRegistration({ optionsJSON });
      await api.webauthnRegisterVerify(response);
      setPasskeyMsg('✅ Huella/passkey registrada. Ya puedes entrar con ella desde el candado.');
      onPasskeyRegistered();
    } catch (err) {
      const msg = (err as Error).message || '';
      if (/abort|cancel|NotAllowed/i.test(msg)) {
        return; // el usuario canceló el diálogo
      }
      setError('No se pudo registrar la huella/passkey: ' + msg);
    }
  };

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
      const data: {
        title?: string;
        telegram_link?: string;
        football_token?: string;
        scoring?: ScoringConfig;
      } = {
        title: title.trim(),
        telegram_link: telegramLink.trim(),
        scoring,
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

          <div className="settings-field">
            <span className="settings-label">🏆 Puntos por acierto</span>
            <div className="scoring-grid">
              {([
                ['exactUnique', 'Exacto único'],
                ['exactShared', 'Exacto repetido'],
                ['outcome', 'Ganador/empate'],
                ['miss', 'Fallo'],
              ] as Array<[keyof ScoringConfig, string]>).map(([key, label]) => (
                <label key={key} className="scoring-item">
                  <span>{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={scoring[key]}
                    onChange={(e) => setScoring({ ...scoring, [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
            <span className="settings-help">
              ⚠️ Cambiar los puntos <strong>recalcula la tabla de todos retroactivamente</strong>. Lo ideal
              es no tocarlos con el torneo en curso.
            </span>
          </div>

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

        <div className="settings-backup">
          <span className="settings-label">🔐 Huella / passkey (entrar sin contraseña)</span>
          <span className="settings-help">
            Registra la huella, Face ID o el PIN de <strong>este dispositivo</strong> para entrar como
            admin sin escribir la contraseña. Repítelo en cada dispositivo que quieras usar.
          </span>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => void handleRegisterPasskey()}>
              🔐 Registrar huella/passkey
            </button>
          </div>
          {passkeyMsg && <p className="muted hint">{passkeyMsg}</p>}
        </div>

        <div className="settings-backup">
          <span className="settings-label">🤖 Comandos del bot de Telegram</span>
          <span className="settings-help">
            Activa los comandos <code>/tabla</code>, <code>/proximos</code>, <code>/resultados</code>,{' '}
            <code>/faltan</code>, <code>/puntaje</code> y <code>/ayuda</code> en el grupo. Hazlo una vez (o
            de nuevo si cambia la dirección del sitio). Requiere las variables del bot ya configuradas.
          </span>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => void handleSetupTelegram()} disabled={telegramBusy}>
              {telegramBusy ? 'Activando…' : '🤖 Activar / actualizar comandos'}
            </button>
          </div>
          {telegramMsg && <p className="muted hint">{telegramMsg}</p>}
        </div>

        {GAME_ENABLED && (
          <div className="settings-backup">
            <span className="settings-label">🎯 Imágenes del mini-juego (Tiro al arco)</span>
            <span className="settings-help">
              Estas son las imágenes que aparecen como blancos en el arco. Añade o elimina las que
              quieras (se reducen a 512px automáticamente).
            </span>
            {stickers.length === 0 ? (
              <p className="muted hint">Aún no hay imágenes. Añade algunas abajo.</p>
            ) : (
              <div className="sticker-grid">
                {stickers.map((id) => (
                  <div key={id} className="sticker-cell">
                    <img src={`/api/game/stickers/${id}`} alt={`Imagen ${id}`} loading="lazy" />
                    <button
                      type="button"
                      className="sticker-del"
                      onClick={() => void handleDeleteSticker(id)}
                      aria-label="Eliminar imagen"
                      title="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="row-actions">
              <button
                type="button"
                className="btn"
                onClick={() => stickerInput.current?.click()}
                disabled={stickerBusy}
              >
                {stickerBusy ? 'Subiendo…' : '➕ Añadir imágenes'}
              </button>
              <input
                ref={stickerInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => void handleAddStickers(e)}
              />
            </div>
            {stickerMsg && <p className="muted hint">{stickerMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
