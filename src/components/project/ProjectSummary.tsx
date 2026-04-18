// ═══ PROJECT SUMMARY — Enriched project dashboard (matches monolith) ═══
import type { Task, Risk, Member, AppUser, Vacation } from '../../types/index';
import { calculateCriticality } from '../../domain/criticality';
import { PHASES } from '../../config/retro';
import { Icon } from '../common/Icon';

interface ProjectSummaryProps {
  actions: Task[];
  risks: Risk[];
  teamMembers: Member[];
  user: AppUser;
  sala: string;
  phase: number;
  onNavigate: (tab: string) => void;
}

const fd = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '';

export function ProjectSummary({ actions, risks, teamMembers, user, sala, phase, onNavigate }: ProjectSummaryProps) {
  const today = new Date().toISOString().slice(0, 10);

  // Task metrics
  const acts = (actions || []).filter(a => a.status !== 'discarded' && a.status !== 'cancelled');
  const actOpen = acts.filter(a => a.status !== 'done');
  const actDone = acts.filter(a => a.status === 'done').length;
  const actOver = actOpen.filter(a => a.date && a.date < today).length;
  const actInProgress = actOpen.filter(a => a.status === 'doing' || a.status === 'in_progress' || a.status === 'inprogress').length;
  const actBacklog = actOpen.filter(a => a.status === 'backlog' || a.status === 'todo' || a.status === 'pending').length;
  const actPct = acts.length > 0 ? Math.round(actDone / acts.length * 100) : 0;

  // Risk metrics
  const allRisks = risks || [];
  const rOpen = allRisks.filter(r => r.status !== 'mitigated');
  const rMit = allRisks.filter(r => r.status === 'mitigated').length;
  const rEsc = rOpen.filter(r => r.escalation?.level && r.escalation.level !== 'equipo').length;
  const rR = rOpen.filter(r => (r.type || 'riesgo') === 'riesgo').length;
  const rP = rOpen.filter(r => (r.type || 'riesgo') === 'problema').length;
  const rO = rOpen.filter(r => (r.type || 'riesgo') === 'oportunidad').length;
  const rCrit = rOpen.filter(r => calculateCriticality(r.prob || 'media', r.impact || 'medio') === 'critical').length;

  // Team
  const onVac = teamMembers.filter(m =>
    (Array.isArray(m.vacations) ? m.vacations : []).some((v: Vacation) => v.from <= today && (!v.to || v.to >= today)),
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Resumen del proyecto</h2>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Accionables', v: acts.length, c: '#007AFF', i: 'CheckSquare' },
          { l: 'Completadas', v: `${actPct}%`, c: actPct >= 75 ? '#34C759' : actPct >= 40 ? '#FF9500' : '#FF3B30', i: 'CheckCircle2' },
          { l: 'Vencidas', v: actOver, c: actOver > 0 ? '#FF3B30' : '#34C759', i: 'Clock' },
          { l: 'Riesgos', v: rOpen.length, c: rOpen.length > 0 ? '#FF9500' : '#34C759', i: 'AlertTriangle' },
          { l: 'Escalados', v: rEsc, c: rEsc > 0 ? '#FF3B30' : '#34C759', i: 'TrendingUp' },
        ].map(k => (
          <div key={k.l} class="card-hover" style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 14, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: k.c + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
              <Icon name={k.i} size={14} color={k.c} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.c, lineHeight: 1 }}>{k.v}</div>
            <div style={{ fontSize: 10, color: '#86868B', marginTop: 3 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* 2-column: risks + progress */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {/* Risks breakdown */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Riesgos y problemas</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {([
              [rR, 'Riesgos', '#FF9500'],
              [rP, 'Problemas', '#FF3B30'],
              [rO, 'Oportunidades', '#34C759'],
              [rMit, 'Mitigados', '#007AFF'],
            ] as const).map(([v, l, c]) => (
              <div key={l} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 10, background: c + '08' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: c }}>{v}</div>
                <div style={{ fontSize: 9, color: '#86868B' }}>{l}</div>
              </div>
            ))}
          </div>
          {rCrit > 0 && <div style={{ fontSize: 11, color: '#FF3B30', fontWeight: 600, padding: '4px 0' }}><Icon name="AlertTriangle" size={11} color="#FF3B30" /> {rCrit} en sector crítico</div>}
          {rEsc > 0 && <div style={{ fontSize: 11, color: '#FF9500', fontWeight: 600, padding: '4px 0' }}><Icon name="TrendingUp" size={11} color="#FF9500" /> {rEsc} escalado{rEsc > 1 ? 's' : ''}</div>}
          {rOpen.length === 0 && <div style={{ fontSize: 11, color: '#34C759', fontWeight: 600 }}><Icon name="CheckCircle2" size={11} color="#34C759" /> Sin riesgos activos</div>}
        </div>

        {/* Task progress donut */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Progreso de tareas</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
              <svg viewBox="0 0 36 36" style={{ width: 56, height: 56, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15" fill="none" stroke="#F2F2F7" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none"
                  stroke={actPct >= 75 ? '#34C759' : actPct >= 40 ? '#FF9500' : '#FF3B30'}
                  strokeWidth="3" strokeDasharray={`${actPct * 0.94} 94`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: actPct >= 75 ? '#34C759' : actPct >= 40 ? '#FF9500' : '#FF3B30' }}>
                {actPct}%
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {([
                ['Completadas', actDone, '#34C759'],
                ['En curso', actInProgress, '#007AFF'],
                ['Backlog', actBacklog, '#6E6E73'],
                ['Vencidas', actOver, '#FF3B30'],
              ] as const).map(([l, v, c]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11 }}>
                  <span style={{ color: '#86868B' }}>{l}</span>
                  <span style={{ fontWeight: 700, color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick nav cards + team */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { tab: 'trabajo', icon: 'ClipboardList', label: 'Seguimiento', desc: `${actOpen.length} tareas abiertas`, c: '#007AFF' },
            { tab: 'retro', icon: 'RotateCcw', label: 'Retro', desc: `Fase: ${PHASES[phase]?.label || 'Repaso'}`, c: '#34C759' },
            { tab: 'riesgos', icon: 'AlertTriangle', label: 'Riesgos', desc: `${rOpen.length} activos`, c: '#FF9500' },
            { tab: 'equipo', icon: 'Users', label: 'Equipo', desc: `${teamMembers.length} personas`, c: '#5856D6' },
          ].map(card => (
            <button key={card.tab} onClick={() => onNavigate(card.tab)}
              class="card-hover"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: '#FFF',
                borderRadius: 14, border: '1.5px solid #E5E5EA', cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 1px 4px rgba(0,0,0,.04)',
              }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = card.c; }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E5EA'; }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: card.c + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={card.icon} size={18} color={card.c} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{card.label}</div>
                <div style={{ fontSize: 10, color: '#86868B', marginTop: 1 }}>{card.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Team panel */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Equipo</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {teamMembers.slice(0, 8).map(m => (
              <div key={m.id} title={`${m.name}${m.role_label ? ` · ${m.role_label}` : ''}`}
                style={{
                  width: 30, height: 30, borderRadius: 8, background: m.color || '#E5E5EA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  border: `2px solid ${onVac.some(v => v.id === m.id) ? '#FF9500' : '#FFF'}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,.08)',
                }}>
                {m.avatar || '👤'}
              </div>
            ))}
            {teamMembers.length > 8 && <span style={{ fontSize: 10, color: '#86868B', alignSelf: 'center' }}>+{teamMembers.length - 8}</span>}
          </div>
          {onVac.length > 0 && <div style={{ fontSize: 10, color: '#FF9500', fontWeight: 600 }}>De vacaciones: {onVac.map(m => m.name.split(' ')[0]).join(', ')}</div>}
          {onVac.length === 0 && <div style={{ fontSize: 10, color: '#34C759' }}>Equipo completo disponible</div>}
        </div>
      </div>

      {/* Overdue tasks */}
      {actOver > 0 && (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #FF3B3015', padding: '14px 16px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#FF3B30' }}>Accionables vencidos</h3>
          {actOpen.filter(a => a.date && a.date < today).slice(0, 5).map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F2F2F7', fontSize: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: '#FF3B30', flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 600 }}>{a.text}</span>
              <span style={{ fontSize: 10, color: '#FF3B30' }}>{fd(a.date)}</span>
              <span style={{ fontSize: 10, color: '#86868B' }}>{a.owner || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
