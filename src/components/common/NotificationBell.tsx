// ═══ NOTIFICATION BELL — In-app notifications for overdue tasks + escalated risks ═══
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { Task, Risk, AppUser } from '../../types/index';
import { Icon } from '../common/Icon';

interface Notification {
  id: string;
  key: string;
  msg: string;
  type: 'overdue' | 'escalado' | 'info';
  ts: number;
  read: boolean;
}

interface NotificationBellProps {
  user: AppUser;
  actions?: Task[];
  risks?: Risk[];
  sala?: string;
  global?: boolean; // if true, loads data from all rooms
}

export function NotificationBell({ user, actions, risks, sala, global: isGlobal }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const seenRef = useRef(new Set<string>());
  const [loadedActions, setLoadedActions] = useState<Task[]>([]);
  const [loadedRisks, setLoadedRisks] = useState<Risk[]>([]);

  // Self-load for global mode
  useEffect(() => {
    if (!isGlobal) return;
    import('../../data/retros').then(({ loadRetros }) => {
      loadRetros().then(r => {
        if (!r.ok) return;
        const allActions: Task[] = [];
        const allRisks: Risk[] = [];
        // Get latest retro per room
        const latest: Record<string, Record<string, unknown>> = {};
        r.data.forEach((s: Record<string, unknown>) => {
          const sl = s.sala as string;
          if (!latest[sl] || (s.created_at as string) > (latest[sl].created_at as string)) latest[sl] = s;
        });
        Object.values(latest).forEach(snap => {
          const data = snap.data as Record<string, unknown> || {};
          if (Array.isArray(data.actions)) allActions.push(...data.actions as Task[]);
          if (Array.isArray(data.risks)) allRisks.push(...data.risks as Risk[]);
        });
        setLoadedActions(allActions);
        setLoadedRisks(allRisks);
      });
    });
  }, [isGlobal]);

  const effectiveActions = isGlobal ? loadedActions : (actions || []);
  const effectiveRisks = isGlobal ? loadedRisks : (risks || []);
  const panelRef = useRef<HTMLDivElement>(null);

  const addNotif = useCallback((key: string, msg: string, type: Notification['type'] = 'info') => {
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    setNotifications(prev => [{ id: Date.now().toString(36), key, msg, type, ts: Date.now(), read: false }, ...prev.slice(0, 29)]);
  }, []);

  // Generate notifications from state
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    // Overdue tasks assigned to user
    (effectiveActions || [])
      .filter(a => (a.owner === user.name || a.createdBy === user.id) && a.status !== 'done' && a.status !== 'discarded' && a.date && a.date < today)
      .forEach(a => addNotif('adl-' + a.id, 'Tarea vencida: ' + a.text.slice(0, 50), 'overdue'));

    // Escalated risks
    (effectiveRisks || [])
      .filter(r => r.escalation?.level && r.escalation.level !== 'equipo' && (r.escalation?.memberName === user.name || r.owner === user.name))
      .forEach(r => addNotif('esc-' + r.id, 'Escalado: ' + (r.title || r.text || '').slice(0, 50), 'escalado'));

    // Risks with deadline passed
    (effectiveRisks || [])
      .filter(r => r.owner === user.name && r.status !== 'mitigated' && r.deadline && r.deadline < today)
      .forEach(r => addNotif('rdl-' + r.id, 'Riesgo vencido: ' + (r.title || r.text || '').slice(0, 50), 'overdue'));
  }, [effectiveActions, effectiveRisks, user, addNotif]);

  // Close on outside click
  useEffect(() => {
    if (!showPanel) return;
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setShowPanel(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showPanel]);

  const unread = notifications.filter(n => !n.read).length;
  const clearAll = () => { setNotifications([]); seenRef.current.clear(); setShowPanel(false); };

  const typeIcon = (type: string) => type === 'overdue' ? 'Clock' : type === 'escalado' ? 'TrendingUp' : 'Info';
  const typeColor = (type: string) => type === 'overdue' ? '#FF3B30' : type === 'escalado' ? '#FF9500' : '#007AFF';

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button onClick={e => { e.stopPropagation(); setShowPanel(v => !v); }}
        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
        <Icon name="Bell" size={15} color="#6E6E73" />
        {unread > 0 && (
          <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, background: '#FF3B30', color: '#FFF', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread}
          </div>
        )}
      </button>

      {showPanel && (
        <div style={{ position: 'absolute', right: 0, top: 38, width: 300, background: '#FFF', borderRadius: 16, border: '1.5px solid #E5E5EA', boxShadow: '0 8px 32px rgba(0,0,0,.12)', zIndex: 9999 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F2F2F7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Notificaciones</span>
            <button onClick={clearAll} style={{ border: 'none', background: 'none', fontSize: 11, color: '#86868B', cursor: 'pointer' }}>Limpiar</button>
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#86868B', fontSize: 12 }}>
              <Icon name="CheckCircle2" size={24} color="#34C759" />
              <p style={{ marginTop: 8 }}>Todo tranquilo — sin novedades</p>
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {notifications.map(n => (
                <div key={n.id} style={{ padding: '10px 16px', borderBottom: '1px solid #F9F9FB', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Icon name={typeIcon(n.type)} size={13} color={typeColor(n.type)} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, lineHeight: 1.4, color: '#1D1D1F', margin: 0 }}>{n.msg}</p>
                    <span style={{ fontSize: 9, color: '#C7C7CC' }}>{new Date(n.ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
