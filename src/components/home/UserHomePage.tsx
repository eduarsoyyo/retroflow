// ═══ USER HOME PAGE — Personal dashboard + navigation ═══
import { useState, useEffect } from 'preact/hooks';
import type { AppUser, Room, Member, Task, Risk } from '@app-types/index';
import { loadTeamMembers } from '@data/team';
import { loadRooms } from '@data/rooms';
import { loadRetros } from '@data/retros';
import { Icon } from '@components/common/Icon';
import { Loading } from '@components/common/Feedback';
import { ProfileEditor } from '@components/common/ProfileEditor';
import { NotificationBell } from '@components/common/NotificationBell';
import { CalendarProfile } from '@components/common/CalendarProfile';

interface UserHomePageProps {
  user: AppUser;
  onLogout: () => void;
  onSelectProject: (slug: string, tipo: string) => void;
  onOpenAdmin: () => void;
}

const fd = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';

export function UserHomePage({ user, onLogout, onSelectProject, onOpenAdmin }: UserHomePageProps) {
  const [section, setSection] = useState('dashboard');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [profile, setProfile] = useState<Member | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [allData, setAllData] = useState<Record<string, { actions?: Task[]; risks?: Risk[] }>>({});
  const [loading, setLoading] = useState(true);

  const isSM = user?.isSuperuser || (user as any)?._isAdmin;
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      loadRooms(),
      loadTeamMembers(),
      loadRetros(),
    ]).then(([roomsR, membersR, retrosR]) => {
      const rms = roomsR.ok ? roomsR.data : [];
      setRooms(rms);

      const members = membersR.ok ? membersR.data : [];
      const uq = (user.username || user.name || '').toLowerCase().trim();
      const me = members.find(m =>
        (m.username && m.username.toLowerCase().trim() === uq) ||
        (m.name && m.name.toLowerCase().trim() === uq),
      );
      setProfile(me || null);

      // Build allData from retros
      const snaps = retrosR.ok ? retrosR.data : [];
      const bySala: Record<string, { sala: string; created_at: string; data?: Record<string, unknown> }> = {};
      snaps.forEach(s => { const snap = s as { sala: string; created_at: string; data?: Record<string, unknown> }; if (!bySala[snap.sala] || snap.created_at > bySala[snap.sala].created_at) bySala[snap.sala] = snap; });
      const data: typeof allData = {};
      Object.entries(bySala).forEach(([sala, snap]) => { if (snap.data) data[sala] = snap.data as Record<string, { actions?: Task[]; risks?: Risk[] }>; });
      setAllData(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <Loading />;

  // My data
  const myRooms = rooms.filter(r => {
    if (!profile) return true;
    return (profile.rooms || []).includes(r.slug);
  });

  const myActions = Object.entries(allData).flatMap(([slug, d]) =>
    (d.actions || [])
      .filter(a => a.owner === user.name || a.createdBy === user.id)
      .map(a => ({ ...a, _room: rooms.find(r => r.slug === slug)?.name || slug })),
  );
  const pendingAct = myActions.filter(a => a.status !== 'done' && a.status !== 'discarded' && a.status !== 'cancelled');
  const overdueAct = pendingAct.filter(a => a.date && a.date < today);
  const myRisks = Object.values(allData).flatMap(d => (d.risks || []).filter(r => r.status !== 'mitigated'));
  const hasUrgent = overdueAct.length > 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F5F7' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#FFF', borderRight: '1px solid #E5E5EA', padding: '20px 14px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <h1 style={{ fontFamily: "'Comfortaa',sans-serif", fontSize: 22, fontWeight: 400, letterSpacing: 2, background: 'linear-gradient(90deg,#007AFF,#5856D6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 24 }}>revelio</h1>

        {[
          { id: 'dashboard', icon: 'Home', label: 'Inicio' },
          { id: 'proyectos', icon: 'FolderOpen', label: 'Proyectos' },
          { id: 'perfil', icon: 'User', label: 'Mi perfil' },
        ].map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
              border: 'none', background: section === s.id ? '#F2F2F7' : 'transparent',
              color: section === s.id ? '#007AFF' : '#6E6E73', fontSize: 13, fontWeight: section === s.id ? 700 : 500,
              cursor: 'pointer', marginBottom: 2, width: '100%', textAlign: 'left',
            }}>
            <Icon name={s.icon} size={16} color={section === s.id ? '#007AFF' : '#86868B'} />
            {s.label}
          </button>
        ))}

        {isSM && (
          <button onClick={onOpenAdmin}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
              border: 'none', background: 'transparent', color: '#5856D6', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', marginTop: 8, width: '100%', textAlign: 'left',
            }}>
            <Icon name="Settings" size={16} color="#5856D6" />
            Centro de Control
          </button>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #F2F2F7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: user.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{user.avatar || '👤'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{user.name}</div>
              <div style={{ fontSize: 10, color: '#86868B' }}>{user.role || 'Usuario'}</div>
            </div>
          </div>
          <button onClick={onLogout}
            style={{ fontSize: 11, color: '#FF3B30', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', position: 'relative' }}>
        {/* Header bell */}
        <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 10 }}>
          <NotificationBell user={user} global />
        </div>
        {section === 'dashboard' && (
          <div style={{ maxWidth: 720 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 2, color: '#1D1D1F' }}>
              {new Date().getHours() < 12 ? 'Buenos días' : 'Buenas tardes'}, {user.name.split(' ')[0]}
            </h1>
            <p style={{ fontSize: 13, color: '#86868B', marginBottom: 20 }}>
              {fd(new Date().toISOString())} · {myRooms.length} proyecto{myRooms.length !== 1 ? 's' : ''}
            </p>

            {/* Urgent */}
            {hasUrgent && (
              <div style={{ background: '#FFF', borderRadius: 18, border: '1.5px solid #FF3B3015', padding: '18px 20px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: '#FF3B30' }} />
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#FF3B30', margin: 0 }}>Requiere tu atención</h2>
                  <span style={{ fontSize: 11, color: '#86868B', marginLeft: 'auto' }}>{overdueAct.length}</span>
                </div>
                {overdueAct.slice(0, 5).map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: '#FFF5F5', borderLeft: '3px solid #FF3B30', marginBottom: 4 }}>
                    <Icon name="AlertCircle" size={14} color="#FF3B30" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{a.text}</div>
                      <div style={{ fontSize: 10, color: '#86868B', marginTop: 1 }}>{(a as any)._room} · Venció {fd(a.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick stats */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {[
                { v: myRooms.length, l: 'Proyectos', c: '#007AFF', i: 'FolderOpen' },
                { v: pendingAct.length, l: 'Pendientes', c: '#6E6E73', i: 'ClipboardList' },
                { v: myRisks.length, l: 'Riesgos', c: myRisks.length > 0 ? '#FF9500' : '#6E6E73', i: 'AlertTriangle' },
              ].map(k => (
                <div key={k.l} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' }}>
                  <Icon name={k.i} size={16} color={k.c} />
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 800, color: k.c }}>{k.v}</span>
                    <span style={{ fontSize: 11, color: '#86868B', marginLeft: 5 }}>{k.l}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Projects grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {myRooms.map(r => (
                <div key={r.slug} onClick={() => onSelectProject(r.slug, r.tipo)}
                  style={{ background: '#FFF', borderRadius: 16, border: '1.5px solid #E5E5EA', padding: 16, cursor: 'pointer', transition: 'all .15s' }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = '#007AFF'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E5EA'; }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: '#86868B' }}>{r.tipo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'proyectos' && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Mis proyectos</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {myRooms.map(r => (
                <div key={r.slug} onClick={() => onSelectProject(r.slug, r.tipo)}
                  style={{ background: '#FFF', borderRadius: 16, border: '1.5px solid #E5E5EA', padding: 20, cursor: 'pointer' }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = '#007AFF'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E5EA'; }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: '#86868B', marginBottom: 8 }}>{r.tipo}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Icon name="ChevronRight" size={14} color="#C7C7CC" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'perfil' && profile && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Mi perfil</h1>
            <div style={{ background: '#FFF', borderRadius: 16, border: '1.5px solid #E5E5EA', padding: 24, maxWidth: 480 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: profile.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{profile.avatar || '👤'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{profile.name}</div>
                  <div style={{ fontSize: 13, color: '#86868B' }}>{profile.role_label || '—'} {profile.company ? `· ${profile.company}` : ''}</div>
                </div>
                <button onClick={() => setShowProfileEditor(true)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #E5E5EA', background: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#007AFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="Settings" size={13} color="#007AFF" /> Editar
                </button>
              </div>
              {profile.email && <p style={{ fontSize: 13, color: '#6E6E73', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="Mail" size={13} color="#86868B" /> {profile.email}</p>}
              {profile.phone && <p style={{ fontSize: 13, color: '#6E6E73', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="Phone" size={13} color="#86868B" /> {profile.phone}</p>}
            </div>
            {/* Calendario asignado */}
            <div style={{ marginTop: 14 }}>
              <CalendarProfile calendarioId={(profile as Record<string, unknown>).calendario_id as string} />
            </div>
            {showProfileEditor && (
              <ProfileEditor user={user} profile={profile}
                onClose={() => setShowProfileEditor(false)}
                onSave={updated => { setProfile(updated); }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
