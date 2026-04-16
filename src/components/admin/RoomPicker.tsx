// ═══ ROOM PICKER — Centro de Control shell ═══
// Manages rooms/projects and hosts admin tabs (Dashboard, Maestros, Roles, etc.)

import { useState, useEffect } from 'preact/hooks';
import type { Room, Member, AppUser } from '@app-types/index';
import { loadRooms, saveRoom } from '@data/rooms';
import { loadRetros } from '@data/retros';
import { loadTeamMembers } from '@data/team';
import { AdminDashboard } from './AdminDashboard';
import { AdminRoles, AdminUsuarios, AdminConvenio, AdminCalendarios, AdminEscaladoGlobal, MaestrosPanel } from './AdminPanels';
import { CrossProject } from './CrossProject';
import { ConsultantTimeline } from './ConsultantTimeline';
import { Icon } from '@components/common/Icon';
import { Loading } from '@components/common/Feedback';
import { ProfileEditor } from '@components/common/ProfileEditor';
import { NotificationBell } from '@components/common/NotificationBell';

interface RoomPickerProps {
  user: AppUser;
  onGoToRoom: (slug: string, tipo: string) => void;
  onLogout: () => void;
  onBackToHome: () => void;
}

const ADMIN_TABS = [
  { id: 'dashboard',       icon: 'BarChart3',    label: 'Dashboard' },
  { id: 'cross_proyecto',  icon: 'GitBranch',    label: 'Cross-proyecto' },
  { id: 'proyectos',       icon: 'FolderOpen',   label: 'Proyectos' },
  { id: 'maestros',        icon: 'Database',     label: 'Maestros' },
  { id: 'escalado_global', icon: 'TrendingUp',   label: 'Escalado' },
  { id: 'usuarios',        icon: 'Users',        label: 'Usuarios' },
  { id: 'roles',           icon: 'Shield',       label: 'Roles' },
  { id: 'convenio',        icon: 'FileText',     label: 'Convenio' },
  { id: 'calendarios',     icon: 'Calendar',     label: 'Calendarios' },
] as const;

export function RoomPicker({ user, onGoToRoom, onLogout, onBackToHome }: RoomPickerProps) {
  const [tab, setTab] = useState('dashboard');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState<string[]>([]);
  const [userProfile, setUserProfile] = useState<Member | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  // New room form
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newTipo, setNewTipo] = useState('agile');

  useEffect(() => {
    loadRooms().then(result => {
      if (result.ok) setRooms(result.data);
      setLoading(false);
    });
    loadTeamMembers().then(r => {
      if (r.ok) {
        const me = r.data.find(m => m.id === user.id || m.name === user.name);
        if (me) setUserProfile(me);
      }
    });
  }, []);

  const handleCreateRoom = async () => {
    if (!newName.trim() || !newSlug.trim()) return;
    await saveRoom({ slug: newSlug.trim(), name: newName.trim(), tipo: newTipo });
    setRooms(prev => [...prev, { slug: newSlug.trim(), name: newName.trim(), tipo: newTipo, metadata: {} }]);
    setNewName(''); setNewSlug(''); setNewTipo('agile');
  };

  if (loading) return <Loading />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F5F7' }}>
      {/* Sidebar */}
      <aside style={{ width: 200, background: '#FFF', borderRight: '1px solid #E5E5EA', padding: '20px 10px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '0 6px' }}>
          <h2 style={{ fontFamily: "'Comfortaa',sans-serif", fontSize: 18, fontWeight: 400, background: 'linear-gradient(90deg,#007AFF,#5856D6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>revelio</h2>
          <span style={{ fontSize: 9, background: '#5856D610', color: '#5856D6', padding: '2px 6px', borderRadius: 5, fontWeight: 700 }}>Admin</span>
        </div>

        {ADMIN_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
              border: 'none', background: tab === t.id ? '#F2F2F7' : 'transparent',
              color: tab === t.id ? '#007AFF' : '#6E6E73', fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
              cursor: 'pointer', marginBottom: 1, width: '100%', textAlign: 'left',
            }}>
            <Icon name={t.icon} size={14} color={tab === t.id ? '#007AFF' : '#86868B'} />
            {t.label}
          </button>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #F2F2F7' }}>
          <button onClick={onBackToHome}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: 'none', background: 'none', color: '#007AFF', fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
            <Icon name="ArrowLeft" size={12} color="#007AFF" /> Volver al inicio
          </button>
          {/* User avatar - click to edit profile */}
          <div onClick={() => setShowProfile(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px', marginTop: 4, borderTop: '1px solid #F2F2F7', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: user.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
              {user.avatar || '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            </div>
            <Icon name="Settings" size={12} color="#C7C7CC" />
          </div>
        </div>
      </aside>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 10 }}>
          <NotificationBell user={user} global />
        </div>
        {tab === 'dashboard' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#86868B', fontWeight: 600 }}>Filtrar:</span>
              <button onClick={() => setFilterProject([])}
                style={{ padding: '5px 12px', borderRadius: 8, border: filterProject.length === 0 ? 'none' : '1.5px solid #E5E5EA', background: filterProject.length === 0 ? '#1D1D1F' : '#FFF', color: filterProject.length === 0 ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Todos
              </button>
              {rooms.map(r => {
                const active = filterProject.includes(r.slug);
                return (
                  <button key={r.slug} onClick={() => setFilterProject(prev => active ? prev.filter(s => s !== r.slug) : [...prev, r.slug])}
                    style={{ padding: '5px 12px', borderRadius: 8, border: active ? 'none' : '1.5px solid #E5E5EA', background: active ? '#007AFF' : '#FFF', color: active ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {r.name}
                  </button>
                );
              })}
            </div>
            <AdminDashboard rooms={rooms} filterProject={filterProject} />
          </>
        )}

        {tab === 'cross_proyecto' && <CrossProject />}

        {tab === 'proyectos' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Proyectos</h2>
            {/* Create form */}
            <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={newName} onInput={e => { setNewName((e.target as HTMLInputElement).value); if (!newSlug) setNewSlug((e.target as HTMLInputElement).value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')); }}
                  placeholder="Nombre del proyecto"
                  style={{ flex: 2, minWidth: 160, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none' }} />
                <input value={newSlug} onInput={e => setNewSlug((e.target as HTMLInputElement).value)}
                  placeholder="slug" style={{ flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none' }} />
                <button onClick={handleCreateRoom} disabled={!newName.trim() || !newSlug.trim()}
                  style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!newName.trim() || !newSlug.trim()) ? 0.4 : 1 }}>
                  + Crear
                </button>
              </div>
            </div>
            {/* Room list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rooms.map(r => (
                <div key={r.slug} onClick={() => onGoToRoom(r.slug, r.tipo)}
                  style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = '#007AFF'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E5EA'; }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#86868B' }}>{r.tipo} · {r.slug}</div>
                  </div>
                  <Icon name="ChevronRight" size={16} color="#C7C7CC" />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'maestros' && <MaestrosPanel />}
        {tab === 'escalado_global' && <AdminEscaladoGlobal />}
        {tab === 'usuarios' && <AdminUsuarios />}
        {tab === 'roles' && <AdminRoles />}
        {tab === 'convenio' && <AdminConvenio />}
        {tab === 'calendarios' && <AdminCalendarios />}
      </div>

      {showProfile && userProfile && (
        <ProfileEditor user={user} profile={userProfile}
          onClose={() => setShowProfile(false)}
          onSave={updated => setUserProfile(updated)} />
      )}
    </div>
  );
}
