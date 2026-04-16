// ═══ ORG CHART — Tree organigrama with click-to-edit manager ═══
import { useState } from 'preact/hooks';
import type { Member } from '@app-types/index';

interface OrgNodeProps {
  member: Member;
  depth: number;
  team: Member[];
  org: Record<string, string | null>;
  onSetManager: (memberId: string, managerId: string | null) => void;
  saving: boolean;
}

function OrgNode({ member, depth, team, org, onSetManager, saving }: OrgNodeProps) {
  const [showEdit, setShowEdit] = useState(false);
  const children = team.filter(x => (org[x.id] || null) === member.id);
  const n = children.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {depth > 0 && <div style={{ width: 2, height: 20, background: '#D1D1D6' }} />}
      <div onClick={() => setShowEdit(!showEdit)}
        style={{
          background: '#FFF', borderRadius: 14, border: `2px solid ${depth === 0 ? '#1D1D1F' : '#E5E5EA'}`,
          padding: '14px 16px', minWidth: 130, textAlign: 'center',
          boxShadow: depth === 0 ? '0 4px 16px rgba(0,0,0,.08)' : '0 2px 8px rgba(0,0,0,.04)',
          cursor: 'pointer', zIndex: 1,
        }}>
        <div style={{ fontSize: 30, marginBottom: 6 }}>{member.avatar || '👤'}</div>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{member.name}</div>
        {member.role_label && <div style={{ fontSize: 10, color: '#86868B', marginTop: 2 }}>{member.role_label}</div>}
        {showEdit && (
          <select
            value={org[member.id] || ''}
            onClick={e => e.stopPropagation()}
            onChange={e => { onSetManager(member.id, (e.target as HTMLSelectElement).value || null); setShowEdit(false); }}
            disabled={saving}
            style={{ fontSize: 10, border: '1px solid #E5E5EA', borderRadius: 6, padding: '4px', width: '100%', color: '#6E6E73', outline: 'none', background: '#FAFAFA', marginTop: 6 }}
          >
            <option value="">Sin manager (raíz)</option>
            {team.filter(t => t.id !== member.id).map(t => (
              <option key={t.id} value={t.id}>↑ {t.name}</option>
            ))}
          </select>
        )}
      </div>
      {n > 0 && (
        <>
          <div style={{ width: 2, height: 20, background: '#D1D1D6' }} />
          <div style={{ display: 'flex' }}>
            {children.map((ch, i) => (
              <div key={ch.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px' }}>
                {n > 1 && <div style={{ alignSelf: 'stretch', height: 0, borderTop: '2px solid #D1D1D6', marginLeft: i === 0 ? '50%' : '0', marginRight: i === n - 1 ? '50%' : '0' }} />}
                {n > 1 && <div style={{ width: 2, height: 20, background: '#D1D1D6' }} />}
                <OrgNode member={ch} depth={depth + 1} team={team} org={org} onSetManager={onSetManager} saving={saving} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main export ──

interface OrgChartProps {
  team: Member[];
  org: Record<string, string | null>;
  onSetManager: (memberId: string, managerId: string | null) => void;
  saving: boolean;
}

export function OrgChart({ team, org, onSetManager, saving }: OrgChartProps) {
  const roots = team.filter(m => (org[m.id] || null) === null);
  const unassigned = team.filter(m => !Object.keys(org).includes(m.id));

  return (
    <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Organigrama del proyecto</h4>
      {roots.map(m => <OrgNode key={m.id} member={m} depth={0} team={team} org={org} onSetManager={onSetManager} saving={saving} />)}
      {unassigned.length > 0 && (
        <div style={{ marginTop: 12, padding: 10, background: '#F9F9FB', borderRadius: 10 }}>
          <p style={{ fontSize: 11, color: '#86868B', marginBottom: 6 }}>Sin asignar al organigrama:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {unassigned.map(m => (
              <button key={m.id} onClick={() => onSetManager(m.id, null)}
                style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: '1px dashed #E5E5EA', background: '#FFF', cursor: 'pointer' }}>
                {m.avatar || '👤'} {m.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
