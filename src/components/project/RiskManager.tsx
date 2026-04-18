// ═══ RISK MANAGER — Main risk management view (replaces PRiesgos) ═══
// Composes: RiskCard, RiskDetailModal, EscaladoPanel, Heatmap
// All already migrated — this component just wires them together.

import { useState, useEffect } from 'preact/hooks';
import type { Risk, Task, Member, AppUser } from '@app-types/index';
import { calculateCriticality, CRIT_LABELS } from '@domain/criticality';
import { riskTitle, RISK_TYPES } from '@domain/risks';
import { RiskCard } from '@components/risks/RiskCard';
import { RiskDetailModal } from '@components/risks/RiskDetailModal';
import { EscaladoPanel } from '@components/risks/EscaladoPanel';
import { Heatmap } from '@components/risks/Heatmap';
import { Icon } from '@components/common/Icon';

// ── Types ──

interface Tag { id: string; name: string; color: string }

interface RiskManagerProps {
  risks: Risk[];
  actions: Task[];
  user: AppUser;
  teamMembers: Member[];
  tags?: Tag[];
  tagAssignments?: Array<{ tag_id: string; entity_type: string; entity_id: string }>;
  retroHistory?: unknown[];
  onUpdateRisks: (risks: Risk[]) => void;
  onUpdateActions: (actions: Task[]) => void;
}

// ── Helpers ──

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function getAlerts(risk: Risk): Array<{ type: string; label: string; color: string }> {
  const alerts: Array<{ type: string; label: string; color: string }> = [];
  if (!risk.escalation?.escalatedAt) return alerts;
  const days = Math.floor((Date.now() - new Date(risk.escalation.escalatedAt).getTime()) / 86400000);
  const sector = calculateCriticality(risk.prob || 'media', risk.impact || 'medio');
  const threshold = sector === 'critical' ? 2 : sector === 'moderate' ? 5 : 10;
  if (days >= threshold) {
    alerts.push({ type: 'stale', label: `${days}d sin actualizar`, color: '#FF9500' });
  }
  return alerts;
}

// ── Component ──

export function RiskManager({
  risks, actions, user, teamMembers, tags = [], tagAssignments = [],
  onUpdateRisks, onUpdateActions,
}: RiskManagerProps) {
  const [subTab, setSubTab] = useState<'resumen' | 'heatmap' | 'escalado'>('resumen');
  const [detailRisk, setDetailRisk] = useState<Risk | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('open');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  const allRisks = risks || [];

  // ── Filtered risks ──
  const filtered = allRisks
    .filter(r => filterStatus === 'all' || (filterStatus === 'open' ? r.status !== 'mitigated' : r.status === 'mitigated'))
    .filter(r => filterType === 'all' || (r.type || 'riesgo') === filterType)
    .filter(r => !activeTagFilter || tagAssignments.some(a => a.tag_id === activeTagFilter && a.entity_type === 'risk' && a.entity_id === r.id));

  // ── Metrics ──
  const openRisks = allRisks.filter(r => r.status !== 'mitigated');
  const mitigated = allRisks.filter(r => r.status === 'mitigated').length;
  const escalated = openRisks.filter(r => r.escalation?.level && r.escalation.level !== 'equipo').length;
  const critical = openRisks.filter(r => calculateCriticality(r.prob || 'media', r.impact || 'medio') === 'critical').length;
  const riesgos = openRisks.filter(r => (r.type || 'riesgo') === 'riesgo').length;
  const problemas = openRisks.filter(r => (r.type || 'riesgo') === 'problema').length;
  const oportunidades = openRisks.filter(r => (r.type || 'riesgo') === 'oportunidad').length;

  // ── CRUD ──
  const updateRisk = (id: string, patch: Partial<Risk>) => {
    onUpdateRisks(allRisks.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const deleteRisk = (id: string) => {
    onUpdateRisks(allRisks.filter(r => r.id !== id));
  };

  const addRisk = (type: string) => {
    const newRisk: Risk = {
      id: uid(),
      title: '',
      text: '',
      description: '',
      type: type as Risk['type'],
      impact: 'medio',
      prob: 'media',
      mitigation: '',
      owner: '',
      status: 'open',
      escalation: null,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    setDetailRisk(newRisk);
  };

  const saveFromDetail = (risk: Risk) => {
    const exists = allRisks.some(r => r.id === risk.id);
    if (exists) {
      onUpdateRisks(allRisks.map(r => r.id === risk.id ? risk : r));
    } else {
      onUpdateRisks([...allRisks, risk]);
    }
  };

  const linkedTasks = (riskId: string) => actions.filter(a => a.riskId === riskId);

  const TABS = [
    { id: 'resumen',  label: 'Resumen',  icon: 'LayoutList' },
    { id: 'heatmap',  label: 'Heatmap',  icon: 'Grid3X3' },
    { id: 'escalado', label: 'Escalado', icon: 'TrendingUp' },
  ] as const;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { v: openRisks.length, l: 'Abiertos', c: '#FF9500', tip: 'Riesgos, problemas y oportunidades activos' },
          { v: riesgos, l: 'Riesgos', c: '#FF9500', tip: 'Eventos inciertos que pueden afectar al proyecto' },
          { v: problemas, l: 'Problemas', c: '#FF3B30', tip: 'Riesgos materializados que requieren acción inmediata' },
          { v: oportunidades, l: 'Oportunidades', c: '#34C759', tip: 'Eventos positivos que podrían beneficiar al proyecto' },
          { v: mitigated, l: 'Mitigados', c: '#34C759', tip: 'Riesgos cerrados o cuya mitigación fue efectiva' },
          { v: escalated, l: 'Escalados', c: escalated > 0 ? '#FF3B30' : '#6E6E73', tip: 'Riesgos escalados a JP, SM o Dirección Técnica' },
          { v: critical, l: 'Críticos', c: critical > 0 ? '#FF3B30' : '#6E6E73', tip: 'Prob. alta + Impacto alto → requieren atención urgente' },
        ].map(k => (
          <div key={k.l} title={k.tip} style={{ padding: '8px 12px', background: '#FFF', borderRadius: 10, border: '1.5px solid #E5E5EA', textAlign: 'center', minWidth: 60, cursor: 'default' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{k.v}</div>
            <div style={{ fontSize: 9, color: '#86868B' }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Sub-tab selector */}
        <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1.5px solid #E5E5EA' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: subTab === t.id ? 700 : 500,
                background: subTab === t.id ? '#1D1D1F' : '#FFF',
                color: subTab === t.id ? '#FFF' : '#6E6E73',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
              <Icon name={t.icon} size={12} color={subTab === t.id ? '#FFF' : '#86868B'} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select value={filterType} onChange={e => setFilterType((e.target as HTMLSelectElement).value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 11, outline: 'none' }}>
          <option value="all">Todos los tipos</option>
          {RISK_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>

        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus((e.target as HTMLSelectElement).value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 11, outline: 'none' }}>
          <option value="open">Abiertos</option>
          <option value="mitigated">Mitigados</option>
          <option value="all">Todos</option>
        </select>

        {/* Tag filters */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            {activeTagFilter && (
              <button onClick={() => setActiveTagFilter(null)}
                style={{ padding: '3px 8px', borderRadius: 12, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 10, cursor: 'pointer', color: '#86868B' }}>✕</button>
            )}
            {tags.map((t: { id: string; name: string; color: string }) => (
              <button key={t.id} onClick={() => setActiveTagFilter(activeTagFilter === t.id ? null : t.id)}
                style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  border: activeTagFilter === t.id ? 'none' : `1.5px solid ${t.color}40`,
                  background: activeTagFilter === t.id ? t.color : '#FFF',
                  color: activeTagFilter === t.id ? '#FFF' : t.color,
                }}>
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Add buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {RISK_TYPES.map(t => (
            <button key={t.id} onClick={() => addRisk(t.id)}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${t.color}30`, background: '#FFF', fontSize: 11, fontWeight: 600, color: t.color, cursor: 'pointer' }}>
              + {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── RESUMEN VIEW ── */}
      {subTab === 'resumen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: '#C7C7CC', padding: 32, fontSize: 13 }}>
              Sin registros {filterStatus !== 'all' ? `(${filterStatus === 'open' ? 'abiertos' : 'mitigados'})` : ''}
            </p>
          )}
          {filtered.map(r => (
            <RiskCard
              key={r.id}
              risk={r}
              allRisks={allRisks}
              onOpenDetail={setDetailRisk}
              onUpdateImpact={(id, impact) => updateRisk(id, { impact: impact as Risk['impact'] })}
              onUpdateProb={(id, prob) => updateRisk(id, { prob: prob as Risk['prob'] })}
              onUpdateType={(id, type) => updateRisk(id, { type: type as Risk['type'] })}
              alerts={getAlerts(r)}
              linkedTasks={linkedTasks(r.id).map(a => ({ id: a.id, text: a.text, status: a.status }))}
            />
          ))}
        </div>
      )}

      {/* ── HEATMAP VIEW ── */}
      {subTab === 'heatmap' && (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <Heatmap risks={allRisks} onClickRisk={setDetailRisk} />
        </div>
      )}

      {/* ── ESCALADO VIEW ── */}
      {subTab === 'escalado' && (
        <EscaladoPanel
          risks={allRisks}
          user={user}
          actions={actions.map(a => ({ id: a.id, riskId: a.riskId }))}
          onUpdate={updateRisk}
          onOpenDetail={r => setDetailRisk(r)}
          getAlerts={getAlerts}
        />
      )}

      {/* ── RISK DETAIL MODAL ── */}
      {detailRisk && (
        <RiskDetailModal
          risk={detailRisk}
          allRisks={allRisks}
          teamMembers={teamMembers}
          linkedTasks={linkedTasks(detailRisk.id).map(a => ({ id: a.id, text: a.text, status: a.status, owner: a.owner, date: a.date }))}
          readOnly={(detailRisk as any)._readOnly || false}
          onSave={saveFromDetail}
          onClose={() => setDetailRisk(null)}
          onDelete={id => { deleteRisk(id); setDetailRisk(null); }}
        />
      )}
    </div>
  );
}
