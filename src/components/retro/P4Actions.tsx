// ═══ PHASE 5: ACCIONABLES — Create tasks from notes + risks ═══
import { useState } from 'preact/hooks';
import type { AppUser, Task, Risk } from '@app-types/index';
import { NOTE_CATEGORIES } from '../../config/retro';
import { RISK_TYPES } from '@domain/risks';
import type { RetroNote } from '../../types/index';
import { Icon } from '@components/common/Icon';

interface P4ActionsProps {
  notes: unknown[];
  actions: Task[];
  risks?: Risk[];
  onUpdateActions: (actions: Task[]) => void;
  user: AppUser;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const CAT_ICONS: Record<string, string> = { good: 'ThumbsUp', bad: 'ThumbsDown', start: 'Rocket', stop: 'Square' };
const inputS = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#F9F9FB' };
const labelS = { fontSize: 10, fontWeight: 700 as number, color: '#86868B', display: 'block', marginBottom: 3, textTransform: 'uppercase' as const };

export function P4Actions({ notes, actions, risks = [], onUpdateActions, user }: P4ActionsProps) {
  const [showModal, setShowModal] = useState(false);
  const [editAction, setEditAction] = useState<Task | null>(null);
  const [form, setForm] = useState({ text: '', owner: '', date: '', source: '' });

  const allNotes = (notes as RetroNote[]) || [];
  const topNotes = allNotes
    .filter(n => (n.votes?.length || 0) > 0)
    .sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0))
    .slice(0, 10);

  const openRisks = risks.filter(r => r.status !== 'mitigated');

  const openCreate = (text?: string, source?: string) => {
    setForm({ text: text || '', owner: user.name, date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), source: source || '' });
    setEditAction(null);
    setShowModal(true);
  };

  const openEdit = (a: Task) => {
    setForm({ text: a.text, owner: a.owner || '', date: a.date || '', source: '' });
    setEditAction(a);
    setShowModal(true);
  };

  const saveAction = () => {
    if (!form.text.trim()) return;
    if (editAction) {
      onUpdateActions(actions.map(a => a.id === editAction.id ? { ...a, text: form.text.trim(), owner: form.owner, date: form.date } : a));
    } else {
      const action: Task = {
        id: uid(), text: form.text.trim(), owner: form.owner || user.name,
        date: form.date || undefined, status: 'backlog', priority: 'medium',
        createdBy: user.id, noteId: null, fromCategory: null,
      };
      onUpdateActions([...actions, action]);
    }
    setShowModal(false);
  };

  const deleteAction = (id: string) => {
    onUpdateActions(actions.filter(a => a.id !== id));
  };

  const hasActionForNote = (noteId: string) => actions.some(a => a.noteId === noteId);
  const hasActionForRisk = (riskId: string) => actions.some(a => (a as any).riskId === riskId);

  const createFromNote = (n: RetroNote) => {
    openCreate(n.text, `nota:${n.id}`);
  };

  const createFromRisk = (r: Risk) => {
    openCreate(`Mitigar: ${r.title || r.text}`, `risk:${r.id}`);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Accionables</h3>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{actions.length} acciones creadas</p>
        </div>
        <button onClick={() => openCreate()}
          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#007AFF', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="Plus" size={11} color="#FFF" /> Crear accionable
        </button>
      </div>

      {/* Two-column layout: sources left, actions right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* LEFT: Sources (notes + risks) */}
        <div>
          {/* Top voted notes */}
          {topNotes.length > 0 && (
            <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 14, marginBottom: 12 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="MessageSquare" size={13} color="#007AFF" /> Notas más votadas
              </h4>
              {topNotes.map((n: RetroNote) => {
                const cat = NOTE_CATEGORIES.find(c => c.id === n.category);
                const done = hasActionForNote(n.id);
                return (
                  <div key={n.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                    background: done ? '#F0FFF4' : '#FAFAFA', marginBottom: 4,
                    border: `1px solid ${done ? '#34C75920' : '#E5E5EA'}`,
                  }}>
                    <Icon name={CAT_ICONS[n.category] || 'Circle'} size={12} color={cat?.color || '#86868B'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11 }}>{n.text}</div>
                      <div style={{ fontSize: 9, color: '#86868B' }}>{n.userName}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#007AFF' }}>{n.votes?.length || 0}</span>
                    <Icon name="ThumbsUp" size={10} color="#007AFF" />
                    {done ? (
                      <Icon name="CheckCircle" size={14} color="#34C759" />
                    ) : (
                      <button onClick={() => createFromNote(n)}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #007AFF30', background: '#FFF', fontSize: 9, fontWeight: 600, color: '#007AFF', cursor: 'pointer' }}>
                        + Acción
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Open risks */}
          {openRisks.length > 0 && (
            <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 14 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="AlertTriangle" size={13} color="#FF9500" /> Riesgos abiertos
              </h4>
              {openRisks.map(r => {
                const tc = RISK_TYPES.find(t => t.id === r.type);
                const done = hasActionForRisk(r.id);
                return (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                    background: done ? '#F0FFF4' : '#FAFAFA', marginBottom: 4,
                    borderLeft: `3px solid ${tc?.color || '#FF9500'}`,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{r.title || r.text}</div>
                      {r.mitigation && <div style={{ fontSize: 9, color: '#34C759' }}>{r.mitigation.slice(0, 50)}</div>}
                    </div>
                    {done ? (
                      <Icon name="CheckCircle" size={14} color="#34C759" />
                    ) : (
                      <button onClick={() => createFromRisk(r)}
                        style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${tc?.color || '#FF9500'}30`, background: '#FFF', fontSize: 9, fontWeight: 600, color: tc?.color || '#FF9500', cursor: 'pointer' }}>
                        + Acción
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {topNotes.length === 0 && openRisks.length === 0 && (
            <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 24, textAlign: 'center', color: '#C7C7CC' }}>
              <Icon name="Inbox" size={24} color="#E5E5EA" />
              <p style={{ fontSize: 12, marginTop: 6 }}>Sin notas votadas ni riesgos. Crea acciones manualmente.</p>
            </div>
          )}
        </div>

        {/* RIGHT: Created actions */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 14 }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="ClipboardList" size={13} color="#007AFF" /> Acciones creadas ({actions.length})
          </h4>
          {actions.length === 0 && <p style={{ fontSize: 11, color: '#C7C7CC', textAlign: 'center', padding: 16 }}>Crea la primera acción desde notas, riesgos o manualmente.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 500, overflowY: 'auto' }}>
            {actions.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#FAFAFA', borderLeft: '3px solid #007AFF' }}>
                <Icon name="CheckSquare" size={13} color="#007AFF" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{a.text}</div>
                  <div style={{ fontSize: 9, color: '#86868B' }}>
                    {a.owner && <span style={{ color: '#007AFF' }}>{a.owner}</span>}
                    {a.date && <span> · {new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>}
                  </div>
                </div>
                <button onClick={() => openEdit(a)}
                  style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="Edit" size={9} color="#007AFF" />
                </button>
                <button onClick={() => deleteAction(a.id)}
                  style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="Trash2" size={9} color="#FF3B30" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowModal(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#FFF', borderRadius: 20, maxWidth: 460, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{editAction ? 'Editar accionable' : 'Nuevo accionable'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={labelS}>Descripción *</label>
                <textarea value={form.text} onInput={e => setForm({ ...form, text: (e.target as HTMLTextAreaElement).value })}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveAction(); } }}
                  rows={3} placeholder="¿Qué hay que hacer?" style={{ ...inputS, resize: 'vertical' }} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Responsable</label><input value={form.owner} onInput={e => setForm({ ...form, owner: (e.target as HTMLInputElement).value })} placeholder={user.name} style={inputS} /></div>
                <div><label style={labelS}>Fecha límite</label><input type="date" value={form.date} onInput={e => setForm({ ...form, date: (e.target as HTMLInputElement).value })} style={inputS} /></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {editAction && (
                <button onClick={() => { deleteAction(editAction.id); setShowModal(false); }}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #FF3B30', background: '#FFF', color: '#FF3B30', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Eliminar
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={saveAction} disabled={!form.text.trim()} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#007AFF', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: form.text.trim() ? 1 : 0.4 }}>
                {editAction ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
