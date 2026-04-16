// ═══ PHASE 4: ACCIONABLES — Create tasks from voted notes ═══
import { useState } from 'preact/hooks';
import type { AppUser, Task } from '@app-types/index';
import { NOTE_CATEGORIES } from '../../config/retro';
import type { RetroNote } from '../../types/index';
import { Icon } from '@components/common/Icon';

interface P4ActionsProps {
  notes: unknown[];
  actions: Task[];
  onUpdateActions: (actions: Task[]) => void;
  user: AppUser;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function P4Actions({ notes, actions, onUpdateActions, user }: P4ActionsProps) {
  const [form, setForm] = useState({ text: '', owner: '', date: '' });

  // Top voted notes
  const topNotes = (notes as any[])
    .filter(n => (n.votes?.length || 0) > 0)
    .sort((a: RetroNote, b: RetroNote) => (b.votes?.length || 0) - (a.votes?.length || 0))
    .slice(0, 10);

  const addAction = (fromNote?: RetroNote) => {
    const text = fromNote?.text || form.text;
    if (!text.trim()) return;
    const action: Task = {
      id: uid(),
      text: text.trim(),
      owner: form.owner || user.name,
      date: form.date || undefined,
      status: 'backlog',
      priority: 'medium',
      voteScore: fromNote?.votes?.length || 0,
      createdBy: user.id,
      noteId: fromNote?.id || null,
      fromCategory: fromNote?.category || null,
    };
    onUpdateActions([...actions, action]);
    setForm({ text: '', owner: '', date: '' });
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Accionables</h3>

      {/* Top voted notes → quick action creation */}
      {topNotes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#86868B', marginBottom: 8 }}>Notas más votadas — click para crear acción:</p>
          {topNotes.map((n: RetroNote) => {
            const cat = NOTE_CATEGORIES.find(c => c.id === n.category);
            const alreadyAction = actions.some(a => a.noteId === n.id);
            return (
              <div key={n.id}
                onClick={() => !alreadyAction && addAction(n)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 10, background: alreadyAction ? '#F0FFF4' : '#FFF',
                  border: `1.5px solid ${alreadyAction ? '#34C75930' : '#E5E5EA'}`,
                  marginBottom: 4, cursor: alreadyAction ? 'default' : 'pointer',
                  opacity: alreadyAction ? 0.6 : 1,
                }}>
                <span style={{ fontSize: 14 }}>{cat?.emoji}</span>
                <span style={{ flex: 1, fontSize: 12 }}>{n.text}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#007AFF' }}>👍 {n.votes?.length || 0}</span>
                {alreadyAction && <span style={{ fontSize: 10, color: '#34C759', fontWeight: 700 }}>✓ Creada</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Manual action form */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={form.text} onInput={e => setForm({ ...form, text: (e.target as HTMLInputElement).value })}
            onKeyDown={e => e.key === 'Enter' && addAction()}
            placeholder="Nueva acción..."
            style={{ flex: 2, minWidth: 180, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none' }} />
          <input value={form.owner} onInput={e => setForm({ ...form, owner: (e.target as HTMLInputElement).value })}
            placeholder="Responsable"
            style={{ flex: 1, minWidth: 100, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none' }} />
          <input type="date" value={form.date} onInput={e => setForm({ ...form, date: (e.target as HTMLInputElement).value })}
            style={{ padding: '8px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12 }} />
          <button onClick={() => addAction()}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#007AFF', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Añadir
          </button>
        </div>
      </div>

      {/* Created actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {actions.map(a => (
          <div key={a.id} style={{ background: '#FFF', borderRadius: 10, border: '1px solid #E5E5EA', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="CheckSquare" size={14} color="#007AFF" />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{a.text}</span>
            <span style={{ fontSize: 10, color: '#007AFF' }}>{a.owner}</span>
            {a.date && <span style={{ fontSize: 10, color: '#86868B' }}>{a.date}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
