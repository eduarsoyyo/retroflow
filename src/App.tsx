// ═══ APP — Main router ═══
// Handles: Landing → Login → Home → Project / Admin
// Session persisted in localStorage.

import { useState, useEffect } from 'preact/hooks';
import type { AppUser } from '@app-types/index';
import { NeedLink } from '@components/auth/NeedLink';
import { UserHomePage } from '@components/home/UserHomePage';
import { RoomPicker } from '@components/admin/RoomPicker';
import { RetroBoard } from '@components/retro/RetroBoard';
import { playLoginEffect } from '@components/auth/LoginEffect';
import { createLogger } from '@lib/logger';

const log = createLogger('app');

type View = 'landing' | 'home' | 'admin' | 'project' | 'transitioning';

interface ProjectContext {
  sala: string;
  tipo: string;
}

// ── Session persistence ──

function loadSession(): AppUser | null {
  try {
    const s = localStorage.getItem('rf-session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveSession(user: AppUser) {
  try { localStorage.setItem('rf-session', JSON.stringify(user)); } catch {}
}

function clearSession() {
  try {
    localStorage.removeItem('rf-session');
    localStorage.removeItem('rf-admin-session');
  } catch {}
}

// ── URL params ──

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    sala: params.get('sala'),
    tipo: params.get('tipo') || 'agile',
    isAdmin: params.has('admin'),
  };
}

// ── Component ──

export function App() {
  const [user, setUser] = useState<AppUser | null>(() => loadSession());
  const [view, setView] = useState<View>('landing');
  const [project, setProject] = useState<ProjectContext | null>(null);

  // On mount: check URL params and session
  useEffect(() => {
    const params = getUrlParams();
    const session = loadSession();

    if (params.sala && session) {
      // Direct URL to a project
      setUser(session);
      setProject({ sala: params.sala, tipo: params.tipo });
      setView('project');
    } else if (params.isAdmin && session?.isSuperuser) {
      setUser(session);
      setView('admin');
    } else if (session) {
      setUser(session);
      setView('home');
    } else {
      setView('landing');
    }

    log.info('App initialized', { view, hasSession: !!session, sala: params.sala });
  }, []);

  const handleJoin = (u: AppUser) => {
    setUser(u);
    saveSession(u);
    setView('transitioning');
    playLoginEffect(() => {
      setView('home');
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    });
  };

  const handleLogout = () => {
    setUser(null);
    clearSession();
    setView('landing');
    setProject(null);
  };

  const handleSelectProject = (sala: string, tipo: string) => {
    setProject({ sala, tipo });
    setView('project');
    // Update URL for shareability
    window.history.pushState({}, '', `?sala=${sala}&tipo=${tipo}`);
  };

  const handleBackToHome = () => {
    setProject(null);
    setView('home');
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleOpenAdmin = () => {
    setView('admin');
  };

  // ── Render ──

  if (view === 'transitioning') {
    return <div style={{ minHeight: '100vh', background: '#0A1628' }} />;
  }

  if (view === 'landing' || !user) {
    return <NeedLink onJoin={handleJoin} />;
  }

  if (view === 'admin') {
    return (
      <RoomPicker
        user={user}
        onGoToRoom={handleSelectProject}
        onLogout={handleLogout}
        onBackToHome={handleBackToHome}
      />
    );
  }

  if (view === 'project' && project) {
    return (
      <RetroBoard
        user={user}
        sala={project.sala}
        tipo={project.tipo}
        salaDisplay={project.sala.charAt(0).toUpperCase() + project.sala.slice(1)}
        onLogout={handleLogout}
        onBackToHome={handleBackToHome}
        onSwitchProject={handleSelectProject}
      />
    );
  }

  return (
    <UserHomePage
      user={user}
      onLogout={handleLogout}
      onSelectProject={handleSelectProject}
      onOpenAdmin={handleOpenAdmin}
    />
  );
}
