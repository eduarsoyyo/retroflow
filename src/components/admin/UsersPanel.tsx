// ═══ USERS PANEL — Full user management table ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Member, Room } from '@app-types/index';
import { loadTeamMembers, saveTeamMember } from '@data/team';
import { loadRooms } from '@data/rooms';
import { loadCalendarios, type Calendario } from '@data/calendarios';
import { setUserPassword } from '@data/auth';
import { Icon } from '@components/common/Icon';
import { ANNUAL_VAC_DAYS } from '../../config/absenceTypes';

// Load roles from admin table
async function loadAdminRoles(): Promise<Array<{ id: string; name: string }>> {
  try {
    const { supabase } = await import('../../data/supabase');
    const { data } = await supabase.from('admin_roles').select('*').order('name');
    return data ?? [];
  } catch { return []; }
}

// Load org_chart entries for a member (all projects, multiple periods)
async function loadOrgForMember(memberId: string): Promise<Array<{ id: string; sala: string; dedication: number; start_date: string; end_date: string }>> {
  try {
    const { supabase } = await import('../../data/supabase');
    const { data } = await supabase.from('org_chart').select('id, sala, dedication, start_date, end_date').eq('member_id', memberId);
    return (data ?? []).map(d => ({ id: d.id, sala: d.sala, dedication: d.dedication ?? 1, start_date: d.start_date || '', end_date: d.end_date || '' }));
  } catch { return []; }
}

// Save all org_chart entries for a member (delete old, insert new)
async function saveOrgEntries(memberId: string, assignments: ProjectAssignment[]) {
  try {
    const { supabase } = await import('../../data/supabase');
    // Delete all existing entries for this member
    const { error: delErr } = await supabase.from('org_chart').delete().eq('member_id', memberId);
    if (delErr) console.error('org_chart delete failed:', delErr);
    // Insert new entries
    const rows = assignments.flatMap(a =>
      a.periods.map(p => ({
        member_id: memberId,
        sala: a.slug,
        dedication: p.dedication,
        start_date: p.start_date || null,
        end_date: p.end_date || null,
      }))
    );
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('org_chart').insert(rows);
      if (insErr) console.error('org_chart insert failed:', insErr);
    }
  } catch (e) { console.error('saveOrgEntries exception:', e); }
}

// Delete org_chart entry
async function deleteOrgEntry(memberId: string, sala: string) {
  try {
    const { supabase } = await import('../../data/supabase');
    await supabase.from('org_chart').delete().eq('member_id', memberId).eq('sala', sala);
  } catch {}
}

const inputS = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#F9F9FB' };
const labelS = { fontSize: 10, fontWeight: 700 as number, color: '#86868B', display: 'block', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: 0.3 };
const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;

interface DedicationPeriod {
  orgId?: string;
  dedication: number; // 0-1
  start_date: string;
  end_date: string;
}

interface ProjectAssignment {
  slug: string;
  periods: DedicationPeriod[];
}

interface UserForm {
  name: string; username: string; email: string; password: string;
  role_label: string; company: string; phone: string;
  calendario_id: string; manager_id: string;
  hire_date: string; status: string; is_superuser: boolean;
  rooms: string[]; avatar: string; color: string; house: string;
  projectAssignments: ProjectAssignment[];
}

const emptyForm: UserForm = {
  name: '', username: '', email: '', password: '',
  role_label: '', company: '', phone: '',
  calendario_id: '', manager_id: '',
  hire_date: '', status: 'active', is_superuser: false,
  rooms: [], avatar: '👤', color: '#007AFF', house: '',
  projectAssignments: [],
};

const AVATAR_OPTIONS = ['🦊','🐻','🐼','🦁','🦉','🐍','🦡','🦅','🐉','🦄','🧙','⚡','🔮','🏰','🪄','🐺','🦋','🐝','🌙','🔥','💎','🎯','🍀','🦚'];
const HOUSE_OPTIONS = [
  { id: '', label: 'Sin casa', color: '#86868B', emoji: '' },
  { id: 'gryffindor', label: 'Gryffindor', color: '#AE0001', emoji: '🦁' },
  { id: 'slytherin', label: 'Slytherin', color: '#2A623D', emoji: '🐍' },
  { id: 'ravenclaw', label: 'Ravenclaw', color: '#0E1A40', emoji: '🦅' },
  { id: 'hufflepuff', label: 'Hufflepuff', color: '#FFDB00', emoji: '🦡' },
];
const COLOR_OPTIONS = [
  '#007AFF','#5856D6','#AF52DE','#FF2D55','#FF3B30','#FF9500','#FFCC00','#34C759','#00C7BE','#30B0C7',
  '#1D1D1F','#3A3A3C','#0E1A40','#2A623D','#8B4513','#4A0E4E','#1B3A4B','#6B2D2D',
  '#FFFFFF','#F0F0F5','#FFE5EC','#FFF3CD','#D4EDDA','#CCE5FF','#E8DAEF','#FDEBD0','#D5F5E3','#D6EAF8',
];

export function UsersPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [orgData, setOrgData] = useState<Array<{ member_id: string; sala: string; dedication: number; start_date: string; end_date: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [form, setForm] = useState<UserForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    const loadAllOrg = async () => {
      try {
        const { supabase } = await import('../../data/supabase');
        const { data } = await supabase.from('org_chart').select('member_id, sala, dedication, start_date, end_date');
        return (data ?? []).map(d => ({ member_id: d.member_id, sala: d.sala, dedication: d.dedication ?? 1, start_date: d.start_date || '', end_date: d.end_date || '' }));
      } catch { return []; }
    };
    Promise.all([loadTeamMembers(), loadAdminRoles(), loadCalendarios(), loadRooms(), loadAllOrg()]).then(([mR, rolesData, cals, roomsR, org]) => {
      if (mR.ok) setMembers(mR.data);
      setRoles(rolesData || []);
      setCalendarios(cals);
      if (roomsR.ok) setRooms(roomsR.data);
      setOrgData(org);
      setLoading(false);
    });
  }, []);

  // Dedication helpers (current = based on today's date)
  const today = new Date().toISOString().slice(0, 10);
  const memberDedication = (m: Member) => {
    const entries = orgData.filter(o => o.member_id === m.id);
    // Only count periods active today
    return entries.filter(e => {
      const s = (e as any).start_date || '';
      const ed = (e as any).end_date || '';
      if (s && s > today) return false;
      if (ed && ed < today) return false;
      return true;
    }).reduce((s, e) => s + (e.dedication || 0), 0);
  };
  const memberIntercontrato = (m: Member) => Math.max(0, 1 - memberDedication(m));

  const filtered = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.username || '').toLowerCase().includes(q) ||
      (m.company || '').toLowerCase().includes(q)
    );
  }, [members, search]);

  const yr = new Date().getFullYear();

  const vacUsed = (m: Member) => {
    let used = 0;
    (m.vacations || []).filter(v => (v.type || 'vacaciones') === 'vacaciones' && v.from).forEach(v => {
      let d = new Date(v.from); const to = new Date(v.to || v.from);
      while (d <= to) { if (d.getFullYear() === yr && d.getDay() !== 0 && d.getDay() !== 6) used++; d.setDate(d.getDate() + 1); }
    });
    return used;
  };

  const ausCount = (m: Member) => {
    return (m.vacations || []).filter(v => v.from && (v.type || 'vacaciones') !== 'vacaciones' && new Date(v.from).getFullYear() === yr).length;
  };

  const calName = (m: Member) => {
    const cid = (m as Record<string, unknown>).calendario_id as string;
    if (!cid) return '—';
    const c = calendarios.find(x => x.id === cid);
    return c ? c.name : '—';
  };

  const managerName = (m: Member) => {
    const mid = (m as Record<string, unknown>).manager_id as string;
    if (!mid) return '—';
    const mgr = members.find(x => x.id === mid);
    return mgr ? mgr.name.split(' ')[0] : '—';
  };

  const memberProjects = (m: Member) => (m.rooms || []).map(slug => {
    const r = rooms.find(x => x.slug === slug);
    return r ? r.name : slug;
  });

  const openCreate = () => { setForm({ ...emptyForm }); setEditMember(null); setModal('create'); };
  const openEdit = async (m: Member) => {
    const orgEntries = await loadOrgForMember(m.id);
    // Group by sala → multiple periods per project
    const paMap: Record<string, DedicationPeriod[]> = {};
    for (const o of orgEntries) {
      if (!paMap[o.sala]) paMap[o.sala] = [];
      paMap[o.sala].push({ orgId: o.id, dedication: o.dedication, start_date: o.start_date, end_date: o.end_date });
    }
    const pa: ProjectAssignment[] = (m.rooms || []).map(slug => ({
      slug,
      periods: paMap[slug] || [{ dedication: 1, start_date: '', end_date: '' }],
    }));
    setForm({
      name: m.name, username: m.username || '', email: m.email || '', password: '',
      role_label: m.role_label || '', company: m.company || '', phone: m.phone || '',
      calendario_id: (m as Record<string, unknown>).calendario_id as string || '',
      manager_id: (m as Record<string, unknown>).manager_id as string || '',
      hire_date: (m as Record<string, unknown>).hire_date as string || '',
      status: (m as Record<string, unknown>).status as string || 'active',
      is_superuser: !!m.is_superuser,
      rooms: m.rooms || [],
      avatar: m.avatar || '👤',
      color: m.color || '#007AFF',
      house: m.house || '',
      projectAssignments: pa,
    });
    setEditMember(m);
    setModal('edit');
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: form.name, email: form.email, username: form.username || form.name.toLowerCase().replace(/\s+/g, '.'),
      role_label: form.role_label, company: form.company, phone: form.phone,
      is_superuser: form.is_superuser,
      calendario_id: form.calendario_id || null,
      manager_id: form.manager_id || null,
      hire_date: form.hire_date || null,
      status: form.status || 'active',
      rooms: form.rooms,
      avatar: form.avatar || '👤',
      color: form.color || '#007AFF',
      house: form.house || null,
    };
    if (modal === 'create') {
      payload.id = crypto.randomUUID();
      payload.vacations = [];
      payload.annual_vac_days = 22;
      payload.prev_year_pending = 0;
    } else if (editMember) {
      payload.id = editMember.id;
      payload.vacations = editMember.vacations;
      payload.annual_vac_days = editMember.annual_vac_days;
      payload.prev_year_pending = editMember.prev_year_pending;
    }
    const result = await saveTeamMember(payload as Member);
    if (result.ok) {
      if (form.password) await setUserPassword(result.data.id, form.password);
      // Save org_chart entries (multiple periods per project)
      const memberId = result.data.id;
      await saveOrgEntries(memberId, form.projectAssignments);
      if (modal === 'create') setMembers(prev => [...prev, result.data]);
      else setMembers(prev => prev.map(m => m.id === editMember?.id ? result.data : m));
    }
    setSaving(false);
    setModal(null);
    setEditMember(null);
    // Reload org data for table
    try {
      const { supabase } = await import('../../data/supabase');
      const { data } = await supabase.from('org_chart').select('member_id, sala, dedication, start_date, end_date');
      setOrgData((data ?? []).map(d => ({ member_id: d.member_id, sala: d.sala, dedication: d.dedication ?? 1, start_date: d.start_date || '', end_date: d.end_date || '' })));
    } catch {}
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return;
    setSaving(true);
    try {
      const { supabase } = await import('../../data/supabase');
      await supabase.from('team_members').delete().eq('id', deleteTarget.id);
      setMembers(prev => prev.filter(m => m.id !== deleteTarget.id));
    } catch {}
    setSaving(false);
    setDeleteTarget(null);
    setDeleteConfirm('');
  };

  const toggleSuperuser = async (m: Member) => {
    const u = { ...m, is_superuser: !m.is_superuser };
    await saveTeamMember(u);
    setMembers(prev => prev.map(x => x.id === m.id ? u : x));
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando usuarios…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Usuarios</h3>
          <p style={{ fontSize: 12, color: '#86868B' }}>{members.length} registrados · {members.filter(m => (m as Record<string, unknown>).status !== 'inactive').length} activos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={search} onInput={e => setSearch((e.target as HTMLInputElement).value)} placeholder="Buscar…"
            style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none', width: 200 }} />
          <button onClick={openCreate} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            <Icon name="Plus" size={13} color="#FFF" /> Nuevo usuario
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardS, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['', 'Nombre', 'Usuario', 'Email', 'Empresa', 'Rol', 'Proyectos', 'Dedicación', 'No asignado', 'Calendario', 'Vac. pend.', 'Admin', 'Estado', ''].map(h => (
                  <th key={h} style={{ padding: '7px 6px', fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', borderBottom: '2px solid #E5E5EA', whiteSpace: 'nowrap', textAlign: h === 'Nombre' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const vacPend = Math.max(0, (m.annual_vac_days || ANNUAL_VAC_DAYS) + (m.prev_year_pending || 0) - vacUsed(m));
                const status = (m as Record<string, unknown>).status as string || 'active';
                const projs = memberProjects(m);
                const ded = memberDedication(m);
                const inter = memberIntercontrato(m);
                return (
                  <tr key={m.id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, background: m.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, margin: '0 auto' }}>
                        {m.avatar || '👤'}
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #F2F2F7', fontWeight: 700 }}>{m.name}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', color: '#6E6E73' }}>{m.username || '—'}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontSize: 10, color: '#6E6E73' }}>{m.email || '—'}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontSize: 10 }}>{m.company || '—'}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      {m.role_label ? <span style={{ fontSize: 9, fontWeight: 600, color: '#5856D6', background: '#5856D610', padding: '2px 6px', borderRadius: 5 }}>{m.role_label}</span> : <span style={{ color: '#D1D1D6' }}>—</span>}
                    </td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      {projs.length > 0 ? (
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {projs.slice(0, 3).map(p => <span key={p} style={{ fontSize: 8, background: '#007AFF10', color: '#007AFF', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>{p.length > 12 ? p.slice(0, 12) + '…' : p}</span>)}
                          {projs.length > 3 && <span style={{ fontSize: 8, color: '#86868B' }}>+{projs.length - 3}</span>}
                        </div>
                      ) : <span style={{ color: '#D1D1D6' }}>—</span>}
                    </td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 700, fontSize: 11, color: ded >= 1 ? '#34C759' : ded > 0 ? '#007AFF' : '#D1D1D6' }}>
                      {ded > 0 ? `${Math.round(ded * 100)}%` : '—'}
                    </td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 700, fontSize: 11, color: inter > 0.5 ? '#FF3B30' : inter > 0 ? '#FF9500' : '#34C759' }}>
                      {Math.round(inter * 100)}%
                    </td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontSize: 10, color: '#6E6E73' }}>{calName(m)}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 600, color: vacPend <= 5 ? '#FF3B30' : vacPend <= 10 ? '#FF9500' : '#34C759' }}>{vacPend}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!m.is_superuser} onChange={() => toggleSuperuser(m)} style={{ accentColor: '#007AFF', cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: status === 'active' ? '#34C759' : '#86868B', background: status === 'active' ? '#34C75912' : '#F2F2F7', padding: '2px 6px', borderRadius: 5 }}>
                        {status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                        <button onClick={() => openEdit(m)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="Edit" size={10} color="#007AFF" />
                        </button>
                        <button onClick={() => { setDeleteTarget(m); setDeleteConfirm(''); }} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="Trash2" size={10} color="#FF3B30" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create/Edit Modal ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { setModal(null); setEditMember(null); } }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)' }} />
          <div style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '95%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>{modal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</h3>
              <button onClick={() => { setModal(null); setEditMember(null); }}
                style={{ border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="X" size={16} color="#86868B" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Avatar + Color + Name row */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <label style={labelS}>Avatar</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
                    {AVATAR_OPTIONS.map(a => (
                      <button key={a} onClick={() => setForm({ ...form, avatar: a })}
                        style={{ width: 28, height: 28, borderRadius: 8, border: form.avatar === a ? '2px solid #007AFF' : '1px solid #E5E5EA', background: form.avatar === a ? '#007AFF10' : '#FFF', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelS}>Color</label>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {COLOR_OPTIONS.map(c => (
                      <button key={c} onClick={() => setForm({ ...form, color: c })}
                        style={{ width: 24, height: 24, borderRadius: 6, background: c, border: form.color === c ? '3px solid #1D1D1F' : `1px solid ${c === '#FFFFFF' || c === '#F0F0F5' ? '#E5E5EA' : 'transparent'}`, cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Nombre *</label><input value={form.name} onInput={e => setForm({ ...form, name: (e.target as HTMLInputElement).value })} style={inputS} /></div>
                <div><label style={labelS}>Usuario</label><input value={form.username} onInput={e => setForm({ ...form, username: (e.target as HTMLInputElement).value })} placeholder={form.name.toLowerCase().replace(/\s+/g, '.')} style={inputS} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Email</label><input type="email" value={form.email} onInput={e => setForm({ ...form, email: (e.target as HTMLInputElement).value })} style={inputS} /></div>
                <div><label style={labelS}>Contraseña{modal === 'edit' ? ' (vacío = mantener)' : ''}</label><input type="password" value={form.password} onInput={e => setForm({ ...form, password: (e.target as HTMLInputElement).value })} style={inputS} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Empresa</label><input value={form.company} onInput={e => setForm({ ...form, company: (e.target as HTMLInputElement).value })} style={inputS} /></div>
                <div><label style={labelS}>Teléfono</label><input value={form.phone} onInput={e => setForm({ ...form, phone: (e.target as HTMLInputElement).value })} style={inputS} /></div>
                <div><label style={labelS}>Rol</label>
                  <select value={form.role_label} onChange={e => setForm({ ...form, role_label: (e.target as HTMLSelectElement).value })} style={inputS}>
                    <option value="">— Sin rol —</option>
                    {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Casa */}
              <div>
                <label style={labelS}>Casa</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {HOUSE_OPTIONS.map(h => (
                    <button key={h.id} onClick={() => setForm({ ...form, house: h.id })}
                      style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: form.house === h.id ? `2px solid ${h.color}` : '1.5px solid #E5E5EA', background: form.house === h.id ? h.color + '15' : '#FFF', cursor: 'pointer', textAlign: 'center', fontSize: 10, fontWeight: form.house === h.id ? 700 : 500, color: form.house === h.id ? h.color : '#86868B' }}>
                      {h.emoji && <div style={{ fontSize: 16 }}>{h.emoji}</div>}
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Calendario</label>
                  <select value={form.calendario_id} onChange={e => setForm({ ...form, calendario_id: (e.target as HTMLSelectElement).value })} style={inputS}>
                    <option value="">— Sin calendario —</option>
                    {calendarios.map(c => <option key={c.id} value={c.id}>{c.name} ({c.region || c.year})</option>)}
                  </select>
                </div>
                <div><label style={labelS}>Responsable directo</label>
                  <select value={form.manager_id} onChange={e => setForm({ ...form, manager_id: (e.target as HTMLSelectElement).value })} style={inputS}>
                    <option value="">— Sin responsable —</option>
                    {members.filter(m => m.id !== editMember?.id).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Proyectos */}
              <div>
                <label style={labelS}>Proyectos asignados</label>
                {/* Available projects to add */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {rooms.filter(r => !form.rooms.includes(r.slug)).map(r => (
                    <button key={r.slug} onClick={() => {
                      setForm({
                        ...form,
                        rooms: [...form.rooms, r.slug],
                        projectAssignments: [...form.projectAssignments, { slug: r.slug, periods: [{ dedication: 1, start_date: '', end_date: '' }] }],
                      });
                    }}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1.5px dashed #E5E5EA', background: '#FFF', color: '#86868B', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Icon name="Plus" size={9} color="#86868B" /> {r.name}
                    </button>
                  ))}
                </div>
                {/* Assigned projects with periods */}
                {form.projectAssignments.map((pa, paIdx) => {
                  const room = rooms.find(r => r.slug === pa.slug);
                  return (
                    <div key={pa.slug} style={{ padding: '8px 10px', borderRadius: 10, background: '#007AFF06', border: '1px solid #007AFF15', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#007AFF' }}>{room?.name || pa.slug}</span>
                        <span style={{ fontSize: 9, color: '#86868B' }}>{pa.periods.length} periodo{pa.periods.length !== 1 ? 's' : ''}</span>
                        <button onClick={() => {
                          const updated = [...form.projectAssignments];
                          updated[paIdx] = { ...pa, periods: [...pa.periods, { dedication: 1, start_date: '', end_date: '' }] };
                          setForm({ ...form, projectAssignments: updated });
                        }}
                          style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 5, border: '1px solid #007AFF30', background: '#FFF', fontSize: 9, fontWeight: 600, color: '#007AFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Icon name="Plus" size={8} color="#007AFF" /> Periodo
                        </button>
                        <button onClick={() => setForm({ ...form, rooms: form.rooms.filter(s => s !== pa.slug), projectAssignments: form.projectAssignments.filter((_, i) => i !== paIdx) })}
                          style={{ width: 20, height: 20, borderRadius: 5, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="Trash2" size={9} color="#FF3B30" />
                        </button>
                      </div>
                      {pa.periods.map((p, pIdx) => (
                        <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, paddingLeft: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <input type="number" min="0" max="100" step="5" value={Math.round(p.dedication * 100)}
                              onInput={e => {
                                const v = parseInt((e.target as HTMLInputElement).value) || 0;
                                const updated = [...form.projectAssignments];
                                const periods = [...pa.periods];
                                periods[pIdx] = { ...p, dedication: Math.min(1, Math.max(0, v / 100)) };
                                updated[paIdx] = { ...pa, periods };
                                setForm({ ...form, projectAssignments: updated });
                              }}
                              style={{ width: 42, padding: '3px 2px', borderRadius: 5, border: '1px solid #E5E5EA', fontSize: 11, textAlign: 'center', outline: 'none', fontWeight: 700 }} />
                            <span style={{ fontSize: 9, color: '#86868B' }}>%</span>
                          </div>
                          <input type="date" value={p.start_date}
                            onInput={e => {
                              const updated = [...form.projectAssignments];
                              const periods = [...pa.periods];
                              periods[pIdx] = { ...p, start_date: (e.target as HTMLInputElement).value };
                              updated[paIdx] = { ...pa, periods };
                              setForm({ ...form, projectAssignments: updated });
                            }}
                            style={{ padding: '3px 3px', borderRadius: 5, border: '1px solid #E5E5EA', fontSize: 10, outline: 'none' }} />
                          <span style={{ fontSize: 9, color: '#C7C7CC' }}>→</span>
                          <input type="date" value={p.end_date}
                            onInput={e => {
                              const updated = [...form.projectAssignments];
                              const periods = [...pa.periods];
                              periods[pIdx] = { ...p, end_date: (e.target as HTMLInputElement).value };
                              updated[paIdx] = { ...pa, periods };
                              setForm({ ...form, projectAssignments: updated });
                            }}
                            style={{ padding: '3px 3px', borderRadius: 5, border: '1px solid #E5E5EA', fontSize: 10, outline: 'none' }} />
                          {pa.periods.length > 1 && (
                            <button onClick={() => {
                              const updated = [...form.projectAssignments];
                              updated[paIdx] = { ...pa, periods: pa.periods.filter((_, i) => i !== pIdx) };
                              setForm({ ...form, projectAssignments: updated });
                            }}
                              style={{ width: 16, height: 16, borderRadius: 4, border: 'none', background: '#FF3B3010', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="X" size={7} color="#FF3B30" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {form.projectAssignments.length === 0 && <p style={{ fontSize: 10, color: '#C7C7CC', textAlign: 'center', padding: 6 }}>Sin proyectos asignados</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Fecha incorporación</label><input type="date" value={form.hire_date} onInput={e => setForm({ ...form, hire_date: (e.target as HTMLInputElement).value })} style={inputS} /></div>
                <div><label style={labelS}>Estado</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: (e.target as HTMLSelectElement).value })} style={inputS}>
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_superuser} onChange={() => setForm({ ...form, is_superuser: !form.is_superuser })} style={{ accentColor: '#007AFF' }} />
                    Administrador
                  </label>
                </div>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              style={{ width: '100%', padding: 11, borderRadius: 11, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 16, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : modal === 'create' ? 'Crear usuario' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDeleteTarget(null)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Icon name="AlertTriangle" size={32} color="#FF3B30" />
              <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>Eliminar usuario</h3>
              <p style={{ fontSize: 13, color: '#86868B', marginTop: 6 }}>
                Se eliminará <strong>{deleteTarget.name}</strong>. Tiene {(deleteTarget.rooms || []).length} proyectos asignados y {(deleteTarget.vacations || []).length} registros de ausencias.
              </p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelS}>Escribe el nombre para confirmar</label>
              <input value={deleteConfirm} onInput={e => setDeleteConfirm((e.target as HTMLInputElement).value)}
                placeholder={deleteTarget.name} style={{ ...inputS, borderColor: deleteConfirm === deleteTarget.name ? '#FF3B30' : '#E5E5EA' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleteConfirm !== deleteTarget.name || saving}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', background: deleteConfirm === deleteTarget.name ? '#FF3B30' : '#E5E5EA', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
