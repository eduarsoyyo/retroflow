// ═══ PHASE 6: RESUMEN — Retro summary + finalize ═══
import type { AppUser, Task, Risk } from '@app-types/index';
import { NOTE_CATEGORIES } from '../../config/retro';
import { Icon } from '@components/common/Icon';

interface P6SummaryProps {
  notes: unknown[];
  actions: Task[];
  risks: Risk[];
  phaseTimes: Record<number, number>;
  objective: string;
  user: AppUser;
  onFinalize: () => void;
  finalizing: boolean;
}

export function P6Summary({ notes, actions, risks, phaseTimes, objective, user, onFinalize, finalizing }: P6SummaryProps) {
  const allNotes = notes as any[];
  const totalTime = Object.values(phaseTimes).reduce((s, t) => s + t, 0);
  const formatTime = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

  const participants = [...new Set(allNotes.map(n => n.userName))];
  const totalVotes = allNotes.reduce((s, n) => s + (n.votes?.length || 0), 0);
  const openRisks = risks.filter(r => r.status !== 'mitigated');

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>Resumen de la retro</h3>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { v: allNotes.length, l: 'Notas', c: '#007AFF', i: 'StickyNote' },
          { v: actions.length, l: 'Acciones', c: '#34C759', i: 'CheckSquare' },
          { v: openRisks.length, l: 'Riesgos', c: '#FF9500', i: 'AlertTriangle' },
          { v: participants.length, l: 'Participantes', c: '#5856D6', i: 'Users' },
        ].map(k => (
          <div key={k.l} style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 14, textAlign: 'center' }}>
            <Icon name={k.i} size={18} color={k.c} />
            <div style={{ fontSize: 22, fontWeight: 800, color: k.c, marginTop: 4 }}>{k.v}</div>
            <div style={{ fontSize: 10, color: '#86868B' }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Notes by category */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, marginBottom: 12 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Notas por categoría</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          {NOTE_CATEGORIES.map(cat => {
            const count = allNotes.filter(n => n.category === cat.id).length;
            return (
              <div key={cat.id} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 10, background: cat.bg }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: cat.color }}>{count}</div>
                <div style={{ fontSize: 10, color: '#86868B' }}>{cat.emoji} {cat.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions list */}
      {actions.length > 0 && (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, marginBottom: 12 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Acciones comprometidas</h4>
          {actions.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F2F2F7', fontSize: 12 }}>
              <Icon name="CheckSquare" size={12} color="#007AFF" />
              <span style={{ flex: 1, fontWeight: 600 }}>{a.text}</span>
              <span style={{ color: '#007AFF', fontSize: 11 }}>{a.owner}</span>
            </div>
          ))}
        </div>
      )}

      {/* Phase times */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, marginBottom: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Tiempos por fase</h4>
        <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
          {Object.entries(phaseTimes).map(([phase, secs]) => (
            <div key={phase} style={{ flex: 1, textAlign: 'center', padding: '6px', background: '#F2F2F7', borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>{formatTime(secs as number)}</div>
              <div style={{ fontSize: 9, color: '#86868B' }}>Fase {parseInt(phase) + 1}</div>
            </div>
          ))}
          <div style={{ flex: 1, textAlign: 'center', padding: '6px', background: '#007AFF10', borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: '#007AFF' }}>{formatTime(totalTime)}</div>
            <div style={{ fontSize: 9, color: '#86868B' }}>Total</div>
          </div>
        </div>
      </div>

      {/* Finalize button */}
      <div style={{ textAlign: 'center' }}>
        <button onClick={onFinalize} disabled={finalizing}
          style={{
            padding: '16px 48px', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #34C759, #007AFF)',
            color: '#FFF', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(0,122,255,.2)',
            opacity: finalizing ? 0.6 : 1,
          }}>
          {finalizing ? 'Finalizando…' : 'Finalizar retrospectiva'}
        </button>
      </div>
    </div>
  );
}
