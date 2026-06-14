import { useEffect, useState } from 'react';
import { api, clearStoredPassword, setStoredPassword } from './api';
import { BallIcon } from './components/BallIcon';
import { RulesModal } from './components/RulesModal';
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
  const [colombiaTime, setColombiaTime] = useState(getColombiaTime);
  const [participantId, setParticipantId] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem(PARTICIPANT_KEY));
    return Number.isInteger(saved) && saved > 0 ? saved : null;
  });

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => setIsAdmin(status.admin))
      .catch(() => {});
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

  return (
    <div className="app">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
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
            Polla Mundialística Moachos
          </h1>
        </div>
        <div className="header-clock">
          <span className="colombia-time" title="Hora actual en Colombia (UTC-5)">
            🕐 {colombiaTime} · Colombia
          </span>
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
        <a
          className="github-cta"
          href="https://github.com/michikyu/polla-mundialista"
          target="_blank"
          rel="noopener noreferrer"
        >
          ⚽ Haz tu propia polla gratis
        </a>
        <button
          className={isAdmin ? 'admin-lock unlocked' : 'admin-lock'}
          onClick={() => void handleLockClick()}
          title={isAdmin ? 'Modo administrador activo' : 'Entrar como administrador'}
          aria-label="Administrador"
        >
          {isAdmin ? '🔓' : '🔒'}
        </button>
      </footer>
    </div>
  );
}
