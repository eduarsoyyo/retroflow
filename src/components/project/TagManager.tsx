// ═══ TAG MANAGER — Create/delete tags, assign to tasks/risks/members ═══
import { useState, useEffect } from 'preact/hooks';
import type { Task, Risk, Member } from '../../types/index';
import { loadTags, loadTagAssignments } from '../../data/rooms';
import { saveTag, deleteTag, toggleTagAssignment } from '../../data/tags';

interface Tag { id: string; name: string; color: string; sala: string }
interface TagAssignment { tag_id: string; entity_type: string; entity_id: string; sala: string }

interface TagManagerProps {
  sala: string;
  teamMembers: Member[];
  risks: Risk[];
  actions: Task[];
  onClose: () => void;
}

const TAG_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#5856D6', '#AF52DE', '#FF2D55', '#00C7BE', '#1D1D1F', '#86868B'];

export function TagManager({ sala, teamMembers, risks, actions, onClose }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [assignments, setAssignments] = useState<TagAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState({ name: '', color: '#007AFF' });
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadTags(sala), loadTagAssignments(sala)]).then(([t, a]) => {
      setTags(t); setAssignments(a); setLoading(false);
    });
  }, [sala]);

  const addTag = async () => {
    if (!newTag.name.trim()) return;
    const saved = await saveTag({ sala, name: newTag.name.trim(), color: newTag.color });
    if (saved) { setTags(prev => [...prev, saved]); setNewTag({ name: '', color: '#007AFF' }); }
  };

  const removeTag = async (id: string) => {
    await deleteTag(id);
    setTags(prev => prev.filter(t => t.id !== id));
    setAssignments(prev => prev.filter(a => a.tag_id !== id));
    if (activeTag === id) setActiveTag(null);
  };

  const toggleAssign = async (tagId: string, type: string, entityId: string) => {
    const added = await toggleTagAssignment(tagId, type, entityId, sala);
    if (added) setAssignments(prev => [...prev, { tag_id: tagId, entity_type: type, entity_id: entityId, sala }]);
    else setAssignments(prev => prev.filter(a => !(a.tag_id === tagId && a.entity_type === type && a.entity_id === entityId)));
  };

  const hasTag = (tagId: string, type: string, entityId: string) =>
    assignments.some(a => a.tag_id === tagId && a.entity_type === type && a.entity_id === entityId);
  const entityTags = (type: string, entityId: string) =>
    tags.filter(t => hasTag(t.id, type, entityId));

  const columns = [
    { title: 'Equipo', items: teamMembers, type: 'member', getLabel: (m: Member) => m.name, getIcon: (m: Member) => m.avatar || '👤' },
    { title: 'Riesgos', items: (risks || []).filter(r => r.status !== 'mitigated'), type: 'risk', getLabel: (r: Risk) => ((r.title || r.text) as string).slice(0, 50), getIcon: () => 'R' },
    { title: 'Tareas', items: (actions || []).filter(a => a.status !== 'done' && a.status !== 'discarded'), type: 'action', getLabel: (a: Task) => (a.text as string).slice(0, 50), getIcon: () => 'T' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '90%', maxWidth: 900, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Gestión de etiquetas</h2>
          <button onClick={onClose} style={{ border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: '#86868B' }}>✕</button>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div> : (
          <>
            {/* Tag bar: filter + create */}
            <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: tags.length > 0 ? 10 : 0 }}>
                <button onClick={() => setActiveTag(null)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${!activeTag ? '#1D1D1F' : '#E5E5EA'}`, background: !activeTag ? '#1D1D1F' : '#FFF', color: !activeTag ? '#FFF' : '#6E6E73', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Todos
                </button>
                {tags.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={() => setActiveTag(activeTag === t.id ? null : t.id)}
                      style={{ padding: '5px 12px', borderRadius: '20px 0 0 20px', border: `1.5px solid ${activeTag === t.id ? t.color : '#E5E5EA'}`, background: activeTag === t.id ? t.color : '#FFF', color: activeTag === t.id ? '#FFF' : t.color, fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRight: 'none' }}>
                      {t.name}
                    </button>
                    <button onClick={() => removeTag(t.id)}
                      style={{ padding: '5px 6px', borderRadius: '0 20px 20px 0', border: `1.5px solid ${activeTag === t.id ? t.color : '#E5E5EA'}`, background: activeTag === t.id ? t.color + 'CC' : '#FFF', color: activeTag === t.id ? '#FFF' : '#C7C7CC', fontSize: 10, cursor: 'pointer', borderLeft: 'none' }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {/* Color picker + create */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {TAG_COLORS.map(c => (
                    <div key={c} onClick={() => setNewTag({ ...newTag, color: c })}
                      style={{ width: 20, height: 20, borderRadius: 10, background: c, cursor: 'pointer', outline: newTag.color === c ? '2px solid #1D1D1F' : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
                <input value={newTag.name} onInput={e => setNewTag({ ...newTag, name: (e.target as HTMLInputElement).value })}
                  onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Nueva etiqueta…"
                  style={{ border: '1.5px solid #E5E5EA', borderRadius: 20, padding: '5px 12px', fontSize: 12, outline: 'none', flex: 1, minWidth: 120 }} />
                <button onClick={addTag}
                  style={{ padding: '5px 14px', borderRadius: 20, border: 'none', background: newTag.color, color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  + Crear
                </button>
              </div>
            </div>

            {/* Active filter indicator */}
            {activeTag && (() => {
              const at = tags.find(t => t.id === activeTag);
              return at ? (
                <div style={{ borderRadius: 10, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: at.color, fontWeight: 600, background: at.color + '15', border: `1px solid ${at.color}30` }}>
                  Filtrando: {at.name}
                </div>
              ) : null;
            })()}

            {/* 3-column assignment grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {columns.map(col => (
                <div key={col.type} style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 14 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                    {col.title} <span style={{ fontSize: 10, color: '#86868B', fontWeight: 400 }}>{col.items.length}</span>
                  </h4>
                  {col.items.length === 0 ? (
                    <p style={{ fontSize: 11, color: '#86868B', textAlign: 'center', padding: '12px 0' }}>Sin elementos</p>
                  ) : (
                    col.items
                      .filter((item: { id: string; [k: string]: unknown }) => activeTag ? hasTag(activeTag, col.type, item.id) : true)
                      .map((item: { id: string; [k: string]: unknown }) => {
                        const itTags = entityTags(col.type, item.id);
                        return (
                          <div key={item.id} style={{ marginBottom: 8, padding: '8px 9px', borderRadius: 10, background: '#F9F9FB' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: (itTags.length > 0 || tags.length > 0) ? 5 : 0 }}>
                              <span style={{ fontSize: 16 }}>{col.getIcon(item as any)}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>{col.getLabel(item as any)}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {itTags.map(t => (
                                <span key={t.id} onClick={() => toggleAssign(t.id, col.type, item.id)}
                                  style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: t.color, color: '#FFF', cursor: 'pointer' }}>
                                  {t.name} ✕
                                </span>
                              ))}
                              {tags.filter(t => !hasTag(t.id, col.type, item.id)).map(t => (
                                <span key={t.id} onClick={() => toggleAssign(t.id, col.type, item.id)}
                                  style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, border: `1px dashed ${t.color}80`, color: t.color, cursor: 'pointer' }}>
                                  + {t.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
