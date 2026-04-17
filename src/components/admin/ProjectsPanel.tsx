// ═══ PROJECTS PANEL — Full project management with CRUD + cross-proyecto ═══
import { useState, useEffect } from 'preact/hooks';
import type { Room, Member } from '@app-types/index';
import { loadRooms, saveRoom, deleteRoom } from '@data/rooms';
import { loadTeamMembers } from '@data/team';
import { loadRetros } from '@data/retros';
import { loadDashboardData } from '@services/dashboard';
import { Icon } from '@components/common/Icon';
import { ANNUAL_VAC_DAYS } from '../../config/absenceTypes';

interface ProjectsPanelProps {
  onGoToRoom: (slug: string, tipo: string) => void;
}

const TIPOS = [
  { id: 'agile', label: '🏃 Agile / Scrum' },
  { id: 'kanban', label: '📋 Kanban' },
  { id: 'itil', label: '🔧 ITIL / Servicio' },
  { id: 'waterfall', label: '📐 Waterfall' },
];

const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;
const inputS = { padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const, background: '#F9F9FB' };
const labelS = { fontSize: 10, fontWeight: 700 as number, color: '#86868B', textTransform: 'uppercase' as const, display: 'block', marginBottom: 3, letterSpacing: 0.3 };

interface ProjectForm {
  name: string; slug: string; tipo: string;
  service_manager: string; start_date: string; end_date: string;
  ftes: string; status: string;
}

const emptyForm: ProjectForm = { name: '', slug: '', tipo: 'agile', service_manager: '', start_date: '', end_date: '', ftes: '', status: 'active' };

export function ProjectsPanel({ onGoToRoom }: ProjectsPanelProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [retros, setRetros] = useState<Record<string, number>>({});
  const [projectData, setProjectData] = useState<Record<string, { tasks: number; overdue: number; risks: number; pctDone: number }>>({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [form, setForm] = useState<ProjectForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([loadRooms(), loadTeamMembers(), loadRetros(), loadDashboardData()]).then(([roomsR, membersR, retrosR, dashData]) => {
      if (roomsR.ok) setRooms(roomsR.data);
      if (membersR.ok) setMembers(membersR.data);
      // Count retros per sala
      if (retrosR.ok) {
        const counts: Record<string, number> = {};
        retrosR.data.forEach((r: Record<string, unknown>) => {
          const sala = r.sala as string;
          counts[sala] = (counts[sala] || 0) + 1;
        });
        setRetros(counts);
      }
      // Project metrics
      const pd: typeof projectData = {};
      dashData.projectMetrics.forEach(p => {
        pd[p.slug] = { tasks: p.tasks.total, overdue: p.tasks.overdue, risks: p.risks.open, pctDone: p.tasks.pctDone };
      });
      setProjectData(pd);
      setLoading(false);
    });
  }, []);

  const getMeta = (r: Room, key: string) => (r.metadata as Record<string, unknown>)?.[key] as string || '';

  const vacPctForProject = (slug: string) => {
    const yr = new Date().getFullYear();
    const pMembers = members.filter(m => (m.rooms || []).includes(slug));
    if (pMembers.length === 0) return 0;
    let totalPct = 0;
    pMembers.forEach(m => {
      let used = 0;
      (m.vacations || []).filter(v => (v.type || 'vacaciones') === 'vacaciones' && v.from).forEach(v => {
        let d = new Date(v.from); const to = new Date(v.to || v.from);
        while (d <= to) { if (d.getFullYear() === yr && d.getDay() !== 0 && d.getDay() !== 6) used++; d.setDate(d.getDate() + 1); }
      });
      const total = (m.annual_vac_days || ANNUAL_VAC_DAYS) + (m.prev_year_pending || 0);
      totalPct += total > 0 ? (used / total) * 100 : 0;
    });
    return Math.round(totalPct / pMembers.length);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) return;
    setSaving(true);
    const metadata = {
      ...(editRoom?.metadata as Record<string, unknown> || {}),
      service_manager: form.service_manager,
      start_date: form.start_date,
      end_date: form.end_date,
      ftes: form.ftes,
      status: form.status,
    };
    await saveRoom({ slug: form.slug.trim(), name: form.name.trim(), tipo: form.tipo, metadata });
    // Refresh
    const result = await loadRooms();
    if (result.ok) setRooms(result.data);
    setSaving(false);
    setShowCreate(false);
    setEditRoom(null);
    setForm({ ...emptyForm });
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return;
    setSaving(true);
    await deleteRoom(deleteTarget.slug);
    setRooms(prev => prev.filter(r => r.slug !== deleteTarget.slug));
    setSaving(false);
    setDeleteTarget(null);
    setDeleteConfirm('');
  };

  const openEdit = (r: Room) => {
    setForm({
      name: r.name, slug: r.slug, tipo: r.tipo,
      service_manager: getMeta(r, 'service_manager'),
      start_date: getMeta(r, 'start_date'),
      end_date: getMeta(r, 'end_date'),
      ftes: getMeta(r, 'ftes'),
      status: getMeta(r, 'status') || 'active',
    });
    setEditRoom(r);
  };

  const openCreate = () => {
    setForm({ ...emptyForm });
    setShowCreate(true);
  };

  const smMembers = members.filter(m => (m.role_label || '').toLowerCase().includes('service manager') || (m.role_label || '').toLowerCase().includes('sm'));

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando proyectos...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Proyectos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openCreate}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="Plus" size={13} color="#FFF" /> Nuevo proyecto
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardS, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['Proyecto', 'Tipo', 'SM', 'Inicio', 'Fin', 'Estado', 'Equipo', 'Tareas', 'Riesgos', 'Retros', '% Vac.', ''].map(h => (
                  <th key={h} style={{ padding: '8px 8px', textAlign: h === 'Proyecto' ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', borderBottom: '2px solid #E5E5EA', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r, i) => {
                const meta = r.metadata as Record<string, unknown> || {};
                const status = (meta.status as string) || 'active';
                const statusLabel = status === 'closed' ? 'Cerrado' : status === 'paused' ? 'Parado' : 'Activo';
                const statusColor = status === 'closed' ? '#86868B' : status === 'paused' ? '#FF9500' : '#34C759';
                const teamCount = members.filter(m => (m.rooms || []).includes(r.slug)).length;
                const pd = projectData[r.slug] || { tasks: 0, overdue: 0, risks: 0, pctDone: 0 };
                const vPct = vacPctForProject(r.slug);
                const fd = (d: string) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
                return (
                  <tr key={r.slug} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                    <td style={{ padding: '10px 8px', borderBottom: '1px solid #F2F2F7' }}>
                      <span onClick={() => onGoToRoom(r.slug, r.tipo)}
                        style={{ fontWeight: 700, color: '#007AFF', cursor: 'pointer' }}>{r.name}</span>
                      <div style={{ fontSize: 10, color: '#AEAEB2' }}>{r.slug}</div>
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#6E6E73', background: '#F2F2F7', padding: '2px 7px', borderRadius: 6 }}>{r.tipo}</span>
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontSize: 11 }}>{(meta.service_manager as string) || '—'}</td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontSize: 10, color: '#6E6E73' }}>{fd(meta.start_date as string || '')}</td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontSize: 10, color: '#6E6E73' }}>{fd(meta.end_date as string || '')}</td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: statusColor + '12', padding: '2px 8px', borderRadius: 6 }}>{statusLabel}</span>
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 600 }}>{teamCount}</td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{pd.tasks}</span>
                      {pd.overdue > 0 && <span style={{ fontSize: 9, color: '#FF3B30', marginLeft: 3 }}>({pd.overdue}⚠)</span>}
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      {pd.risks > 0 ? <span style={{ fontWeight: 700, color: '#FF9500' }}>{pd.risks}</span> : <span style={{ color: '#D1D1D6' }}>0</span>}
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 600 }}>{retros[r.slug] || 0}</td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600, color: vPct < 50 ? '#FF3B30' : vPct < 80 ? '#FF9500' : '#34C759' }}>{vPct}%</span>
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="Edit" size={11} color="#007AFF" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); setDeleteConfirm(''); }}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="Trash2" size={11} color="#FF3B30" />
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

      {/* ── Create / Edit Modal ── */}
      {(showCreate || editRoom) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { setShowCreate(false); setEditRoom(null); }}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
              {editRoom ? 'Editar proyecto' : 'Nuevo proyecto'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={labelS}>Nombre</label>
                <input value={form.name} onInput={e => { const v = (e.target as HTMLInputElement).value; setForm({ ...form, name: v, slug: editRoom ? form.slug : v.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') }); }}
                  style={inputS} placeholder="Nombre del proyecto" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelS}>Slug</label>
                  <input value={form.slug} onInput={e => setForm({ ...form, slug: (e.target as HTMLInputElement).value })}
                    disabled={!!editRoom} style={{ ...inputS, opacity: editRoom ? 0.5 : 1 }} />
                </div>
                <div>
                  <label style={labelS}>Metodología</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: (e.target as HTMLSelectElement).value })}
                    style={inputS}>
                    {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelS}>Service Manager</label>
                  <select value={form.service_manager} onChange={e => setForm({ ...form, service_manager: (e.target as HTMLSelectElement).value })}
                    style={inputS}>
                    <option value="">— Sin asignar —</option>
                    {smMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    {/* Also allow typing any name */}
                    {form.service_manager && !smMembers.some(m => m.name === form.service_manager) && (
                      <option value={form.service_manager}>{form.service_manager}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label style={labelS}>Estado</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: (e.target as HTMLSelectElement).value })}
                    style={inputS}>
                    <option value="active">Activo</option>
                    <option value="paused">Parado</option>
                    <option value="closed">Cerrado</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelS}>Fecha inicio</label>
                  <input type="date" value={form.start_date} onInput={e => setForm({ ...form, start_date: (e.target as HTMLInputElement).value })}
                    style={inputS} />
                </div>
                <div>
                  <label style={labelS}>Fecha fin estimada</label>
                  <input type="date" value={form.end_date} onInput={e => setForm({ ...form, end_date: (e.target as HTMLInputElement).value })}
                    style={inputS} />
                </div>
                <div>
                  <label style={labelS}>FTEs estimados</label>
                  <input type="number" step="0.5" min="0" value={form.ftes} onInput={e => setForm({ ...form, ftes: (e.target as HTMLInputElement).value })}
                    style={inputS} placeholder="3.0" />
                </div>
              </div>
            </div>

            {editRoom && (
              <p style={{ fontSize: 10, color: '#AEAEB2', marginTop: 10 }}>El slug ({editRoom.slug}) no se puede cambiar.</p>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={() => { setShowCreate(false); setEditRoom(null); }}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!form.name.trim() || !form.slug.trim() || saving}
                style={{ flex: 2, padding: 11, borderRadius: 10, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!form.name.trim() || !form.slug.trim() || saving) ? 0.5 : 1 }}>
                {saving ? 'Guardando…' : editRoom ? 'Guardar cambios' : 'Crear proyecto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDeleteTarget(null)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Icon name="AlertTriangle" size={32} color="#FF3B30" />
              <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>Eliminar proyecto</h3>
              <p style={{ fontSize: 13, color: '#86868B', marginTop: 6 }}>
                Se eliminará <strong>{deleteTarget.name}</strong> y todos sus datos asociados (tareas, riesgos, retros). Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelS}>Escribe el nombre del proyecto para confirmar</label>
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
                {saving ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
