// ═══ NEEDLINK — Landing page ═══
import { useState } from 'preact/hooks';
import type { AppUser } from '@app-types/index';
import { Login } from './Login';

interface NeedLinkProps {
  onJoin: (user: AppUser) => void;
}

export function NeedLink({ onJoin }: NeedLinkProps) {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#0057FF 0%,#0099FF 50%,#00C6FF 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background orbs */}
      <div style={{ position: 'absolute', top: '-20%', right: '-15%', width: '50vw', height: '50vw', maxWidth: 480, maxHeight: 480, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,255,255,.15),transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: '40vw', height: '40vw', maxWidth: 400, maxHeight: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,30,120,.3),transparent 65%)', pointerEvents: 'none' }} />

      <h1 style={{
        fontFamily: "'Comfortaa',sans-serif", fontSize: 'clamp(52px,10vw,88px)',
        fontWeight: 400, letterSpacing: 6, color: '#FFF', margin: 0, lineHeight: 1,
        textShadow: '0 4px 32px rgba(0,0,0,.15)', zIndex: 1,
      }}>revelio</h1>

      <p style={{
        fontSize: 'clamp(14px,1.8vw,17px)', color: 'rgba(255,255,255,.8)',
        marginTop: 20, marginBottom: 48, maxWidth: 520, lineHeight: 1.7, zIndex: 1,
      }}>
        Ningún proyecto debería moverse en las sombras.
      </p>

      <div style={{ zIndex: 1 }}>
        <button onClick={() => setShowLogin(true)}
          style={{
            padding: '16px 48px', borderRadius: 16, border: 'none',
            background: '#FFF', color: '#007AFF', fontSize: 17, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 24px rgba(0,0,0,.18)',
            transition: 'transform .15s, box-shadow .15s',
          }}
          onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'; }}
          onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          Acceder →
        </button>
      </div>

      {/* Login modal */}
      {showLogin && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowLogin(false); }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 24, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden' }}>
            <Login onJoin={onJoin} isModal />
          </div>
        </div>
      )}
    </div>
  );
}
