// ═══ RETRO BOARD — Main project view with collaborative retro ═══
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { AppUser, Task, Risk, Room, Member } from '../../types/index';
import { PHASES, MAIN_TABS, DEFAULT_TIMER } from '../../config/retro';
import { useRealtime } from '../../hooks/useRealtime';
import { finalizeRetro, savePhaseLocal, loadPhaseLocal, savePhaseTimes, loadPhaseTimes } from '../../services/retro';
import { loadTeamMembers } from '../../data/team';
import { loadTags, loadTagAssignments, loadRooms } from '../../data/rooms';
import { Icon } from '../common/Icon';
import { ConfirmModal } from '../common/ConfirmModal';
import { TaskBoard } from '../project/TaskBoard';
import { TaskDetailModal } from '../project/TaskDetailModal';
import { TagManager } from '../project/TagManager';
import { RiskManager } from '../project/RiskManager';
import { SkillMatrix } from '../project/SkillMatrix';
import { ProjectSummary } from '../project/ProjectSummary';
import { DeliveryPrediction } from '../project/DeliveryPrediction';
import { StatusReportView } from '../project/StatusReportView';
import { Gamification } from '../project/Gamification';
import { evaluateRetroTier } from '../../domain/gamification';
import { P1Review } from './P1Review';
import { P2Individual } from './P2Individual';
import { P3Discuss } from './P3Discuss';
import { P4Actions } from './P4Actions';
import { P5Risks } from './P5Risks';
import { P6Summary } from './P6Summary';
import { playCelebration } from './Celebration';
import { NotificationBell } from '../common/NotificationBell';
import { ProfileEditor } from '../common/ProfileEditor';
import { RetroHistory } from './RetroHistory';

interface Tag { id: string; name: string; color: string }
interface TagAssignment { tag_id: string; entity_type: string; entity_id: string; sala: string }

interface RetroBoardProps {
  user: AppUser;
  sala: string;
  tipo: string;
  salaDisplay: string;
  onLogout: () => void;
  onBackToHome: () => void;
  onSwitchProject?: (sala: string, tipo: string) => void;
}

export function RetroBoard({ user, sala, tipo, salaDisplay, onLogout, onBackToHome, onSwitchProject }: RetroBoardProps) {
  const [mainTab, setMainTab] = useState('resumen');
  const [phase, setPhase] = useState(() => loadPhaseLocal(sala));
  const [timer, setTimer] = useState(DEFAULT_TIMER);
  const [running, setRunning] = useState(false);
  const [showPhaseConfirm, setShowPhaseConfirm] = useState<number | null>(null);
  const [phaseTimes, setPhaseTimes] = useState(() => loadPhaseTimes(sala));
  const [teamMembers, setTeamMembers] = useState<Member[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagAssignments, setTagAssignments] = useState<TagAssignment[]>([]);
  const [finalizing, setFinalizing] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<Member | null>(null);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const phaseStartRef = useRef(Date.now());
  const startedAtRef = useRef<number | null>(null);

  // ── Realtime hook ──
  const { state, upd, online, cursors, moveCursor, reset, broadcastTimer, broadcastPhase, broadcastCelebration } = useRealtime({
    user, sala, tipo,
    onPhaseReceived: (p) => advanceToPhase(p),
    onTimerReceived: (secs, isRunning, startedAt) => {
      if (isRunning && startedAt) {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const current = Math.max(0, secs - elapsed);
        setTimer(current);
        setRunning(current > 0);
      } else {
        setTimer(secs);
        setRunning(isRunning);
      }
    },
    onCelebrationReceived: () => playCelebration(),
  });

  // Load team + tags + rooms
  useEffect(() => {
    loadTeamMembers().then(r => {
      if (r.ok) {
        const filtered = r.data.filter(m => (m.rooms || []).includes(sala));
        setTeamMembers(filtered.length > 0 ? filtered : r.data);
        const me = r.data.find(m => m.id === user.id || m.name === user.name);
        if (me) setUserProfile(me);
      }
    });
    loadTags(sala).then(t => setTags(t || []));
    loadTagAssignments(sala).then(a => setTagAssignments(a || []));
    loadRooms().then(r => { if (r.ok) setAllRooms(r.data); });
  }, [sala]);

  // Phase navigation
  const advanceToPhase = useCallback((target: number) => {
    const elapsed = Math.round((Date.now() - phaseStartRef.current) / 1000);
    setPhaseTimes(prev => {
      const next = { ...prev, [phase]: (prev[phase] || 0) + elapsed };
      savePhaseTimes(sala, next);
      return next;
    });
    phaseStartRef.current = Date.now();
    setPhase(target);
    savePhaseLocal(sala, target);
  }, [phase, sala]);

  // Timer countdown
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { setRunning(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [running]);

  // Re-broadcast timer every 10s while running
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      broadcastTimer(timer, true, startedAtRef.current);
    }, 10000);
    return () => clearInterval(iv);
  }, [running, broadcastTimer, timer]);

  // Timer sync helper
  const syncTimer = (secs: number, isRunning: boolean) => {
    if (isRunning) startedAtRef.current = Date.now();
    else startedAtRef.current = null;
    setTimer(secs);
    setRunning(isRunning);
    broadcastTimer(secs, isRunning, isRunning ? startedAtRef.current : null);
  };

  // Cursor tracking
  useEffect(() => {
    const handler = (e: MouseEvent) => moveCursor(e.clientX, e.clientY);
    document.addEventListener('mousemove', handler);
    return () => document.removeEventListener('mousemove', handler);
  }, [moveCursor]);

  // Finalize
  const handleFinalize = async () => {
    setFinalizing(true);
    await finalizeRetro(sala, tipo, {
      notes: state.notes, actions: state.actions as Task[], risks: state.risks as Risk[],
      objective: ((state.obj as Record<string, string> | undefined))?.text || '', tasks: state.tasks,
    }, user.id, phaseTimes);

    // Evaluate retro quality → tier
    const notes = Array.isArray(state.notes) ? state.notes : [];
    const actions = Array.isArray(state.actions) ? state.actions : [];
    const obj = state.obj as Record<string, unknown> | undefined;
    const { tier } = evaluateRetroTier({
      notes: notes.length,
      participants: Object.keys(online || {}).length + 1,
      totalMembers: teamMembers.length,
      actions: actions.length,
      votes: notes.reduce((s: number, n: Record<string, unknown>) => s + ((n.votes as number) || 0), 0),
      risksReviewed: Array.isArray(state.risks) && (state.risks as Array<Record<string, unknown>>).some(r => r.status === 'mitigated'),
      objectiveMet: obj?.met as boolean | null ?? null,
    });

    playCelebration(tier);
    broadcastCelebration();
    reset();
    setPhase(0); savePhaseLocal(sala, 0);
    setPhaseTimes({}); savePhaseTimes(sala, {});
    setFinalizing(false);
  };

  const formatTimer = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const onlineCount = Object.keys(online).length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F5F7' }}>
      {/* ══ SIDEBAR ══ */}
      <aside style={{ width: 200, background: '#FFF', borderRight: '1px solid #E5E5EA', padding: '16px 10px', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', boxShadow: '2px 0 8px rgba(0,0,0,.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '0 6px' }}>
          <h2 style={{ fontFamily: "'Comfortaa',sans-serif", fontSize: 16, fontWeight: 400, background: 'linear-gradient(90deg,#007AFF,#5856D6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>revelio</h2>
          <span onClick={() => { if (onSwitchProject) setShowProjectPicker(!showProjectPicker); }}
            style={{ fontSize: 10, background: '#007AFF10', color: '#007AFF', padding: '2px 8px', borderRadius: 6, fontWeight: 600, cursor: onSwitchProject ? 'pointer' : 'default' }}>
            {salaDisplay} {onSwitchProject ? '▾' : ''}
          </span>
        </div>

        {/* Project picker popover */}
        {showProjectPicker && allRooms.length > 0 && (
          <div style={{ position: 'absolute', top: 38, left: 10, zIndex: 999, background: '#FFF', borderRadius: 12, border: '1.5px solid #E5E5EA', boxShadow: '0 8px 30px rgba(0,0,0,.12)', padding: 6, minWidth: 180 }}>
            {allRooms.map(r => (
              <button key={r.slug} onClick={() => { onSwitchProject!(r.slug, r.tipo); setShowProjectPicker(false); }}
                style={{
                  display: 'block', width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12,
                  fontWeight: r.slug === sala ? 700 : 500, background: r.slug === sala ? '#007AFF10' : 'transparent', color: r.slug === sala ? '#007AFF' : '#1D1D1F',
                }}>
                {r.name} {r.slug === sala ? '✓' : ''}
              </button>
            ))}
          </div>
        )}

        {MAIN_TABS.map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
              border: 'none', background: mainTab === t.id ? '#F2F2F7' : 'transparent',
              color: mainTab === t.id ? '#007AFF' : '#6E6E73', fontSize: 12,
              fontWeight: mainTab === t.id ? 700 : 500, cursor: 'pointer', marginBottom: 1, width: '100%', textAlign: 'left',
            }}>
            <Icon name={t.lucide} size={14} color={mainTab === t.id ? '#007AFF' : '#86868B'} />
            {t.label}
          </button>
        ))}

        {/* Online users */}
        {onlineCount > 0 && (
          <div style={{ marginTop: 16, padding: '10px 8px', background: '#F9F9FB', borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 6 }}>EN LÍNEA ({onlineCount})</div>
            {Object.entries(online).map(([id, u]) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: '#34C759' }} />
                <span style={{ fontSize: 11, color: '#6E6E73' }}>{u.avatar} {u.name?.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom actions */}
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #F2F2F7', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={() => setShowTagManager(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: 'none', background: 'none', color: '#5856D6', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <Icon name="Tag" size={12} color="#5856D6" /> Etiquetas
          </button>
          <button onClick={onBackToHome} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: 'none', background: 'none', color: '#007AFF', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <Icon name="ArrowLeft" size={12} color="#007AFF" /> Inicio
          </button>
          <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: 'none', background: 'none', color: '#FF3B30', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <Icon name="LogOut" size={12} color="#FF3B30" /> Salir
          </button>
          {/* User avatar - click to edit profile */}
          <div onClick={() => setShowProfile(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px', marginTop: 8, borderTop: '1px solid #F2F2F7', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: user.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
              {user.avatar || '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 9, color: '#86868B' }}>{user.role || ''}</div>
            </div>
            <Icon name="Settings" size={12} color="#C7C7CC" />
          </div>
        </div>
      </aside>

      {/* ══ CONTENT ══ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', position: 'relative' }}>

        {/* Top bar: notification bell */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <NotificationBell user={user} actions={(state.actions as Task[]) || []} risks={(state.risks as Risk[]) || []} sala={sala} />
        </div>

        {/* Remote cursors */}
        {Object.entries(cursors).map(([id, c]) => (
          <div key={id} style={{
            position: 'fixed', left: c.x, top: c.y, pointerEvents: 'none', zIndex: 9999,
            transform: 'translate(-2px, -2px)', transition: 'left .1s, top .1s',
          }}>
            <svg width="20" height="24" viewBox="0 0 16 20"><path d="M0 0L16 12L6 14L4 20L0 0Z" fill={c.color || '#007AFF'} stroke="#FFF" strokeWidth="1" /></svg>
            <span style={{ fontSize: 11, background: c.color || '#007AFF', color: '#FFF', padding: '2px 8px', borderRadius: 6, marginLeft: 6, whiteSpace: 'nowrap', fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
              <span style={{ fontSize: 14, marginRight: 3 }}>{c.avatar}</span>{c.name?.split(' ')[0]}
            </span>
          </div>
        ))}

        {/* ── Resumen ── */}
        {mainTab === 'resumen' && (
          <ProjectSummary actions={(state.actions as Task[]) || []} risks={(state.risks as Risk[]) || []} teamMembers={teamMembers} user={user} sala={sala} phase={phase} onNavigate={setMainTab} />
        )}

        {/* ── Retro ── */}
        {mainTab === 'retro' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Phase navigator */}
            <div style={{ background: '#FFF', borderBottom: '1px solid #F2F2F7', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', borderRadius: '12px 12px 0 0' }}>
              {PHASES.map((p, i) => (
                <button key={p.id}
                  onClick={() => { if (i < phase) advanceToPhase(i); else if (i === phase + 1) setShowPhaseConfirm(i); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
                    border: phase === i ? 'none' : i < phase ? '1.5px solid #34C75940' : '1.5px solid #E5E5EA',
                    background: phase === i ? '#1D1D1F' : i < phase ? '#F0FFF4' : '#FFF',
                    color: phase === i ? '#FFF' : i < phase ? '#34C759' : i > phase + 1 ? '#C7C7CC' : '#6E6E73',
                    fontSize: 11, fontWeight: 600, cursor: i <= phase + 1 ? 'pointer' : 'not-allowed', opacity: i > phase + 1 ? 0.4 : 1,
                  }}>
                  {i < phase ? '✓' : p.num} {p.label}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                {[5, 10, 15].map(m => (
                  <button key={m} onClick={() => syncTimer(m * 60, false)}
                    style={{ padding: '2px 7px', borderRadius: 6, border: timer === m * 60 && !running ? '1.5px solid #007AFF' : '1px solid #E5E5EA', background: timer === m * 60 && !running ? '#007AFF10' : '#FFF', fontSize: 10, fontWeight: 600, color: timer === m * 60 && !running ? '#007AFF' : '#86868B', cursor: 'pointer' }}>
                    {m}'
                  </button>
                ))}
                <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: timer < 60 ? '#FF3B30' : '#1D1D1F', marginLeft: 4 }}>{formatTimer(timer)}</span>
                <button onClick={() => syncTimer(running ? timer : timer, !running)}
                  style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: running ? '#FF3B3015' : '#34C75915', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={running ? 'Pause' : 'Play'} size={14} color={running ? '#FF3B30' : '#34C759'} />
                </button>
                <button onClick={() => syncTimer(DEFAULT_TIMER, false)}
                  style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#F2F2F7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="RotateCcw" size={12} color="#86868B" />
                </button>
                <button onClick={() => setShowResetConfirm(true)} title="Reiniciar retrospectiva"
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #FF950030', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="Trash2" size={12} color="#FF9500" />
                </button>
                <button onClick={() => setShowHistory(true)} title="Historial de retros"
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid #007AFF30', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="Archive" size={12} color="#007AFF" />
                </button>
              </div>
            </div>

            {/* Phase content */}
            <div style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
              {/* Facilitation guide */}
              <div style={{ padding: '10px 14px', background: '#EBF5FF', borderRadius: 10, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="Lightbulb" size={16} color="#007AFF" />
                <span style={{ fontSize: 12, color: '#007AFF', lineHeight: 1.4 }}>{PHASES[phase]?.guide}</span>
              </div>

              {phase === 0 && <P1Review tasks={state.tasks} onUpdateTasks={t => upd('tasks', t)} objective={((state.obj as Record<string, string> | undefined))?.text || ''} onUpdateObjective={t => upd('obj', { ...(state.obj as Record<string, string> || {}), text: t })} user={user} />}
              {phase === 1 && <P2Individual notes={state.notes} onUpdateNotes={n => upd('notes', n)} user={user} />}
              {phase === 2 && <P3Discuss notes={state.notes} onUpdateNotes={n => upd('notes', n)} user={user} />}
              {phase === 3 && <P4Actions notes={state.notes} actions={state.actions as Task[]} onUpdateActions={a => upd('actions', a)} user={user} />}
              {phase === 4 && <P5Risks risks={state.risks as Risk[]} onUpdateRisks={r => upd('risks', r)} notes={state.notes} user={user} />}
              {phase === 5 && <P6Summary notes={state.notes} actions={state.actions as Task[]} risks={state.risks as Risk[]} phaseTimes={phaseTimes} objective={((state.obj as Record<string, string> | undefined))?.text || ''} user={user} onFinalize={handleFinalize} finalizing={finalizing} />}
            </div>
          </div>
        )}

        {/* ── Tasks ── */}
        {mainTab === 'trabajo' && (
          <TaskBoard actions={state.actions as Task[]} risks={state.risks as Risk[]} user={user} sala={sala} teamMembers={teamMembers} tags={tags} tagAssignments={tagAssignments} onUpdateActions={a => upd('actions', a)} onUpdateTagAssignments={setTagAssignments} onOpenTaskDetail={t => setDetailTask(t)} />
        )}

        {/* ── Risks ── */}
        {mainTab === 'riesgos' && (
          <RiskManager risks={state.risks as Risk[]} actions={state.actions as Task[]} user={user} teamMembers={teamMembers} tags={tags} tagAssignments={tagAssignments} onUpdateRisks={r => upd('risks', r)} onUpdateActions={a => upd('actions', a)} />
        )}

        {/* ── Prediction ── */}
        {mainTab === 'prediccion' && (
          <DeliveryPrediction actions={(state.actions as Task[]) || []} />
        )}

        {/* ── Metrics ── */}
        {mainTab === 'metricas' && (
          <StatusReportView actions={(state.actions as Task[]) || []} risks={(state.risks as Risk[]) || []} teamMembers={teamMembers} />
        )}

        {/* ── Gamification ── */}
        {mainTab === 'hechizos' && (
          <Gamification actions={(state.actions as Task[]) || []} risks={(state.risks as Risk[]) || []} teamMembers={teamMembers} retroMetrics={[]} currentUser={user.name} />
        )}

        {/* ── Team ── */}
        {mainTab === 'equipo' && <SkillMatrix user={user} sala={sala} />}
      </div>

      {/* ══ MODALS ══ */}

      {showHistory && <RetroHistory sala={sala} onClose={() => setShowHistory(false)} />}

      {showProfile && userProfile && (
        <ProfileEditor user={user} profile={userProfile}
          onClose={() => setShowProfile(false)}
          onSave={updated => { setUserProfile(updated); setTeamMembers(prev => prev.map(m => m.id === updated.id ? updated : m)); }} />
      )}

      {showResetConfirm && (
        <ConfirmModal icon="🔄" title="Reiniciar retrospectiva"
          message="Se borrarán todas las notas, acciones y riesgos de la retro actual. Las tareas existentes no se pierden."
          confirmLabel="Reiniciar" confirmColor="#FF9500"
          onConfirm={() => { reset(); setPhase(0); savePhaseLocal(sala, 0); setPhaseTimes({}); savePhaseTimes(sala, {}); setShowResetConfirm(false); }}
          onCancel={() => setShowResetConfirm(false)} />
      )}

      {showTagManager && (
        <TagManager sala={sala} teamMembers={teamMembers} risks={(state.risks as Risk[]) || []} actions={(state.actions as Task[]) || []}
          onClose={() => { setShowTagManager(false); loadTags(sala).then(t => setTags(t || [])); loadTagAssignments(sala).then(a => setTagAssignments(a || [])); }} />
      )}

      {detailTask && (() => {
        const epicNames = [...new Set((state.actions as Task[]).map(a => (a as Record<string, unknown>).epicLink as string).filter(Boolean))];
        return (
        <TaskDetailModal task={detailTask} teamMembers={teamMembers} epics={epicNames} tags={tags} tagAssignments={tagAssignments} risks={(state.risks as Risk[]) || []}
          onSave={updated => { upd('actions', (state.actions as Task[]).map(a => a.id === updated.id ? updated : a)); setDetailTask(null); }}
          onClose={() => setDetailTask(null)}
          onDelete={id => { upd('actions', (state.actions as Task[]).filter(a => a.id !== id)); setDetailTask(null); }}
          onToggleTag={async (tagId, taskId) => {
            const { toggleTagAssignment: toggle } = await import('../../data/tags');
            const added = await toggle(tagId, 'action', taskId, sala);
            if (added) setTagAssignments(prev => [...prev, { tag_id: tagId, entity_type: 'action', entity_id: taskId, sala }]);
            else setTagAssignments(prev => prev.filter(a => !(a.tag_id === tagId && a.entity_type === 'action' && a.entity_id === taskId)));
          }} />
        );
      })()}

      {showPhaseConfirm !== null && (
        <ConfirmModal icon="⏭️" title={`Avanzar a ${PHASES[showPhaseConfirm].label}`}
          message="¿Avanzar a la siguiente fase? Podrás volver atrás si necesitas."
          confirmLabel="Avanzar" confirmColor="#007AFF"
          onConfirm={() => { advanceToPhase(showPhaseConfirm); broadcastPhase(showPhaseConfirm); setShowPhaseConfirm(null); }}
          onCancel={() => setShowPhaseConfirm(null)} />
      )}
    </div>
  );
}
