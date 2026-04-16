// ═══ PHASE 5: RIESGOS — Identify and classify risks from retro ═══
import { useState } from 'preact/hooks';
import type { AppUser, Risk } from '@app-types/index';
import type { RetroNote } from '../../types/index';
import { RISK_TYPES } from '@domain/risks';
import { NOTE_CATEGORIES } from '../../config/retro';
import { Icon } from '@components/common/Icon';

interface P5RisksProps {
  risks: Risk[];
  onUpdateRisks: (risks: Risk[]) => void;
  notes: unknown[];
  user: AppUser;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function P5Risks({ risks, onUpdateRisks, notes, user }: P5RisksProps) {
  const [form, setForm] = useState({ title: '', type: 'riesgo' as const, impact: 'medio' as const, prob: 'media' as const });

  // Bad/Stop notes that could be risks
  const riskableNotes = (notes as any[])
    .filter(n => n.category === 'bad' || n.category === 'stop')
    .filter(n => !risks.some(r => r.fromNote === n.id));

  const addRisk = (fromNote?: RetroNote) => {
    const risk: Risk = {
      id: uid(),
      title: fromNote?.text || form.title,
      text: fromNote?.text || form.title,
      description: '',
      type: form.type,
      impact: form.impact,
      prob: form.prob,
      mitigation: '',
      owner: user.name,
      status: 'open',
      escalation: null,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      fromNote: fromNote?.id,
    };
    onUpdateRisks([...risks, risk]);
    setForm({ title: '', type: 'riesgo', impact: 'medio', prob: 'media' });
  };

  const updateRisk = (id: string, patch: Partial<Risk>) => {
    onUpdateRisks(risks.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Riesgos y problemas</h3>

      {/* Riskable notes */}
      {riskableNotes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#86868B', marginBottom: 8 }}>Notas negativas sin riesgo asociado:</p>
          {riskableNotes.slice(0, 5).map((n: RetroNote) => {
            const cat = NOTE_CATEGORIES.find(c => c.id === n.category);
            return (
              <div key={n.id}
                onClick={() => addRisk(n)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#FFF5F5', border: '1px solid #FF3B3015', marginBottom: 4, cursor: 'pointer' }}>
                <span>{cat?.emoji}</span>
                <span style={{ flex: 1, fontSize: 12 }}>{n.text}</span>
                <span style={{ fontSize: 10, color: '#FF9500', fontWeight: 600 }}>+ Crear riesgo</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual add */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={form.title} onInput={e => setForm({ ...form, title: (e.target as HTMLInputElement).value })}
            onKeyDown={e => e.key === 'Enter' && addRisk()}
            placeholder="Nuevo riesgo o problema..."
            style={{ flex: 2, minWidth: 180, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none' }} />
          <select value={form.type} onChange={e => setForm({ ...form, type: (e.target as HTMLSelectElement).value as any })}
            style={{ padding: '8px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 11 }}>
            {RISK_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
          </select>
          <button onClick={() => addRisk()}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#FF9500', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Añadir
          </button>
        </div>
      </div>

      {/* Risk list */}
      {risks.map(r => (
        <div key={r.id} style={{ background: '#FFF', borderRadius: 10, border: '1px solid #E5E5EA', borderLeft: `3px solid ${RISK_TYPES.find(t => t.id === r.type)?.color || '#FF9500'}`, padding: '10px 14px', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{r.title || r.text}</div>
          <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
            <span style={{ color: RISK_TYPES.find(t => t.id === r.type)?.color }}>{RISK_TYPES.find(t => t.id === r.type)?.label}</span>
            <span style={{ color: '#86868B' }}>Impacto: {r.impact}</span>
            {r.type !== 'problema' && <span style={{ color: '#86868B' }}>Prob: {r.prob}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
