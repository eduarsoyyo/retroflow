// ═══ CALENDAR PROFILE — Shows assigned calendar details in profile ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import { loadCalendarios, calculateMonthlyBreakdown, calculateAnnualSummary, type Calendario } from '../../data/calendarios';
import { Icon } from '../common/Icon';

interface CalendarProfileProps {
  calendarioId?: string;
}

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export function CalendarProfile({ calendarioId }: CalendarProfileProps) {
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalendarios().then(cals => { setCalendarios(cals); setLoading(false); });
  }, []);

  const cal = calendarios.find(c => c.id === calendarioId);

  if (loading) return <div style={{ fontSize: 11, color: '#86868B', padding: 8 }}>Cargando calendario...</div>;
  if (!cal) return <div style={{ fontSize: 11, color: '#C7C7CC', padding: 8 }}>Sin calendario asignado</div>;

  const summary = calculateAnnualSummary(cal);
  const isIntensiveLong = (cal.intensive_start || '').includes('06');

  return (
    <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon name="Calendar" size={16} color="#5856D6" />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{cal.name}</div>
          <div style={{ fontSize: 11, color: '#86868B' }}>{cal.region} · {cal.year}</div>
        </div>
      </div>

      {/* Key info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'Vacaciones', value: `${cal.vacation_days || 22}d`, color: '#FF9500' },
          { label: 'Horas convenio', value: `${cal.convenio_hours || 1800}h`, color: '#007AFF' },
          { label: 'Horas efectivas', value: `${Math.round(summary.effectiveHours)}h`, color: '#34C759' },
          { label: 'Diferencia', value: `${summary.diff > 0 ? '+' : ''}${Math.round(summary.diff)}h`, color: summary.diff >= 0 ? '#34C759' : '#FF3B30' },
        ].map(k => (
          <div key={k.label} style={{ background: '#F9F9FB', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 8, color: '#86868B' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Schedule details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: '#F9F9FB', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 4 }}>JORNADA PARTIDA</div>
          <div style={{ fontSize: 11 }}>L-J: <b>{cal.daily_hours_lj || 8}h</b> · V: <b>{cal.daily_hours_v || 8}h</b></div>
          <div style={{ fontSize: 10, color: '#86868B' }}>{cal.weekly_hours_normal || 40}h/semana</div>
        </div>
        <div style={{ background: '#007AFF08', borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#007AFF', marginBottom: 4 }}>JORNADA INTENSIVA</div>
          <div style={{ fontSize: 11 }}><b>{cal.daily_hours_intensive || 7}h/día</b></div>
          <div style={{ fontSize: 10, color: '#86868B' }}>
            {cal.intensive_start ? `${cal.intensive_start.replace('-', '/')}` : '1/08'} — {cal.intensive_end ? `${cal.intensive_end.replace('-', '/')}` : '31/08'}
            {isIntensiveLong && <span style={{ color: '#5856D6', fontWeight: 600 }}> (3 meses)</span>}
          </div>
        </div>
      </div>

      {/* Extras */}
      {((cal.adjustment_days || 0) > 0 || (cal.free_days || 0) > 0) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(cal.adjustment_days || 0) > 0 && (
            <span style={{ fontSize: 10, background: '#FF950015', color: '#FF9500', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
              Ajuste: {cal.adjustment_days}d + {cal.adjustment_hours}h
            </span>
          )}
          {(cal.free_days || 0) > 0 && (
            <span style={{ fontSize: 10, background: '#34C75915', color: '#34C759', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
              Libre disposición: {cal.free_days}d
            </span>
          )}
          {cal.employee_type && cal.employee_type !== 'all' && (
            <span style={{ fontSize: 10, background: '#5856D615', color: '#5856D6', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
              {cal.employee_type === 'consultor' ? 'Consultor' : 'Staff'}
            </span>
          )}
        </div>
      )}

      {/* Monthly table */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 4 }}>DESGLOSE MENSUAL</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #E5E5EA', color: '#86868B' }}>Mes</th>
            <th style={{ textAlign: 'center', padding: '4px 6px', borderBottom: '1px solid #E5E5EA', color: '#86868B' }}>Días</th>
            <th style={{ textAlign: 'center', padding: '4px 6px', borderBottom: '1px solid #E5E5EA', color: '#86868B' }}>Horas</th>
          </tr>
        </thead>
        <tbody>
          {summary.monthly.map((m, i) => (
            <tr key={i}>
              <td style={{ padding: '3px 6px', borderBottom: '1px solid #F9F9FB' }}>{MONTHS[i]}</td>
              <td style={{ textAlign: 'center', padding: '3px 6px', borderBottom: '1px solid #F9F9FB', fontWeight: 600 }}>{m.days}</td>
              <td style={{ textAlign: 'center', padding: '3px 6px', borderBottom: '1px solid #F9F9FB', fontWeight: 600, color: '#007AFF' }}>{m.hours}</td>
            </tr>
          ))}
          <tr style={{ background: '#F9F9FB', fontWeight: 700 }}>
            <td style={{ padding: '4px 6px' }}>TOTAL</td>
            <td style={{ textAlign: 'center', padding: '4px 6px' }}>{summary.totalDays}</td>
            <td style={{ textAlign: 'center', padding: '4px 6px', color: '#007AFF' }}>{Math.round(summary.totalHours)}</td>
          </tr>
        </tbody>
      </table>

      {/* Holidays count */}
      <div style={{ marginTop: 8, fontSize: 10, color: '#86868B' }}>
        {(cal.holidays || []).length} festivos configurados
      </div>
    </div>
  );
}
