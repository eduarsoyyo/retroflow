// ═══ PHASE 3: PUESTA EN COMÚN — Group discussion + voting ═══
import type { AppUser } from '@app-types/index';
import { NOTE_CATEGORIES } from '../../config/retro';
import type { RetroNote } from '../../types/index';

interface P3DiscussProps {
  notes: unknown[];
  onUpdateNotes: (notes: unknown[]) => void;
  user: AppUser;
}

export function P3Discuss({ notes, onUpdateNotes, user }: P3DiscussProps) {
  const allNotes = notes as any[];

  const vote = (noteId: string) => {
    onUpdateNotes(allNotes.map(n => {
      if (n.id !== noteId) return n;
      const votes = n.votes || [];
      const hasVoted = votes.includes(user.id);
      return { ...n, votes: hasVoted ? votes.filter((v: string) => v !== user.id) : [...votes, user.id] };
    }));
  };

  // Group by category
  const grouped = NOTE_CATEGORIES.map(cat => ({
    ...cat,
    notes: allNotes.filter(n => n.category === cat.id).sort((a: RetroNote, b: RetroNote) => (b.votes?.length || 0) - (a.votes?.length || 0)),
  }));

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, textAlign: 'center' }}>Puesta en común</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {grouped.map(g => (
          <div key={g.id}>
            <div style={{ fontSize: 12, fontWeight: 700, color: g.color, marginBottom: 8, textAlign: 'center' }}>
              {g.emoji} {g.label} ({g.notes.length})
            </div>
            {g.notes.map((n: RetroNote) => (
              <div key={n.id}
                onClick={() => vote(n.id)}
                style={{
                  background: g.bg, borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                  borderLeft: `3px solid ${g.color}`, cursor: 'pointer',
                }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{n.text}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#86868B' }}>
                  <span>{n.userName}</span>
                  <span style={{ fontWeight: 700, color: (n.votes?.length || 0) > 0 ? '#007AFF' : '#C7C7CC' }}>
                    👍 {n.votes?.length || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
