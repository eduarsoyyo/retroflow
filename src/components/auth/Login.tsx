// ═══ LOGIN — Secure authentication via server-side RPC ═══
import { useState } from 'preact/hooks';
import type { AppUser } from '../../types/index';
import { authenticateUser } from '../../data/auth';
import { createLogger } from '../../lib/logger';

const log = createLogger('auth:login');

interface LoginProps {
  onJoin: (user: AppUser) => void;
  isModal?: boolean;
}

export function Login({ onJoin, isModal = false }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) { setError('Introduce tu usuario o email'); return; }
    if (!password.trim()) { setError('Introduce tu contraseña'); return; }
    setLoading(true); setError('');

    try {
      // Server-side authentication — password never compared on client
      const result = await authenticateUser(username.trim(), password.trim());

      if (!result.ok) {
        setLoading(false);
        const messages: Record<string, string> = {
          'USER_NOT_FOUND': `No se encontró el usuario "${username.trim()}"`,
          'WRONG_PASSWORD': 'Contraseña incorrecta',
          'NO_PASSWORD': 'Este usuario no tiene contraseña configurada. Contacta con tu SM.',
          'RPC_ERROR': 'Error de autenticación. Contacta con tu administrador.',
          'NETWORK_ERROR': 'Error de conexión. Inténtalo de nuevo.',
        };
        setError(messages[result.error as string] || 'Error de autenticación');
        return;
      }

      const u = result.user;
      if (!u) { setError('Error de autenticación'); setLoading(false); return; }
      const userSession: AppUser = {
        id: u.id,
        name: u.name,
        avatar: u.avatar || '👤',
        color: u.color || '#007AFF',
        role: u.role_label || '',
        username: u.username || u.name,
        isSuperuser: !!u.is_superuser,
      };

      try {
        localStorage.setItem('rf-session', JSON.stringify(userSession));
        if (u.is_superuser) localStorage.setItem('rf-admin-session', JSON.stringify(userSession));
      } catch {}

      log.info('User logged in', { name: u.name, isSuperuser: u.is_superuser });
      setLoading(false);
      onJoin(userSession);
    } catch (e) {
      log.error('Login exception', e);
      setLoading(false);
      setError('Error de conexión. Inténtalo de nuevo.');
    }
  };

  const containerStyle = !isModal ? {
    minHeight: '100vh',
    background: 'linear-gradient(135deg,#0057FF,#00C6FF)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  } : {};

  const inputStyle = {
    padding: '12px 16px', borderRadius: 12, border: '1.5px solid #E5E5EA',
    fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%',
    boxSizing: 'border-box' as const, background: '#FAFAFA',
  };

  return (
    <div style={containerStyle}>
      <div style={{
        background: '#FFF', borderRadius: 24, padding: '36px 32px', maxWidth: 420, width: '100%',
        ...(!isModal ? { boxShadow: '0 20px 60px rgba(0,0,0,.15)' } : {}),
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{
            fontFamily: "'Comfortaa',sans-serif", fontSize: 32, fontWeight: 400, letterSpacing: 2,
            background: 'linear-gradient(90deg,#007AFF,#5856D6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>revelio</h1>
          <p style={{ color: '#86868B', fontSize: 13, marginTop: 4 }}>Accede con tu cuenta</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Usuario o email</label>
            <input value={username} onInput={e => { setUsername((e.target as HTMLInputElement).value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('rf-pw')?.focus()}
              placeholder="tu_usuario o email@..." style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Contraseña</label>
            <input id="rf-pw" type="password" value={password} onInput={e => { setPassword((e.target as HTMLInputElement).value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••" style={inputStyle} />
          </div>

          {error && (
            <div style={{ background: '#FFF5F5', border: '1px solid #FF3B3025', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FF3B30', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading}
            style={{
              padding: 14, borderRadius: 12, border: 'none', background: '#1D1D1F',
              color: '#FFF', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              marginTop: 4, opacity: loading ? 0.6 : 1,
            }}>
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#C7C7CC', marginTop: 20 }}>
          ¿No tienes acceso? Contacta con tu Scrum Master.
        </p>
      </div>
    </div>
  );
}
