// ═══ CALENDAR PANEL — Unified Calendar + Convenio with visual grid ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Member } from '@app-types/index';
import { loadCalendarios, saveCalendario, deleteCalendario, assignCalendarioToMember, type Calendario, type Holiday } from '@data/calendarios';
import { loadTeamMembers } from '@data/team';
import { Icon } from '@components/common/Icon';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS = ['L','M','X','J','V','S','D'];
const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;
const inputS = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#F9F9FB' };
const labelS = { fontSize: 9, fontWeight: 700 as number, color: '#86868B', display: 'block', marginBottom: 2, textTransform: 'uppercase' as const };

export function CalendarPanel() {
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCal, setEditCal] = useState<Calendario | null>(null);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  // Holiday popup
  const [holidayPopup, setHolidayPopup] = useState<{ date: string } | null>(null);
  const [holidayName, setHolidayName] = useState('');

  // Clone modal
  const [showClone, setShowClone] = useState(false);
  const [cloneHolidays, setCloneHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    Promise.all([loadCalendarios(), loadTeamMembers()]).then(([cals, mR]) => {
      setCalendarios(cals);
      if (mR.ok) setMembers(mR.data);
      setLoading(false);
    });
  }, []);

  const createCal = async () => {
    const saved = await saveCalendario({ name: `Calendario ${viewYear}`, year: viewYear, region: '', holidays: [], weekly_hours_normal: 40, daily_hours_lj: 8, daily_hours_v: 8, daily_hours_intensive: 7, intensive_start: '08-01', intensive_end: '08-31', convenio_hours: 1800, vacation_days: 22, adjustment_days: 0, adjustment_hours: 0, free_days: 0, employee_type: 'all', seniority: 'all' });
    if (saved) { setCalendarios(prev => [...prev, saved]); setEditCal(saved); }
  };

  const updateCal = async (cal: Calendario) => {
    const saved = await saveCalendario(cal);
    if (saved) { setCalendarios(prev => prev.map(c => c.id === saved.id ? saved : c)); setEditCal(saved); }
  };

  const removeCal = async (id: string) => {
    await deleteCalendario(id);
    setCalendarios(prev => prev.filter(c => c.id !== id));
    if (editCal?.id === id) setEditCal(null);
  };

  const handleAssign = async (memberId: string, calId: string) => {
    await assignCalendarioToMember(memberId, calId || null);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, calendario_id: calId } as Member : m));
  };

  // Holiday helpers
  const isHoliday = (dateStr: string) => editCal?.holidays.some(h => h.date === dateStr) || false;
  const getHoliday = (dateStr: string) => editCal?.holidays.find(h => h.date === dateStr);
  const isIntensive = (dateStr: string) => {
    if (!editCal) return false;
    const yr = editCal.year || viewYear;
    const start = `${yr}-${editCal.intensive_start || '08-01'}`;
    const end = `${yr}-${editCal.intensive_end || '08-31'}`;
    return dateStr >= start && dateStr <= end;
  };

  const addHoliday = () => {
    if (!editCal || !holidayPopup || !holidayName.trim()) return;
    const updated = { ...editCal, holidays: [...editCal.holidays.filter(h => h.date !== holidayPopup.date), { date: holidayPopup.date, name: holidayName.trim() }].sort((a, b) => a.date.localeCompare(b.date)) };
    updateCal(updated);
    setHolidayPopup(null); setHolidayName('');
  };

  const removeHoliday = (date: string) => {
    if (!editCal) return;
    updateCal({ ...editCal, holidays: editCal.holidays.filter(h => h.date !== date) });
  };

  // Clone year
  const openClone = () => {
    if (!editCal) return;
    const nextYear = (editCal.year || viewYear) + 1;
    const cloned = editCal.holidays.map(h => ({
      ...h,
      date: h.date.replace(/^\d{4}/, String(nextYear)),
    }));
    setCloneHolidays(cloned);
    setShowClone(true);
  };

  const handleClone = async () => {
    if (!editCal) return;
    const nextYear = (editCal.year || viewYear) + 1;
    const saved = await saveCalendario({
      name: editCal.name.replace(/\d{4}/, String(nextYear)),
      year: nextYear, region: editCal.region, holidays: cloneHolidays,
      weekly_hours_normal: editCal.weekly_hours_normal, daily_hours_lj: editCal.daily_hours_lj,
      daily_hours_v: editCal.daily_hours_v, daily_hours_intensive: editCal.daily_hours_intensive,
      intensive_start: editCal.intensive_start, intensive_end: editCal.intensive_end,
      convenio_hours: editCal.convenio_hours, vacation_days: editCal.vacation_days,
      adjustment_days: editCal.adjustment_days, adjustment_hours: editCal.adjustment_hours,
      free_days: editCal.free_days, employee_type: editCal.employee_type, seniority: editCal.seniority,
    });
    if (saved) { setCalendarios(prev => [...prev, saved]); }
    setShowClone(false);
  };

  const removeCloneHoliday = (date: string) => setCloneHolidays(prev => prev.filter(h => h.date !== date));
  const editCloneHoliday = (date: string, name: string) => setCloneHolidays(prev => prev.map(h => h.date === date ? { ...h, name } : h));

  // Calendar grid
  const calYear = editCal?.year || viewYear;

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Calendario y Convenio</h2>
          <p style={{ fontSize: 12, color: '#86868B' }}>{calendarios.length} calendario{calendarios.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={createCal} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="Plus" size={12} color="#FFF" /> Nuevo calendario
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: editCal ? '240px 1fr' : '1fr', gap: 12 }}>
        {/* Left: calendar list */}
        <div>
          {calendarios.map(c => {
            const assigned = members.filter(m => (m as Record<string, unknown>).calendario_id === c.id);
            return (
              <div key={c.id} onClick={() => { setEditCal(c); setViewMonth(new Date().getMonth()); setViewYear(c.year || new Date().getFullYear()); }}
                style={{ ...cardS, padding: 12, marginBottom: 8, cursor: 'pointer', borderColor: editCal?.id === c.id ? '#007AFF' : '#E5E5EA', background: editCal?.id === c.id ? '#007AFF06' : '#FFF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: '#86868B' }}>{c.holidays.length} festivos · {c.region || 'Sin región'}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeCal(c.id); }}
                    style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="Trash2" size={10} color="#FF3B30" />
                  </button>
                </div>
                {assigned.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, marginTop: 6, flexWrap: 'wrap' }}>
                    {assigned.map(m => <span key={m.id} style={{ fontSize: 13 }} title={m.name}>{m.avatar || '👤'}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: editor */}
        {editCal && (
          <div style={{ ...cardS, padding: 16, overflow: 'auto' }}>
            {/* Name + Region */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input value={editCal.name} onInput={e => { const u = { ...editCal, name: (e.target as HTMLInputElement).value }; setEditCal(u); updateCal(u); }}
                style={{ ...inputS, flex: 2, minWidth: 150, fontWeight: 700 }} />
              <input value={editCal.region} onInput={e => { const u = { ...editCal, region: (e.target as HTMLInputElement).value }; setEditCal(u); updateCal(u); }}
                placeholder="Región" style={{ ...inputS, flex: 1, minWidth: 100 }} />
            </div>

            {/* Convenio fields */}
            <div style={{ background: '#F9F9FB', borderRadius: 10, padding: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', marginBottom: 6, textTransform: 'uppercase' }}>JORNADA Y CONVENIO</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, fontSize: 11 }}>
                {([
                  ['H. convenio', 'convenio_hours', 1800], ['Vacaciones', 'vacation_days', 22],
                  ['H/sem normal', 'weekly_hours_normal', 40], ['H/día intens.', 'daily_hours_intensive', 7],
                  ['H/día L-J', 'daily_hours_lj', 8], ['H/día V', 'daily_hours_v', 8],
                  ['Ajuste días', 'adjustment_days', 0], ['Libre disp.', 'free_days', 0],
                ] as const).map(([label, field, def]) => (
                  <div key={field}>
                    <label style={labelS}>{label}</label>
                    <input type="number" step="0.5" value={(editCal as Record<string, unknown>)[field] as number ?? def}
                      onInput={e => { const u = { ...editCal, [field]: parseFloat((e.target as HTMLInputElement).value) || def }; setEditCal(u); updateCal(u); }}
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 11, outline: 'none' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                <div><label style={labelS}>Intensiva desde</label>
                  <input value={editCal.intensive_start || '08-01'} onInput={e => { const u = { ...editCal, intensive_start: (e.target as HTMLInputElement).value }; setEditCal(u); updateCal(u); }}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 11, outline: 'none' }} />
                </div>
                <div><label style={labelS}>Intensiva hasta</label>
                  <input value={editCal.intensive_end || '08-31'} onInput={e => { const u = { ...editCal, intensive_end: (e.target as HTMLInputElement).value }; setEditCal(u); updateCal(u); }}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 11, outline: 'none' }} />
                </div>
              </div>
            </div>

            {/* ── Visual Calendar Grid ── */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }}
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="ChevronLeft" size={13} color="#6E6E73" />
                </button>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{MONTHS[viewMonth]} {viewYear}</span>
                <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }}
                  style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="ChevronRight" size={13} color="#6E6E73" />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, textAlign: 'center' }}>
                {DAYS.map(d => <div key={d} style={{ fontSize: 9, fontWeight: 700, color: '#AEAEB2', padding: '3px 0' }}>{d}</div>)}
                {(() => {
                  const first = new Date(viewYear, viewMonth, 1).getDay();
                  const offset = first === 0 ? 6 : first - 1;
                  const days = new Date(viewYear, viewMonth + 1, 0).getDate();
                  const cells = [];
                  for (let i = 0; i < offset; i++) cells.push(<div key={`e${i}`} />);
                  for (let d = 1; d <= days; d++) {
                    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const dow = new Date(viewYear, viewMonth, d).getDay();
                    const wk = dow === 0 || dow === 6;
                    const hol = isHoliday(ds);
                    const holData = getHoliday(ds);
                    const intens = isIntensive(ds);
                    const today = ds === new Date().toISOString().slice(0, 10);
                    cells.push(
                      <div key={d}
                        onClick={() => { if (!wk) { if (hol) { removeHoliday(ds); } else { setHolidayPopup({ date: ds }); setHolidayName(''); } } }}
                        title={hol ? holData?.name : intens ? 'Jornada intensiva' : undefined}
                        style={{
                          aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 8, fontSize: 11, fontWeight: hol || today ? 700 : 500, cursor: wk ? 'default' : 'pointer',
                          background: hol ? '#FF3B30' : intens && !wk ? '#007AFF12' : today ? '#007AFF10' : 'transparent',
                          color: hol ? '#FFF' : wk ? '#D1D1D6' : intens ? '#007AFF' : today ? '#007AFF' : '#1D1D1F',
                          border: today && !hol ? '1.5px solid #007AFF' : '1.5px solid transparent',
                          transition: 'all .12s',
                        }}>
                        {d}
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'center', fontSize: 9, color: '#86868B' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#FF3B30' }} /> Festivo (click para quitar)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#007AFF20', border: '1px solid #007AFF40' }} /> Intensiva</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#FFF', border: '1px solid #1D1D1F30' }} /> Click = añadir festivo</span>
              </div>

              {/* Clone + holiday list buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
                <button onClick={openClone}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #5856D630', background: '#5856D608', color: '#5856D6', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="Copy" size={12} color="#5856D6" /> Copiar a {calYear + 1}
                </button>
              </div>
            </div>

            {/* Holiday list (compact) */}
            <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>
                {editCal.holidays.length} FESTIVOS
              </div>
              {editCal.holidays.map(h => (
                <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid #F9F9FB', fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: '#FF3B30', minWidth: 44 }}>{h.date.slice(5).replace('-', '/')}</span>
                  <span style={{ flex: 1, color: '#1D1D1F' }}>{h.name}</span>
                  <button onClick={() => removeHoliday(h.date)} style={{ border: 'none', background: 'none', color: '#C7C7CC', cursor: 'pointer' }}>
                    <Icon name="X" size={10} color="#C7C7CC" />
                  </button>
                </div>
              ))}
            </div>

            {/* Assign users */}
            <div style={{ paddingTop: 10, borderTop: '1px solid #F2F2F7' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>ASIGNAR USUARIOS</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {members.map(m => {
                  const isAss = (m as Record<string, unknown>).calendario_id === editCal.id;
                  return (
                    <button key={m.id} onClick={() => handleAssign(m.id, isAss ? '' : editCal.id)}
                      style={{ padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: isAss ? 'none' : '1px dashed #E5E5EA', background: isAss ? '#34C759' : '#FFF', color: isAss ? '#FFF' : '#86868B' }}>
                      {m.avatar || '👤'} {m.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Holiday name popup ── */}
      {holidayPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setHolidayPopup(null)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 16, maxWidth: 340, width: '100%', padding: 20, boxShadow: '0 16px 48px rgba(0,0,0,.2)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Añadir festivo</h4>
            <p style={{ fontSize: 12, color: '#86868B', marginBottom: 10 }}>
              {new Date(holidayPopup.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <input value={holidayName} onInput={e => setHolidayName((e.target as HTMLInputElement).value)}
              onKeyDown={e => e.key === 'Enter' && addHoliday()}
              placeholder="Nombre del festivo" autoFocus
              style={inputS} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setHolidayPopup(null)} style={{ flex: 1, padding: 9, borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={addHoliday} disabled={!holidayName.trim()} style={{ flex: 1, padding: 9, borderRadius: 8, border: 'none', background: '#FF3B30', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: holidayName.trim() ? 1 : 0.4 }}>Añadir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clone year modal ── */}
      {showClone && editCal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowClone(false)}>
          <div onClick={(e: Event) => e.stopPropagation()}
            style={{ background: '#FFF', borderRadius: 20, maxWidth: 480, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Copiar festivos a {calYear + 1}</h3>
            <p style={{ fontSize: 12, color: '#86868B', marginBottom: 14 }}>Revisa y edita los festivos antes de crear el calendario.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
              {cloneHolidays.map(h => (
                <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#F9F9FB', borderRadius: 8 }}>
                  <span style={{ fontWeight: 600, color: '#FF3B30', minWidth: 50, fontSize: 11 }}>{h.date.slice(5).replace('-', '/')}</span>
                  <input value={h.name} onInput={e => editCloneHoliday(h.date, (e.target as HTMLInputElement).value)}
                    style={{ flex: 1, border: '1px solid #E5E5EA', borderRadius: 6, padding: '4px 8px', fontSize: 12, outline: 'none' }} />
                  <button onClick={() => removeCloneHoliday(h.date)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                    <Icon name="X" size={12} color="#C7C7CC" />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowClone(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleClone} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: '#5856D6', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Crear calendario {calYear + 1} ({cloneHolidays.length} festivos)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
