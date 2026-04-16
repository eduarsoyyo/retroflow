// ═══ TAB FORMACIÓN — Gap detection + training plans ═══
import { useState } from 'preact/hooks';
import type { Member, Skill, GapInfo } from '@app-types/index';
import { LEVEL_COLORS, LEVEL_LABELS, suggestActionType } from '@domain/skills';
import { suggestTrainingForGap } from '@services/skills';
import { Icon } from '@components/common/Icon';

interface SkillAction {
  id?: string;
  member_id: string;
  skill_id: string;
  sala: string;
  type: string;
  description: string;
  status: string;
  target_date?: string;
}

interface TabFormacionProps {
  team: Member[];
  gaps: GapInfo[];
  actions: unknown[];
  catalog: unknown[];
  skills: Skill[];
  sala: string;
  onRefresh: () => void;
}

export function TabFormacion({ team, gaps, actions, catalog, skills, sala, onRefresh }: TabFormacionProps) {
  const [filter, setFilter] = useState<'all' | 'critical'>('all');

  const criticalGaps = gaps.filter(g => g.gap >= 2);
  const displayGaps = filter === 'critical' ? criticalGaps : gaps;

  const actionsList = (actions || []) as SkillAction[];
  const getActionsForGap = (memberId: string, skillId: string) =>
    actionsList.filter(a => a.member_id === memberId && a.skill_id === skillId);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Plan de formación</h3>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>
            {gaps.length} gaps detectados · {criticalGaps.length} críticos (≥2 niveles)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'critical'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: filter === f ? 'none' : '1.5px solid #E5E5EA',
                background: filter === f ? '#1D1D1F' : '#FFF',
                color: filter === f ? '#FFF' : '#6E6E73',
              }}>
              {f === 'all' ? 'Todos' : 'Críticos'}
            </button>
          ))}
        </div>
      </div>

      {displayGaps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#34C759' }}>
          <Icon name="CheckCircle2" size={36} color="#34C759" />
          <p style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>
            {filter === 'critical' ? 'Sin gaps críticos' : '¡Equipo al 100%!'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayGaps.map((g, i) => {
            const suggested = suggestActionType(g.gap);
            const existingActions = getActionsForGap(g.member.id, g.skill?.id || '');
            const trainingSuggestions = suggestTrainingForGap(g, catalog as Array<{ name: string; category: string; subcategory?: string }>);

            return (
              <div key={`${g.member.id}-${g.skill?.id}-${i}`}
                style={{
                  background: '#FFF', borderRadius: 12, border: '1.5px solid #E5E5EA',
                  borderLeft: `4px solid ${g.gap >= 2 ? '#FF3B30' : '#FF9500'}`,
                  padding: '12px 14px',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: g.member.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                    {g.member.avatar || '👤'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{g.member.name}</span>
                    <span style={{ fontSize: 10, color: '#86868B', marginLeft: 6 }}>{g.profileName}</span>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    background: g.gap >= 2 ? '#FF3B3015' : '#FF950015',
                    color: g.gap >= 2 ? '#FF3B30' : '#FF9500',
                  }}>
                    Gap: {g.gap}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span>{g.skill?.icon || '📘'} {g.skill?.name || '?'}</span>
                  <span style={{ color: '#86868B' }}>
                    Actual: <span style={{ fontWeight: 700, color: LEVEL_COLORS[g.current] || '#C7C7CC' }}>{g.current || '—'}</span>
                    {' → '}
                    Req: <span style={{ fontWeight: 700, color: LEVEL_COLORS[g.required] }}>{g.required}</span>
                  </span>
                  <span style={{
                    fontSize: 9, padding: '2px 7px', borderRadius: 5,
                    background: '#007AFF10', color: '#007AFF', fontWeight: 600,
                  }}>
                    Sugerencia: {suggested}
                  </span>
                </div>

                {/* Existing actions */}
                {existingActions.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {existingActions.map((a: SkillAction, j: number) => (
                      <span key={a.id || j} style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 5, fontWeight: 600,
                        background: a.status === 'completada' ? '#34C75915' : a.status === 'en_curso' ? '#007AFF10' : '#F2F2F7',
                        color: a.status === 'completada' ? '#34C759' : a.status === 'en_curso' ? '#007AFF' : '#86868B',
                      }}>
                        {a.status === 'completada' ? 'Hecho' : a.status === 'en_curso' ? 'En curso' : 'Pendiente'} {a.description?.slice(0, 40) || a.type}
                      </span>
                    ))}
                  </div>
                )}

                {/* Training suggestions from catalog */}
                {trainingSuggestions.length > 0 && existingActions.length === 0 && (
                  <div style={{ marginTop: 6, fontSize: 9, color: '#86868B' }}>
                    Catálogo: {trainingSuggestions.map((t: { name: string }) => t.name).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
