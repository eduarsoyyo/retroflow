import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/data/supabase'
import type { Room, Member } from '@/types'
import { Plus, Edit, Trash2, ExternalLink, Users, DollarSign, Calendar, X, Calculator, Upload, Download } from 'lucide-react'
import { soundCreate, soundDelete } from '@/lib/sounds'

const TIPOS = [
  { id: 'agile', label: 'Agile / Scrum' }, { id: 'kanban', label: 'Kanban' },
  { id: 'itil', label: 'ITIL / Servicio' }, { id: 'waterfall', label: 'Waterfall' },
]
const BILLING = [
  { id: 'tm', label: 'T&M (por horas)' }, { id: 'fixed', label: 'Precio cerrado' }, { id: 'fte', label: 'FTE / Venta total' },
]

interface CostProfile { role: string; rate: number; hours: number; qty: number }
interface OrgEntry { id?: string; member_id: string; sala: string; dedication: number; start_date: string; end_date: string }
interface MemberSellRate { member_id: string; sell_rate: number; planned_hours: number }

interface ProjectForm {
  name: string; slug: string; tipo: string; status: string
  start_date: string; end_date: string
  billing_type: string; sell_rate: number; fixed_price: number
  budget: number; planned_hours: number; target_margin: number; risk_pct: number
  cost_profiles: CostProfile[]
  member_sell_rates: MemberSellRate[]
}
const emptyForm: ProjectForm = { name: '', slug: '', tipo: 'agile', status: 'active', start_date: '', end_date: '', billing_type: 'tm', sell_rate: 0, fixed_price: 0, budget: 0, planned_hours: 0, target_margin: 20, risk_pct: 5, cost_profiles: [], member_sell_rates: [] }

const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
const rx = (r: Room) => r as unknown as Record<string, unknown>

export function ProjectsPanel() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [orgChart, setOrgChart] = useState<OrgEntry[]>([])
  const [retroStats, setRetroStats] = useState<Record<string, { actions: number; done: number; risks: number }>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editRoom, setEditRoom] = useState<Room | null>(null)
  const [form, setForm] = useState<ProjectForm>({ ...emptyForm })
  const [orgEdits, setOrgEdits] = useState<OrgEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').order('name'),
      supabase.from('team_members').select('*').order('name'),
      supabase.from('org_chart').select('*'),
      supabase.from('retros').select('sala, data').eq('status', 'active'),
    ]).then(([rR, mR, oR, retR]) => {
      if (rR.data) setRooms(rR.data)
      if (mR.data) setMembers(mR.data)
      if (oR.data) setOrgChart(oR.data as OrgEntry[])
      const stats: Record<string, { actions: number; done: number; risks: number }> = {}
      ;(retR.data || []).forEach((r: { sala: string; data: Record<string, unknown> }) => {
        const d = r.data || {}; const acts = ((d.actions || []) as Array<Record<string, unknown>>).filter(a => a.status !== 'discarded' && a.status !== 'cancelled')
        stats[r.sala] = { actions: acts.length, done: acts.filter(a => a.status === 'done' || a.status === 'archived').length, risks: ((d.risks || []) as Array<Record<string, unknown>>).filter(ri => ri.status !== 'mitigated').length }
      })
      setRetroStats(stats); setLoading(false)
    })
  }, [])

  const openCreate = () => { setForm({ ...emptyForm }); setOrgEdits([]); setEditRoom(null); setModal('create') }
  const openEdit = (r: Room) => {
    const projMembers = members.filter(m => (m.rooms || []).includes(r.slug))
    const existingOrg = orgChart.filter(o => o.sala === r.slug)
    // Build org edits for each assigned member
    const edits: OrgEntry[] = projMembers.map(m => {
      const existing = existingOrg.find(o => o.member_id === m.id)
      return existing || { member_id: m.id, sala: r.slug, dedication: 100, start_date: (rx(r).start_date as string) || '', end_date: (rx(r).end_date as string) || '' }
    })
    const existingSR = (rx(r).member_sell_rates as MemberSellRate[]) || []
    setForm({
      name: r.name, slug: r.slug, tipo: r.tipo || 'agile', status: (rx(r).status as string) || 'active',
      start_date: (rx(r).start_date as string) || '', end_date: (rx(r).end_date as string) || '',
      billing_type: (rx(r).billing_type as string) || 'tm', sell_rate: Number(rx(r).sell_rate) || 0,
      fixed_price: Number(rx(r).fixed_price) || 0, budget: Number(rx(r).budget) || 0,
      planned_hours: Number(rx(r).planned_hours) || 0, target_margin: Number(rx(r).target_margin) || 20,
      risk_pct: Number(rx(r).risk_pct) || 5, cost_profiles: (rx(r).cost_profiles as CostProfile[]) || [],
      member_sell_rates: projMembers.map(m => existingSR.find(s => s.member_id === m.id) || { member_id: m.id, sell_rate: 0, planned_hours: 0 }),
    })
    setOrgEdits(edits); setEditRoom(r); setModal('edit')
  }

  // ── Budget auto-calc from profiles ──
  const profilesCost = useMemo(() => {
    return form.cost_profiles.reduce((s, p) => s + (p.rate * p.hours * (p.qty || 1)), 0)
  }, [form.cost_profiles])

  const autoVenta = useMemo(() => {
    const denom = 1 - (form.target_margin / 100) - (form.risk_pct / 100)
    return denom > 0 ? Math.round(profilesCost / denom) : 0
  }, [profilesCost, form.target_margin, form.risk_pct])

  const autoMarginAbs = autoVenta - profilesCost
  const autoRiskAbs = Math.round(autoVenta * form.risk_pct / 100)

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      name: form.name, tipo: form.tipo, status: form.status,
      start_date: form.start_date || null, end_date: form.end_date || null,
      billing_type: form.billing_type, sell_rate: form.sell_rate,
      fixed_price: form.billing_type === 'fte' ? autoVenta : form.fixed_price,
      budget: form.budget || profilesCost, planned_hours: form.planned_hours,
      target_margin: form.target_margin, risk_pct: form.risk_pct,
      cost_profiles: form.cost_profiles, member_sell_rates: form.member_sell_rates,
    }
    if (modal === 'create') {
      const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const { data, error } = await supabase.from('rooms').insert({ ...payload, slug }).select().single()
      if (error) { console.error('[revelio] create project error:', error.message); alert('Error al crear: ' + error.message); setSaving(false); return }
      if (data) { setRooms(prev => [...prev, data]); soundCreate() }
    } else if (editRoom) {
      const { data } = await supabase.from('rooms').update(payload).eq('slug', editRoom.slug).select().single()
      if (data) setRooms(prev => prev.map(r => r.slug === editRoom.slug ? data : r))
      // Save org_chart entries
      for (const oe of orgEdits) {
        const existing = orgChart.find(o => o.member_id === oe.member_id && o.sala === oe.sala)
        if (existing?.id) {
          await supabase.from('org_chart').update({ dedication: oe.dedication / 100, start_date: oe.start_date || null, end_date: oe.end_date || null }).eq('id', existing.id)
        } else {
          await supabase.from('org_chart').insert({ member_id: oe.member_id, sala: oe.sala, dedication: oe.dedication / 100, start_date: oe.start_date || null, end_date: oe.end_date || null })
        }
      }
      // Refresh org_chart
      const { data: newOrg } = await supabase.from('org_chart').select('*')
      if (newOrg) setOrgChart(newOrg as OrgEntry[])
      soundCreate()
    }
    setSaving(false); setModal(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return
    await supabase.from('rooms').delete().eq('slug', deleteTarget.slug)
    setRooms(prev => prev.filter(r => r.slug !== deleteTarget.slug)); setDeleteTarget(null); setDeleteConfirm(''); soundDelete()
  }

  const projMembers = editRoom ? members.filter(m => (m.rooms || []).includes(editRoom.slug)) : []

  const [importingProjects, setImportingProjects] = useState(false)
  const [importProjectResult, setImportProjectResult] = useState<string | null>(null)

  const downloadProjectTemplate = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre*', 'tipo', 'cliente', 'fecha_inicio', 'fecha_fin', 'facturacion', 'margen_objetivo', 'presupuesto', 'descripcion'],
      ['VWFS', 'proyecto', 'Volkswagen', '2025-01-01', '2025-12-31', 'tm', '20', '150000', 'Proyecto de desarrollo VW'],
      ['Endesa Boost', 'servicio', 'Endesa', '2025-03-01', '2026-02-28', 'fixed', '25', '80000', ''],
    ])
    ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Proyectos')
    const instr = XLSX.utils.aoa_to_sheet([
      ['Campo', 'Obligatorio', 'Descripción', 'Valores posibles'],
      ['nombre*', 'SÍ', 'Nombre del proyecto', ''],
      ['tipo', 'No', 'Tipo de proyecto', 'proyecto, servicio, soporte, formacion'],
      ['cliente', 'No', 'Nombre del cliente', ''],
      ['fecha_inicio', 'No', 'Fecha inicio YYYY-MM-DD', '2025-01-01'],
      ['fecha_fin', 'No', 'Fecha fin YYYY-MM-DD', '2025-12-31'],
      ['facturacion', 'No', 'Tipo de facturación', 'tm (Time & Materials), fixed (Precio cerrado), fte (FTE)'],
      ['margen_objetivo', 'No', 'Margen objetivo %', '20'],
      ['presupuesto', 'No', 'Presupuesto total €', '150000'],
      ['descripcion', 'No', 'Descripción del proyecto', ''],
    ])
    instr['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 36 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, instr, 'Instrucciones')
    XLSX.writeFile(wb, 'plantilla_proyectos_revelio.xlsx')
  }

  const handleImportProjects = async (file: File) => {
    setImportingProjects(true); setImportProjectResult(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer(); const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]!]; if (!ws) throw new Error('Hoja vacía')
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      let created = 0; const errors: string[] = []
      for (const row of rows) {
        const name = String(row['nombre*'] || row['nombre'] || row['Nombre'] || '').trim(); if (!name) continue
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const tipo = String(row['tipo'] || row['Tipo'] || 'proyecto')
        const client = String(row['cliente'] || row['Cliente'] || '')
        const startDate = String(row['fecha_inicio'] || row['Fecha inicio'] || '')
        const endDate = String(row['fecha_fin'] || row['Fecha fin'] || '')
        const billing = String(row['facturacion'] || row['Facturación'] || 'tm')
        const margin = Number(row['margen_objetivo'] || row['Margen objetivo'] || 20)
        const budget = Number(row['presupuesto'] || row['Presupuesto'] || 0)
        const desc = String(row['descripcion'] || row['Descripción'] || '')

        const { error } = await supabase.from('rooms').insert({
          slug, name, tipo, client: client || null,
          start_date: startDate || null, end_date: endDate || null,
          billing_type: billing, target_margin: margin, budget,
          description: desc || null, status: 'active',
          member_assigns: [], member_sell_rates: [], cost_profiles: [],
          risk_pct: 5, planned_hours: 0,
        })
        if (error) { errors.push(`${name}: ${error.message}`); continue }
        // Create active retro
        await supabase.from('retros').insert({ sala: slug, data: { actions: [], risks: [], notes: [], positives: [] }, status: 'active' })
        created++
      }
      setImportProjectResult(`${created} proyectos creados${errors.length > 0 ? `. Errores: ${errors.join('; ')}` : ''}`)
      const { data } = await supabase.from('rooms').select('*').order('name'); if (data) setRooms(data)
    } catch (e) { setImportProjectResult(`Error: ${(e as Error).message}`) }
    setImportingProjects(false)
  }

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text">Proyectos</h2><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{rooms.length} proyectos</p></div>
        <div className="flex gap-2">
          <button onClick={downloadProjectTemplate} className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle flex items-center gap-1 hover:bg-revelio-bg"><Download className="w-3.5 h-3.5" /> Plantilla</button>
          <label className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle flex items-center gap-1 cursor-pointer hover:bg-revelio-bg"><Upload className="w-3.5 h-3.5" /> {importingProjects ? 'Importando...' : 'Importar'}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImportProjects(f); e.target.value = '' }} disabled={importingProjects} /></label>
          <button onClick={openCreate} className="px-3 py-1.5 rounded-lg bg-revelio-text text-white text-xs font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nuevo</button>
        </div>
      </div>

      {importProjectResult && (
        <div className={`rounded-lg px-4 py-2 mb-3 text-xs font-medium ${importProjectResult.includes('Error') ? 'bg-revelio-red/10 text-revelio-red' : 'bg-revelio-green/10 text-revelio-green'}`}>
          {importProjectResult} <button onClick={() => setImportProjectResult(null)} className="ml-2 text-revelio-subtle hover:underline">Cerrar</button>
        </div>
      )}

      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-revelio-bg dark:bg-revelio-dark-border">{['Proyecto', 'Periodo', 'Facturación', 'Margen', 'Equipo', 'Progreso', ''].map(h => <th key={h} className="px-3 py-2 text-left text-[9px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>{rooms.map((r, i) => {
            const s = retroStats[r.slug] || { actions: 0, done: 0, risks: 0 }; const tc = members.filter(m => (m.rooms || []).includes(r.slug)).length
            const pct = s.actions > 0 ? Math.round(s.done / s.actions * 100) : 0
            const bt = (rx(r).billing_type as string) || 'tm'; const sr = Number(rx(r).sell_rate) || 0; const fp = Number(rx(r).fixed_price) || 0; const tm = Number(rx(r).target_margin) || 0
            const sd = (rx(r).start_date as string) || ''; const ed = (rx(r).end_date as string) || ''
            return (
              <tr key={r.slug} className={`border-t border-revelio-border dark:border-revelio-dark-border/50 ${i % 2 ? 'bg-revelio-bg/50 dark:bg-revelio-dark-border/20' : ''}`}>
                <td className="px-3 py-2.5"><Link to={`/project/${r.slug}`} className="font-medium text-revelio-text dark:text-revelio-dark-text hover:text-revelio-blue">{r.name}</Link><div className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle capitalize">{r.tipo}</div></td>
                <td className="px-3 py-2.5 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{sd && ed ? <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{new Date(sd).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })} — {new Date(ed).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}</span> : '—'}</td>
                <td className="px-3 py-2.5 text-[10px]"><span className="flex items-center gap-0.5"><DollarSign className="w-2.5 h-2.5 text-revelio-green" />{bt === 'tm' ? `${sr}€/h` : `${fmt(fp)}€`}</span></td>
                <td className="px-3 py-2.5 text-[10px]"><span className={`font-bold ${tm >= 20 ? 'text-revelio-green' : tm >= 10 ? 'text-revelio-orange' : 'text-revelio-red'}`}>{tm}%</span></td>
                <td className="px-3 py-2.5"><span className="flex items-center gap-1 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle"><Users className="w-3 h-3" /> {tc}</span></td>
                <td className="px-3 py-2.5"><div className="flex items-center gap-1.5"><div className="w-12 h-1.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 70 ? 'bg-revelio-green' : pct >= 40 ? 'bg-revelio-orange' : 'bg-revelio-red'}`} style={{ width: `${pct}%` }} /></div><span className={`text-[10px] font-semibold ${pct >= 70 ? 'text-revelio-green' : pct >= 40 ? 'text-revelio-orange' : 'text-revelio-red'}`}>{pct}%</span></div></td>
                <td className="px-3 py-2.5"><div className="flex gap-1"><button onClick={() => openEdit(r)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Edit className="w-3 h-3 text-revelio-blue" /></button><button onClick={() => { setDeleteTarget(r); setDeleteConfirm('') }} className="w-6 h-6 rounded border border-revelio-red/20 flex items-center justify-center hover:bg-revelio-red/5"><Trash2 className="w-3 h-3 text-revelio-red" /></button><Link to={`/project/${r.slug}`} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><ExternalLink className="w-3 h-3 text-revelio-subtle" /></Link></div></td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>

      {/* ═══ MODAL ═══ */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-4 dark:text-revelio-dark-text">{modal === 'create' ? 'Nuevo proyecto' : `Editar: ${form.name}`}</h3>
            <div className="space-y-4">
              {/* Basic */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><L>Nombre *</L><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                {modal === 'create' && <div className="col-span-2"><L>Slug</L><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder={form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>}
                <div><L>Tipo</L><Sel val={form.tipo} set={v => setForm({ ...form, tipo: v })} opts={TIPOS.map(t => [t.id, t.label])} /></div>
                <div><L>Estado</L><Sel val={form.status} set={v => setForm({ ...form, status: v })} opts={[['active','Activo'],['paused','Pausado'],['closed','Cerrado']]} /></div>
                <div><L>Inicio</L><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                <div><L>Fin</L><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
              </div>

              {/* Billing type */}
              <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div><L>Facturación</L><Sel val={form.billing_type} set={v => setForm({ ...form, billing_type: v })} opts={BILLING.map(b => [b.id, b.label])} /></div>
                  <div><L>Margen objetivo %</L><Num val={form.target_margin} set={v => setForm({ ...form, target_margin: v })} /></div>
                  <div><L>% Riesgo (colchón)</L><Num val={form.risk_pct} set={v => setForm({ ...form, risk_pct: v })} /></div>
                </div>
                {form.billing_type === 'tm' && <div className="mb-3"><L>Tarifa venta base €/h</L><Num val={form.sell_rate} set={v => setForm({ ...form, sell_rate: v })} /></div>}
                {form.billing_type === 'fixed' && <div className="mb-3"><L>Precio cerrado €</L><Num val={form.fixed_price} set={v => setForm({ ...form, fixed_price: v })} step={100} /></div>}
              </div>

              {/* Cost Profiles — the core budget builder */}
              <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase flex items-center gap-1"><Calculator className="w-3 h-3" /> Presupuesto por perfiles</p>
                  <button onClick={() => setForm({ ...form, cost_profiles: [...form.cost_profiles, { role: '', rate: 0, hours: 0, qty: 1 }] })} className="text-[9px] text-revelio-blue font-medium flex items-center gap-0.5"><Plus className="w-3 h-3" /> Perfil</button>
                </div>
                {form.cost_profiles.length > 0 && (
                  <div>
                    <div className="grid grid-cols-[1fr_60px_70px_40px_70px] gap-1 text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase px-1 mb-1">
                      <span>Perfil</span><span className="text-right">€/h</span><span className="text-right">Horas</span><span className="text-right">Uds</span><span className="text-right">Importe</span>
                    </div>
                    {form.cost_profiles.map((cp, i) => {
                      const importe = cp.rate * cp.hours * (cp.qty || 1)
                      return (
                        <div key={i} className="grid grid-cols-[1fr_60px_70px_40px_70px_20px] gap-1 items-center mb-1">
                          <input value={cp.role} onChange={e => { const n = [...form.cost_profiles]; n[i] = { ...n[i]!, role: e.target.value }; setForm({ ...form, cost_profiles: n }) }} placeholder="Ej: Senior Dev" className="rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
                          <input type="number" value={cp.rate || ''} onChange={e => { const n = [...form.cost_profiles]; n[i] = { ...n[i]!, rate: Number(e.target.value) }; setForm({ ...form, cost_profiles: n }) }} className="rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" step={0.5} />
                          <input type="number" value={cp.hours || ''} onChange={e => { const n = [...form.cost_profiles]; n[i] = { ...n[i]!, hours: Number(e.target.value) }; setForm({ ...form, cost_profiles: n }) }} className="rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
                          <input type="number" value={cp.qty || 1} onChange={e => { const n = [...form.cost_profiles]; n[i] = { ...n[i]!, qty: Number(e.target.value) || 1 }; setForm({ ...form, cost_profiles: n }) }} className="rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-1 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={1} />
                          <span className="text-[10px] font-bold text-right dark:text-revelio-dark-text">{fmt(importe)}€</span>
                          <button onClick={() => setForm({ ...form, cost_profiles: form.cost_profiles.filter((_, j) => j !== i) })} className="text-revelio-subtle hover:text-revelio-red"><X className="w-3 h-3" /></button>
                        </div>
                      )
                    })}

                    {/* Totals */}
                    <div className="mt-3 rounded-lg bg-revelio-bg dark:bg-revelio-dark-border p-3 space-y-1.5">
                      <div className="flex justify-between text-[10px]"><span className="text-revelio-subtle dark:text-revelio-dark-subtle">Coste total (perfiles)</span><span className="font-bold text-revelio-orange">{fmt(profilesCost)}€</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-revelio-subtle dark:text-revelio-dark-subtle">Margen ({form.target_margin}%)</span><span className="font-bold text-revelio-green">+{fmt(autoMarginAbs)}€</span></div>
                      <div className="flex justify-between text-[10px]"><span className="text-revelio-subtle dark:text-revelio-dark-subtle">Riesgo ({form.risk_pct}%)</span><span className="font-bold text-revelio-blue">+{fmt(autoRiskAbs)}€</span></div>
                      <div className="flex justify-between text-xs border-t border-revelio-border dark:border-revelio-dark-border pt-1.5"><span className="font-semibold dark:text-revelio-dark-text">Venta calculada</span><span className="font-bold text-revelio-green text-sm">{fmt(autoVenta)}€</span></div>
                      <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">Venta = Coste / (1 - margen% - riesgo%)</p>
                    </div>
                  </div>
                )}
                {form.cost_profiles.length === 0 && <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">Añade perfiles para calcular presupuesto y venta automáticamente.</p>}
              </div>

              {/* Per-member: dedication (→ org_chart) + sell rate + hours */}
              {modal === 'edit' && projMembers.length > 0 && (
                <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                  <p className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Equipo asignado</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px]">
                      <thead><tr className="text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase">
                        <th className="text-left py-1 pr-1">Persona</th><th className="text-right px-1">%Ded.</th><th className="text-center px-1">Desde</th><th className="text-center px-1">Hasta</th><th className="text-right px-1">€/h venta</th><th className="text-right px-1">Horas plan.</th>
                      </tr></thead>
                      <tbody>{projMembers.map(m => {
                        const oe = orgEdits.find(o => o.member_id === m.id) || { member_id: m.id, sala: editRoom!.slug, dedication: 100, start_date: form.start_date, end_date: form.end_date }
                        const sr = form.member_sell_rates.find(s => s.member_id === m.id) || { member_id: m.id, sell_rate: 0, planned_hours: 0 }
                        const updOrg = (f: keyof OrgEntry, v: string | number) => {
                          const exists = orgEdits.find(o => o.member_id === m.id)
                          setOrgEdits(exists ? orgEdits.map(o => o.member_id === m.id ? { ...o, [f]: v } : o) : [...orgEdits, { ...oe, [f]: v }])
                        }
                        const updSR = (f: 'sell_rate' | 'planned_hours', v: number) => {
                          const exists = form.member_sell_rates.find(s => s.member_id === m.id)
                          const next = exists ? form.member_sell_rates.map(s => s.member_id === m.id ? { ...s, [f]: v } : s) : [...form.member_sell_rates, { ...sr, [f]: v }]
                          setForm({ ...form, member_sell_rates: next })
                        }
                        return (
                          <tr key={m.id} className="border-t border-revelio-border/30 dark:border-revelio-dark-border/30">
                            <td className="py-1.5 pr-1 dark:text-revelio-dark-text"><span style={{ color: m.color }}>{m.avatar || '·'}</span> {m.name.split(' ')[0]} <span className="text-[8px] text-revelio-subtle">{m.role_label}</span></td>
                            <td className="px-1"><input type="number" value={oe.dedication} onChange={e => updOrg('dedication', Number(e.target.value))} className="w-12 rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={0} max={100} step={5} /></td>
                            <td className="px-1"><input type="date" value={oe.start_date || ''} onChange={e => updOrg('start_date', e.target.value)} className="rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[9px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text w-[100px]" /></td>
                            <td className="px-1"><input type="date" value={oe.end_date || ''} onChange={e => updOrg('end_date', e.target.value)} className="rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[9px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text w-[100px]" /></td>
                            <td className="px-1"><input type="number" value={sr.sell_rate || ''} onChange={e => updSR('sell_rate', Number(e.target.value))} placeholder={String(form.sell_rate || 0)} className="w-14 rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" step={1} /></td>
                            <td className="px-1"><input type="number" value={sr.planned_hours || ''} onChange={e => updSR('planned_hours', Number(e.target.value))} className="w-14 rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></td>
                          </tr>
                        )
                      })}</tbody>
                    </table>
                  </div>
                  <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle mt-1">La dedicación se guarda en org_chart (la usan FTEs y Finanzas). €/h venta vacío = usa tarifa base del proyecto.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-sm font-medium text-revelio-subtle">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-[2] py-2 rounded-lg bg-revelio-text text-white text-sm font-medium disabled:opacity-40">{saving ? 'Guardando...' : modal === 'create' ? 'Crear' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="text-center mb-4"><Trash2 className="w-8 h-8 text-revelio-red mx-auto mb-2" /><h3 className="font-semibold dark:text-revelio-dark-text">Eliminar proyecto</h3><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mt-1">Escribe <strong className="text-revelio-red">{deleteTarget.name}</strong></p></div>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && deleteConfirm === deleteTarget.name && handleDelete()} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-red mb-3 dark:bg-revelio-dark-bg dark:text-revelio-dark-text" autoFocus />
            <div className="flex gap-2"><button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 rounded-lg border border-revelio-border text-sm font-medium text-revelio-subtle">Cancelar</button><button onClick={handleDelete} disabled={deleteConfirm !== deleteTarget.name} className="flex-1 py-2 rounded-lg bg-revelio-red text-white text-sm font-medium disabled:opacity-30">Eliminar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function L({ children }: { children: React.ReactNode }) { return <label className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase block mb-1">{children}</label> }
function Num({ val, set, step }: { val: number; set: (v: number) => void; step?: number }) { return <input type="number" value={val || ''} onChange={e => set(Number(e.target.value))} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" step={step || 1} /> }
function Sel({ val, set, opts }: { val: string; set: (v: string) => void; opts: string[][] }) { return <select value={val} onChange={e => set(e.target.value)} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text">{opts.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select> }
