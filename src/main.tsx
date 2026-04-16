import { render, Component } from 'preact';
import type { ComponentChildren } from 'preact';
import { App } from './App';

// Error Boundary
interface ErrorBoundaryState { error: Error | null }

class ErrorBoundary extends Component<{ children: ComponentChildren }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[revelio] Uncaught error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F7', fontFamily: '-apple-system, sans-serif' }}>
          <div style={{ textAlign: 'center', maxWidth: 420, padding: 32 }}>
            {/* Broken wand SVG */}
            <svg viewBox="0 0 120 120" style={{ width: 120, margin: '0 auto 16px' }}>
              <circle cx="60" cy="60" r="56" fill="none" stroke="#E5E5EA" strokeWidth="2" strokeDasharray="8 4" />
              <line x1="35" y1="80" x2="55" y2="45" stroke="#5856D6" strokeWidth="3" strokeLinecap="round" />
              <line x1="58" y1="40" x2="62" y2="38" stroke="#5856D6" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
              <line x1="66" y1="34" x2="80" y2="25" stroke="#5856D6" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
              <circle cx="56" cy="43" r="4" fill="#FF3B30" opacity="0.6" />
              <text x="56" y="47" textAnchor="middle" fontSize="5" fill="#FFF" fontWeight="bold">!</text>
              {/* Sparkle fragments */}
              <circle cx="70" cy="30" r="1.5" fill="#FF9500" opacity="0.7" />
              <circle cx="75" cy="38" r="1" fill="#FF9500" opacity="0.5" />
              <circle cx="64" cy="28" r="1" fill="#5856D6" opacity="0.5" />
            </svg>

            <h1 style={{ fontFamily: 'Comfortaa, sans-serif', fontSize: 32, fontWeight: 400, background: 'linear-gradient(90deg,#FF3B30,#FF9500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>
              Finite Incantatem
            </h1>
            <p style={{ color: '#86868B', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Un hechizo se ha roto. No te preocupes, la magia volverá.
            </p>
            <pre style={{ padding: 14, background: '#FFF', borderRadius: 12, border: '1.5px solid #E5E5EA', fontSize: 11, color: '#FF3B30', textAlign: 'left', overflow: 'auto', maxWidth: '100%', marginBottom: 20, lineHeight: 1.4 }}>
              {this.state.error.message}
            </pre>
            <button onClick={() => window.location.reload()}
              style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#007AFF,#5856D6)', color: '#FFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 16px rgba(88,86,214,.25)' }}>
              Reparo ✨
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById('app');
if (root) {
  render(<ErrorBoundary><App /></ErrorBoundary>, root);
}
