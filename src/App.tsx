import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import type { Participant } from '../shared/types';
import { api, clearStoredPassword, getParticipantAuth, clearParticipantAuth } from './api';
import { APP_TITLE } from './appConfig';
import { BallIcon } from './components/BallIcon';
import { RulesModal } from './components/RulesModal';
import { LoginModal } from './components/LoginModal';
import { AdminSettingsModal } from './components/AdminSettingsModal';
import { ParticipantProgressModal } from './components/ParticipantProgressModal';
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
  const [showLogin, setShowLogin] = useState(false);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [showMyProgress, setShowMyProgress] = useState(false);
  const [title, setTitle] = useState(APP_TITLE);
  const [telegramLink, setTelegramLink] = useState('');
  const [footballConfigured, setFootballConfigured] = useState(false);
  const [scoring, setScoring] = useState<ScoringConfig>(DEFAULT_SCORING);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantAuthId, setParticipantAuthId] = useState<number | null>(
    () => getParticipantAuth()?.id ?? null,
  );
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

  const handleRegisterMyPasskey = async () => {
    const me = participants.find((p) => p.id === participantAuthId);
    if (!me) {
      return;
    }
    try {
      const optionsJSON = await api.webauthnRegisterOptions(me.id);
      const response = await startRegistration({ optionsJSON });
      await api.webauthnRegisterVerify(response);
      setPasskeyEnabled(true);
      window.alert('✅ Huella/passkey activada. La próxima vez entra con tu huella.');
    } catch (err) {
      const msg = (err as Error).message || '';
      if (!/abort|cancel|NotAllowed/i.test(msg)) {
        window.alert('No se pudo activar la huella/passkey: ' + msg);
      }
    }
  };

  const handleSignOut = () => {
    if (isAdmin) {
      clearStoredPassword();
      setIsAdmin(false);
    } else {
      clearParticipantAuth();
      setParticipantAuthId(null);
    }
  };

  // Etiqueta de la sesión actual (admin / participante / invitado).
  const sessionParticipant =
    participantAuthId !== null ? participants.find((p) => p.id === participantAuthId) : undefined;

  return (
    <div className="app">
      {showSplash && <SplashScreen title={title} onDone={() => setShowSplash(false)} />}
      {showRules && <RulesModal scoring={scoring} onClose={() => setShowRules(false)} />}
      {showLogin && (
        <LoginModal
          participants={participants}
          passkeyEnabled={passkeyEnabled}
          onAdminLoggedIn={() => {
            setIsAdmin(true);
            setShowLogin(false);
          }}
          onParticipantLoggedIn={(id) => {
            setParticipantAuthId(id);
            selectParticipant(id);
            setShowLogin(false);
          }}
          onClose={() => setShowLogin(false)}
        />
      )}
      {showMyProgress && sessionParticipant && (
        <ParticipantProgressModal
          participantId={sessionParticipant.id}
          name={sessionParticipant.name}
          onClose={() => setShowMyProgress(false)}
        />
      )}
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
          {!isAdmin && !sessionParticipant ? (
            <button
              className="session-chip session-guest"
              onClick={() => setShowLogin(true)}
              title="Entrar como participante o administrador"
            >
              👀 Invitado · entrar
            </button>
          ) : (
            <div className="session-wrap">
              <button
                className={isAdmin ? 'session-chip session-admin' : 'session-chip'}
                onClick={() => setSessionMenuOpen((v) => !v)}
                title="Tu sesión"
              >
                {isAdmin ? '🔓 Admin' : `👤 ${sessionParticipant?.name}`} ▾
              </button>
              {sessionMenuOpen && (
                <>
                  <div className="menu-backdrop" onClick={() => setSessionMenuOpen(false)} />
                  <div className="menu session-menu">
                    {!isAdmin && sessionParticipant && (
                      <button
                        onClick={() => {
                          setSessionMenuOpen(false);
                          setShowMyProgress(true);
                        }}
                      >
                        📊 Mi avance
                      </button>
                    )}
                    {!isAdmin && sessionParticipant && (
                      <button
                        onClick={() => {
                          setSessionMenuOpen(false);
                          void handleRegisterMyPasskey();
                        }}
                      >
                        🔐 Activar huella
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setSessionMenuOpen(false);
                          setShowSettings(true);
                        }}
                      >
                        ⚙️ Configuración
                      </button>
                    )}
                    <button
                      className="menu-danger"
                      onClick={() => {
                        setSessionMenuOpen(false);
                        handleSignOut();
                      }}
                    >
                      🚪 Salir
                    </button>
                  </div>
                </>
              )}
            </div>
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
        {view === 'dashboard' && (
          <DashboardView
            onOpenMatch={openMatch}
            onOpenParticipant={openParticipant}
            viewerParticipantId={participantAuthId}
          />
        )}
        {view === 'matches' && (
          <MatchesView onOpenMatch={openMatch} isAdmin={isAdmin} viewerParticipantId={participantAuthId} />
        )}
        {view === 'predictions' && (
          <PredictionsView
            isAdmin={isAdmin}
            participantId={isAdmin ? participantId : participantAuthId}
            onSelectParticipant={selectParticipant}
            unlockedId={participantAuthId}
            onRequestLogin={() => setShowLogin(true)}
          />
        )}
        {view === 'standings' && <StandingsView isAdmin={isAdmin} />}
        {view === 'mundial' && <MundialView onOpenMatch={openMatch} isAdmin={isAdmin} />}
        {view === 'matchDetail' && matchId !== null && (
          <MatchDetailView
            matchId={matchId}
            onBack={() => setView(backView)}
            viewerParticipantId={participantAuthId}
          />
        )}
      </main>
      <footer className="app-footer">
        {telegramLink && (isAdmin || participantAuthId !== null) && (
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
