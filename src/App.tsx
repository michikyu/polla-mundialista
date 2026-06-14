import { useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import type { Participant } from '../shared/types';
import { api, clearStoredPassword, setStoredPassword, getParticipantAuth } from './api';
import { APP_TITLE } from './appConfig';
import { BallIcon } from './components/BallIcon';
import { RulesModal } from './components/RulesModal';
import { AdminSettingsModal } from './components/AdminSettingsModal';
import { DEFAULT_SCORING, type ScoringConfig } from '../shared/scoring';
import { SplashScreen } from './components/SplashScreen';
import { DashboardView } from './views/DashboardView';
import { MatchesView } from './views/MatchesView';
import { PredictionsView } from './views/PredictionsView';
import { StandingsView } from './views/StandingsView';
import { MundialView } from './views/MundialView';
import { MatchDetailView } from './views/MatchDetailView';

type View = 'dashboard' | 'matches' | 'predictions' | 'standings' | 'mundial' | 'matchDetail';

const colombiaTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function getColombiaTime(): string {
  return colombiaTimeFormatter.format(new Date());
}

const NAV_ITEMS: Array<{ view: View; label: string; icon: string }> = [
  { view: 'dashboard', label: 'Inicio', icon: '🏠' },
  { view: 'predictions', label: 'Predicciones', icon: '🎯' },
  { view: 'standings', label: 'Tabla', icon: '🏆' },
  { view: 'mundial', label: 'Mundial', icon: '🌎' },
  { view: 'matches', label: 'Partidos', icon: '📅' },
];

const PARTICIPANT_KEY = 'polla-participant-id';

export function App() {
  const [view, setView] = useState<View>('dashboard');
  const [matchId, setMatchId] = useState<number | null>(null);
  const [backView, setBackView] = useState<View>('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [title, setTitle] = useState(APP_TITLE);
  const [telegramLink, setTelegramLink] = useState('');
  const [footballConfigured, setFootballConfigured] = useState(false);
  const [scoring, setScoring] = useState<ScoringConfig>(DEFAULT_SCORING);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [colombiaTime, setColombiaTime] = useState(getColombiaTime);
  const [participantId, setParticipantId] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem(PARTICIPANT_KEY));
    return Number.isInteger(saved) && saved > 0 ? saved : null;
  });

  useEffect(() => {
    document.title = title;
  }, [title]);

  // Configuración guardada por el admin (en la base): título, link de Telegram, etc.
  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        if (s.title) {
          setTitle(s.title);
        }
        setTelegramLink(s.telegram_link ?? '');
        setFootballConfigured(s.football_configured);
        setScoring(s.scoring);
        setPasskeyEnabled(s.passkey_enabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => setIsAdmin(status.admin))
      .catch(() => {});
  }, []);

  // Para mostrar el nombre de quien tiene sesión de participante.
  useEffect(() => {
    api.getParticipants().then(setParticipants).catch(() => {});
  }, []);

  useEffect(() => {
    const tick = () => setColombiaTime(getColombiaTime());
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    const timeout = setTimeout(() => {
      tick();
      const interval = setInterval(tick, 60_000);
      return () => clearInterval(interval);
    }, msToNextMinute);
    return () => clearTimeout(timeout);
  }, []);

  const openMatch = (id: number) => {
    setBackView(view);
    setMatchId(id);
    setView('matchDetail');
  };

  const selectParticipant = (id: number | null) => {
    setParticipantId(id);
    if (id !== null) {
      localStorage.setItem(PARTICIPANT_KEY, String(id));
    }
  };

  const openParticipant = (id: number) => {
    selectParticipant(id);
    setView('predictions');
  };

  const handleLockClick = async () => {
    if (isAdmin) {
      if (window.confirm('¿Salir del modo administrador?')) {
        clearStoredPassword();
        setIsAdmin(false);
      }
      return;
    }
    const password = window.prompt('Contraseña de administrador:');
    if (!password) {
      return;
    }
    try {
      const result = await api.checkPassword(password);
      if (result.ok) {
        setStoredPassword(password);
        setIsAdmin(true);
      } else {
        window.alert('Contraseña incorrecta.');
      }
    } catch {
      window.alert('No se pudo verificar la contraseña.');
    }
  };

  const handlePasskeyLogin = async () => {
    try {
      const optionsJSON = await api.webauthnLoginOptions();
      const response = await startAuthentication({ optionsJSON });
      const result = await api.webauthnLoginVerify(response);
      if (result.verified) {
        setStoredPassword(result.adminPassword);
        setIsAdmin(true);
      }
    } catch (err) {
      const msg = (err as Error).message || '';
      // Si el usuario cancela el diálogo de huella, no mostramos error.
      if (!/abort|cancel|NotAllowed/i.test(msg)) {
        window.alert('No se pudo entrar con la huella/passkey.');
      }
    }
  };

  // Etiqueta de la sesión actual (admin / participante / invitado).
  const participantAuth = getParticipantAuth();
  const sessionParticipant = participantAuth
    ? participants.find((p) => p.id === participantAuth.id)
    : undefined;

  return (
    <div className="app">
      {showSplash && <SplashScreen title={title} onDone={() => setShowSplash(false)} />}
      {showRules && <RulesModal scoring={scoring} onClose={() => setShowRules(false)} />}
      <header className="app-header">
        <div className="header-top">
          <h1>
            <button
              className="ball-btn"
              onClick={() => setShowSplash(true)}
              title="Repetir la animación"
              aria-label="Repetir la animación de entrada"
            >
              <BallIcon />
            </button>
            {title}
          </h1>
        </div>
        <div className="header-clock">
          <span className="colombia-time" title="Hora actual en Colombia (UTC-5)">
            🕐 {colombiaTime} · Colombia
          </span>
          {isAdmin ? (
            <span className="session-chip session-admin" title="Tienes sesión de administrador">
              🔓 Admin
            </span>
          ) : sessionParticipant ? (
            <span className="session-chip" title="Tu sesión de participante">
              👤 {sessionParticipant.name}
            </span>
          ) : (
            <span className="session-chip session-guest" title="Solo lectura">👀 Invitado</span>
          )}
          <button
            className="clock-rules"
            onClick={() => setShowRules(true)}
            title="Ver las reglas de la polla"
          >
            📜 Reglas
          </button>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              className={view === item.view ? 'nav-btn active' : 'nav-btn'}
              onClick={() => setView(item.view)}
              aria-current={view === item.view ? 'page' : undefined}
            >
              <span className="nav-ico" aria-hidden="true">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {view === 'dashboard' && <DashboardView onOpenMatch={openMatch} onOpenParticipant={openParticipant} />}
        {view === 'matches' && <MatchesView onOpenMatch={openMatch} isAdmin={isAdmin} />}
        {view === 'predictions' && (
          <PredictionsView isAdmin={isAdmin} participantId={participantId} onSelectParticipant={selectParticipant} />
        )}
        {view === 'standings' && <StandingsView isAdmin={isAdmin} />}
        {view === 'mundial' && <MundialView onOpenMatch={openMatch} isAdmin={isAdmin} />}
        {view === 'matchDetail' && matchId !== null && (
          <MatchDetailView matchId={matchId} onBack={() => setView(backView)} />
        )}
      </main>
      <footer className="app-footer">
        {telegramLink && (isAdmin || getParticipantAuth() !== null) && (
          <a className="telegram-cta" href={telegramLink} target="_blank" rel="noopener noreferrer">
            💬 Unirse al grupo de Telegram
          </a>
        )}
        <a
          className="github-cta"
          href="https://github.com/michikyu/polla-mundialista"
          target="_blank"
          rel="noopener noreferrer"
        >
          ⚽ Haz tu propia polla gratis
        </a>
        <div className="footer-admin">
          {isAdmin && (
            <button
              className="admin-config"
              onClick={() => setShowSettings(true)}
              title="Configuración (título, token, Telegram)"
            >
              ⚙️ Configuración
            </button>
          )}
          {!isAdmin && passkeyEnabled && (
            <button
              className="admin-config"
              onClick={() => void handlePasskeyLogin()}
              title="Entrar como admin con tu huella/Face ID/passkey"
            >
              🔐 Huella
            </button>
          )}
          <button
            className={isAdmin ? 'admin-lock unlocked' : 'admin-lock'}
            onClick={() => void handleLockClick()}
            title={isAdmin ? 'Modo administrador activo' : 'Entrar como administrador'}
            aria-label="Administrador"
          >
            {isAdmin ? '🔓' : '🔒'}
          </button>
        </div>
      </footer>
      {showSettings && (
        <AdminSettingsModal
          currentTitle={title}
          currentTelegramLink={telegramLink}
          footballConfigured={footballConfigured}
          currentScoring={scoring}
          onSaved={(s) => {
            if (s.title) {
              setTitle(s.title);
            }
            setTelegramLink(s.telegram_link ?? '');
            setFootballConfigured(s.football_configured);
            setScoring(s.scoring);
          }}
          onPasskeyRegistered={() => setPasskeyEnabled(true)}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
