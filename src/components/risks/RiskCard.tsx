// ═══ RISK CARD — Visual representation of a risk/problem/opportunity ═══
// Imports domain logic for calculations. Zero data layer dependencies.

import type { Risk } from '@app-types/index';
import { riskTitle, riskNumber, RISK_TYPES, ESCALATION_LEVELS } from '@domain/risks';
import { critColor } from '@domain/criticality';
import { Icon } from '@components/common/Icon';

// ── Types ──

interface AlertBadge {
  type: string;
  label: string;
  color: string;
}

interface LinkedTask {
  id: string;
  text: string;
  status: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface RiskCardProps {
  risk: Risk;
  allRisks: Risk[];
  onOpenDetail?: (r: Risk) => void;
  onUpdateImpact?: (id: string, impact: string) => void;
  onUpdateProb?: (id: string, prob: string) => void;
  onUpdateType?: (id: string, type: string) => void;
  readOnly?: boolean;
  alerts?: AlertBadge[];
  linkedTasks?: LinkedTask[];
  tags?: Tag[];
}

// ── Constants ──

const IMPACT_BTNS = [
  { id: 'alto',  label: 'Alto',  color: '#FF3B30' },
  { id: 'medio', label: 'Medio', color: '#FF9500' },
  { id: 'bajo',  label: 'Bajo',  color: '#34C759' },
] as const;

const PROB_BTNS = [
  { id: 'alta',  label: 'Alta',  color: '#FF3B30' },
  { id: 'media', label: 'Media', color: '#FF9500' },
  { id: 'baja',  label: 'Baja',  color: '#34C759' },
] as const;

// ── Component ──

export function RiskCard({
  risk,
  allRisks,
  onOpenDetail,
  onUpdateImpact,
  onUpdateProb,
  onUpdateType,
  readOnly = false,
  alerts = [],
  linkedTasks = [],
  tags = [],
}: RiskCardProps) {
  // Domain calculations — no inline business logic
  const num = riskNumber(risk, allRisks);
  const title = riskTitle(risk);
  const color = critColor(risk.prob || 'media', risk.impact || 'medio');
  const typeConfig = RISK_TYPES.find(t => t.id === (risk.type || 'riesgo'));
  const escLevel = risk.escalation?.level;
  const escConfig = escLevel ? ESCALATION_LEVELS.find(l => l.id === escLevel) : null;
  const isEscalated = escLevel && escLevel !== 'equipo';

  const handleClick = () => {
    if (!readOnly && onOpenDetail) onOpenDetail(risk);
  };

  return (
    <div
      class="card-hover"
      onClick={handleClick}
      style={{
        borderRadius: 14,
        background: '#FFF',
        border: '1.5px solid #E5E5EA',
        borderLeft: `4px solid ${color}`,
        padding: '12px 14px',
        cursor: readOnly ? 'default' : 'pointer',
        opacity: readOnly ? 0.7 : 1,
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        position: 'relative',
      }}
    >
      {/* Header: number + type selector + title + owner + escalation */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 30 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color }}>{num}</span>
          {!readOnly && onUpdateType && (
            <div style={{ display: 'flex', gap: 1 }}>
              {RISK_TYPES.map(t => (
                <button key={t.id} title={t.label}
                  onClick={e => { e.stopPropagation(); onUpdateType(risk.id, t.id); }}
                  style={{
                    width: 14, height: 14, borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 8, lineHeight: '14px', padding: 0,
                    background: (risk.type || 'riesgo') === t.id ? t.color : '#F2F2F7',
                    color: (risk.type || 'riesgo') === t.id ? '#FFF' : '#C7C7CC',
                  }}>
                  {t.prefix}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>{title}</p>
          {risk.description && (
            <p style={{ fontSize: 11, color: '#6E6E73', margin: '0 0 3px', lineHeight: 1.3 }}>
              {risk.description.length > 80 ? risk.description.slice(0, 80) + '…' : risk.description}
            </p>
          )}
          {risk.mitigation && (
            <p style={{ fontSize: 10, color: '#86868B', margin: 0 }}>
              <Icon name="Shield" size={10} color="#34C759" /> {risk.mitigation.length > 60 ? risk.mitigation.slice(0, 60) + '…' : risk.mitigation}
            </p>
          )}

          {/* Alert badges */}
          {alerts.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {alerts.map(a => (
                <span
                  key={a.type}
                  style={{
                    fontSize: 9, fontWeight: 700, color: '#FFF', background: a.color,
                    padding: '2px 7px', borderRadius: 10,
                    animation: a.type === 'overdue' ? 'pulse 1.5s infinite' : 'none',
                  }}
                >
                  <Icon name={a.type === 'stale' ? 'Clock' : a.type === 'retros' ? 'RefreshCw' : 'AlertTriangle'} size={9} color={a.color} /> {a.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {risk.owner && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#007AFF', flexShrink: 0 }}>
            {risk.owner}
          </span>
        )}
        {isEscalated && escConfig && (
          <span
            style={{
              fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
              background: escConfig.color + '15', color: escConfig.color,
            }}
          >
            ↑ {risk.escalation?.levelLabel || 'Escalado'}
          </span>
        )}
      </div>

      {/* Linked tasks */}
      {linkedTasks.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
          <Icon name="ClipboardList" size={10} color="#007AFF" />
          {linkedTasks.map(a => (
            <span
              key={a.id}
              style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 6,
                background: a.status === 'done' ? '#34C75915' : '#007AFF10',
                color: a.status === 'done' ? '#34C759' : '#007AFF',
                fontWeight: 600,
                textDecoration: a.status === 'done' ? 'line-through' : 'none',
              }}
            >
              {a.text.slice(0, 35)}{a.text.length > 35 ? '…' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {tags.map(t => (
            <span
              key={t.id}
              onClick={e => e.stopPropagation()}
              style={{
                fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                background: t.color + '15', color: t.color, border: `1.5px solid ${t.color}40`,
              }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {/* Impact + Probability buttons */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#86868B', fontWeight: 600, minWidth: 50 }}>Impacto:</span>
          {IMPACT_BTNS.map(btn => (
            <button
              key={btn.id}
              onClick={e => {
                e.stopPropagation();
                if (!readOnly && onUpdateImpact) onUpdateImpact(risk.id, btn.id);
              }}
              style={{
                padding: '2px 8px', borderRadius: 5,
                border: (risk.impact || 'medio') === btn.id ? `2px solid ${btn.color}` : '1px solid #E5E5EA',
                background: (risk.impact || 'medio') === btn.id ? btn.color + '18' : '#FFF',
                fontSize: 9, fontWeight: 700, color: btn.color,
                cursor: readOnly ? 'default' : 'pointer',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {(risk.type || 'riesgo') !== 'problema' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#86868B', fontWeight: 600, minWidth: 35 }}>Prob:</span>
            {PROB_BTNS.map(btn => (
              <button
                key={btn.id}
                onClick={e => {
                  e.stopPropagation();
                  if (!readOnly && onUpdateProb) onUpdateProb(risk.id, btn.id);
                }}
                style={{
                  padding: '2px 8px', borderRadius: 5,
                  border: (risk.prob || 'media') === btn.id ? `2px solid ${btn.color}` : '1px solid #E5E5EA',
                  background: (risk.prob || 'media') === btn.id ? btn.color + '18' : '#FFF',
                  fontSize: 9, fontWeight: 700, color: btn.color,
                  cursor: readOnly ? 'default' : 'pointer',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {!readOnly && (
          <span
            style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginLeft: 'auto',
              background: risk.status === 'mitigated' ? '#34C75915' : '#FF950015',
              color: risk.status === 'mitigated' ? '#34C759' : '#FF9500',
            }}
          >
            {risk.status === 'mitigated' ? 'Mitigado' : 'Abierto'}
          </span>
        )}
      </div>
    </div>
  );
}
