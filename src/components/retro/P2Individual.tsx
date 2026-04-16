// ═══ PHASE 2: INDIVIDUAL — Private note creation ═══
import { useState } from 'preact/hooks';
import type { AppUser, RetroNote } from '@app-types/index';
import { NOTE_CATEGORIES, NOTE_COLORS } from '../../config/retro';

interface P2IndividualProps {
  notes: unknown[];
  onUpdateNotes: (notes: unknown[]) => void;
  user: AppUser;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function P2Individual({ notes, onUpdateNotes, user }: P2IndividualProps) {
  const [text, setText] = useState('');
  const [cat, setCat] = useState('good');

  const addNote = () => {
    if (!text.trim()) return;
    const note = {
      id: uid(),
      text: text.trim(),
      category: cat,
      userName: user.name,
      userId: user.id,
      color: user.color || NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      votes: [],
      reactions: {},
      createdAt: new Date().toISOString(),
    };
    onUpdateNotes([...notes, note]);
    setText('');
  };

  const myNotes = (notes as any[]).filter(n => n.userId === user.id || n.userName === user.name);
  const catConfig = NOTE_CATEGORIES.find(c => c.id === cat)!;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Category selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, justifyContent: 'center' }}>
        {NOTE_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: cat === c.id ? 700 : 500,
              border: cat === c.id ? 'none' : '1.5px solid #E5E5EA',
              background: cat === c.id ? c.color : '#FFF',
              color: cat === c.id ? '#FFF' : c.color, cursor: 'pointer',
            }}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ background: catConfig.bg, borderRadius: 16, border: `2px solid ${catConfig.color}30`, padding: 16, marginBottom: 16 }}>
        <textarea
          value={text}
          onInput={e => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }}
          placeholder={`¿Qué ${catConfig.label.toLowerCase()} quieres compartir?`}
          style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 14, outline: 'none', resize: 'vertical', minHeight: 60, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: '#86868B' }}>{myNotes.length} notas</span>
          <button onClick={addNote} disabled={!text.trim()}
            style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: catConfig.color, color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: text.trim() ? 1 : 0.4 }}>
            Añadir
          </button>
        </div>
      </div>

      {/* My notes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {myNotes.map((n: RetroNote) => {
          const cc = NOTE_CATEGORIES.find(c => c.id === n.category);
          return (
            <div key={n.id} style={{ background: cc?.bg || '#F2F2F7', borderRadius: 12, padding: '12px 14px', borderLeft: `3px solid ${cc?.color || '#86868B'}` }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>{n.text}</div>
              <div style={{ fontSize: 10, color: '#86868B' }}>{cc?.emoji} {cc?.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
