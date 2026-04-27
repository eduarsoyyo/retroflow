import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/data/supabase'
import type { Member } from '@/types'
import { Plus, Edit, Trash2, Search, DollarSign, X, ChevronDown, ChevronRight, Upload, Download } from 'lucide-react'
import { soundCreate, soundDelete } from '@/lib/sounds'

const uid = () => crypto.randomUUID()
const AVATARS = [
  '👤','🧙','🧙‍♀️','🦁','🐍','🦅','🦡','⚡','🌟','🔮','🏰','📚','🧪','🦋','🐉','🎯','🛡️','🌊','🔥','🌿',
  '💎','🦊','🐺','🦉','🐝','🐙','🦄','🐧','🐻','🐬','🦈','🐢','🦇','🌸','🍀','🌙','☀️','🌈','🎲','🎭',
  '🚀','🎸','🎨','🏆','🎪','🧬','🔬','💻','🎮','🎧','📱','🛸','🌍','🗡️','🏹','🧲','🔑','🗝️','🎩','👑',
]
const COLORS = [
  '#007AFF','#5856D6','#AF52DE','#FF2D55','#FF3B30','#FF9500','#FFCC00','#34C759',
  '#00C7BE','#30B0C7','#5AC8FA','#8E8E93','#1D1D1F','#636366','#48484A','#D1D1D6',
  '#0A84FF','#BF5AF2','#FF6482','#FF375F','#FFD60A','#32D74B','#64D2FF','#AC8E68',
]

interface CostRate { from: string; to?: string; rate: number }
interface ProjectAssign { slug: string; dedication: number; from: string; to: string }
interface OrgRow { id?: string; member_id: string; sala: string; dedication: number; start_date: string; end_date: string }

interface UserForm {
  name: string; username: string; password: string; email: string
  company: string; role_label: string; avatar: string; color: string
  is_superuser: boolean; calendario_id: string
  cost_rates: CostRate[]; hire_date: string; contract_type: string; convenio: string
  projects: ProjectAssign[]; responsable_id: string; vacation_carryover: number
}
const emptyForm: UserForm = { name: '', username: '', password: '', email: '', company: 'ALTEN', role_label: '', avatar: '👤', color: '#007AFF', is_superuser: false, calendario_id: '', cost_rates: [], hire_date: '', contract_type: 'indefinido', convenio: '', projects: [], responsable_id: '', vacation_carryover: 0 }

function getCurrentRate(rates: CostRate[]): number {
  if (!rates || rates.length === 0) return 0
  const now = new Date().toISOString().slice(0, 7)
  const sorted = [...rates].sort((a, b) => b.from.localeCompare(a.from))
  return (sorted.find(r => r.from <= now && (!r.to || r.to >= now)) || sorted[0])?.rate || 0
}

export function UsersPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [rooms, setRooms] = useState<Array<{ slug: string; name: string }>>([])
  const [roles, setRoles] = useState<string[]>([])
  const [calendarios, setCalendarios] = useState<Array<{ id: string; name: string }>>([])
  const [orgChart, setOrgChart] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [form, setForm] = useState<UserForm>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'general' | 'costes' | 'contrato'>('general')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const rx = (m: Member) => m as unknown as Record<string, unknown>

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const headers = ['nombre*', 'email*', 'usuario', 'contraseña', 'empresa', 'rol', 'contrato', 'fecha_alta', 'coste_hora', 'calendario', 'responsable_email', 'vacaciones_pendientes', 'telefono']
    const example1 = ['Juan Pérez', 'juan.perez@empresa.com', 'jperez', 'revelio2026', 'ALTEN', 'Consultor', 'indefinido', '2024-01-15', '25', 'Madrid 2026', 'jefe@empresa.com', '3', '666123456']
    const example2 = ['María García', 'maria.garcia@empresa.com', 'mgarcia', 'revelio2026', 'ALTEN', 'Service Manager', 'temporal', '2023-06-01', '35', 'Sevilla 2026', '', '0', '']
    const ws = XLSX.utils.aoa_to_sheet([headers, example1, example2])
    ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 12 }]
    // Color required headers yellow
    const reqCols = [0, 1] // nombre, email
    for (const c of reqCols) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]
      if (cell) cell.s = { fill: { fgColor: { rgb: 'FFCC00' } }, font: { bold: true } }
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios')
    // Add instructions sheet
    const instr = XLSX.utils.aoa_to_sheet([
      ['Campo', 'Obligatorio', 'Descripción', 'Valores posibles'],
      ['nombre*', 'SÍ', 'Nombre completo', ''],
      ['email*', 'SÍ', 'Email corporativo (se usa para login)', ''],
      ['usuario', 'No', 'Username (si vacío, se genera del email)', ''],
      ['contraseña', 'No', 'Contraseña inicial (default: revelio2026)', ''],
      ['empresa', 'No', 'Nombre de la empresa (default: ALTEN)', ''],
      ['rol', 'No', 'Rol del usuario', 'Consultor, Service Manager, PMO, Jefe de Proyecto...'],
      ['contrato', 'No', 'Tipo de contrato', 'indefinido, temporal, practicas, becario, externo'],
      ['fecha_alta', 'No', 'Fecha de alta formato YYYY-MM-DD', '2024-01-15'],
      ['coste_hora', 'No', 'Coste empresa €/hora', '25'],
      ['calendario', 'No', 'Nombre del calendario/convenio', 'Madrid 2026, Sevilla 2026...'],
      ['responsable_email', 'No', 'Email del responsable directo', 'jefe@empresa.com'],
      ['vacaciones_pendientes', 'No', 'Días de vacaciones del año anterior', '3'],
      ['telefono', 'No', 'Teléfono de contacto', '666123456'],
    ])
    instr['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 40 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, instr, 'Instrucciones')
    XLSX.writeFile(wb, 'plantilla_usuarios_revelio.xlsx')
  }

  const handleImportExcel = async (file: File) => {
    setImporting(true); setImportResult(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]!]
      if (!ws) throw new Error('Hoja vacía')
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

      let created = 0; let errors: string[] = []
      for (const row of rows) {
        const name = String(row['nombre'] || row['Nombre'] || row['name'] || '').trim()
        if (!name) continue
        const email = String(row['email'] || row['Email'] || row['correo'] || '').trim()
        const username = String(row['usuario'] || row['username'] || row['Username'] || email.split('@')[0] || name.toLowerCase().replace(/\s+/g, '.')).trim()
        const password = String(row['contraseña'] || row['password'] || 'revelio2026')
        const company = String(row['empresa'] || row['Empresa'] || 'ALTEN')
        const role = String(row['rol'] || row['Rol'] || row['role'] || '')
        const contractType = String(row['contrato'] || row['Contrato'] || 'indefinido')
        const hireDate = String(row['fecha_alta'] || row['Fecha alta'] || '')
        const costHour = Number(row['coste_hora'] || row['Coste hora'] || 0)
        const calName = String(row['calendario'] || row['Calendario'] || '')
        const respEmail = String(row['responsable_email'] || row['Responsable email'] || '')
        const vacCarryover = Number(row['vacaciones_pendientes'] || row['Vacaciones pendientes'] || 0)
        const phone = String(row['telefono'] || row['Telefono'] || '')

        // Resolve calendario_id by name
        let calId: string | null = null
        if (calName) { const cal = calendarios.find(c => c.name.toLowerCase() === calName.toLowerCase()); if (cal) calId = cal.id }

        // Resolve responsable_id by email
        let respId: string | null = null
        if (respEmail) { const resp = members.find(m => (m as unknown as Record<string, unknown>).email === respEmail); if (resp) respId = resp.id }

        // Cost rates
        const costRates = costHour > 0 ? [{ from: hireDate || new Date().toISOString().slice(0, 10), rate: costHour }] : []

        const id = crypto.randomUUID()
        const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)] || '👤'
        const color = COLORS[Math.floor(Math.random() * COLORS.length)] || '#007AFF'

        // Insert in team_members
        const { error: tmErr } = await supabase.from('team_members').insert({
          id, name, username, email, avatar, color, company,
          role_label: role, contract_type: contractType,
          hire_date: hireDate || null, is_superuser: false,
          rooms: [], cost_rates: costRates, preferences: {},
          calendario_id: calId, responsable_id: respId,
          vacation_carryover: vacCarryover, phone: phone || null,
        })
        if (tmErr) { errors.push(`${name}: ${tmErr.message}`); continue }

        // Create auth user
        if (email) {
          const { error: authErr } = await supabase.rpc('create_auth_user', { user_email: email, user_password: password, user_id: id })
          if (authErr) errors.push(`${name} auth: ${authErr.message}`)
        }
        created++
      }

      setImportResult(`${created} usuarios creados${errors.length > 0 ? `. Errores: ${errors.join('; ')}` : ''}`)
      // Reload
      const { data } = await supabase.from('team_members').select('*').order('name')
      if (data) setMembers(data)
    } catch (e) {
      setImportResult(`Error: ${(e as Error).message}`)
    }
    setImporting(false)
  }

  useEffect(() => {
    Promise.all([
      supabase.from('team_members').select('*').order('name'),
      supabase.from('rooms').select('slug, name').order('name'),
      supabase.from('calendarios').select('id, name').order('name'),
      supabase.from('org_chart').select('*'),
    ]).then(([mR, rR, cR, oR]) => {
      if (mR.data) setMembers(mR.data)
      if (rR.data) setRooms(rR.data)
      if (cR.data) setCalendarios(cR.data)
      if (oR.data) setOrgChart(oR.data as OrgRow[])
      setLoading(false)
    })
    // Load roles separately — try admin_roles, fallback to roles table
    supabase.from('admin_roles').select('*').order('name').then(({ data, error }) => {
      if (data && data.length > 0) { setRoles(data.map((r: Record<string, unknown>) => String(r.name || r.label || '')).filter(Boolean)); return }
      console.log('[revelio] admin_roles:', error?.message || 'empty', '→ trying roles table')
      supabase.from('roles').select('*').order('label').then(({ data: r2 }) => {
        if (r2 && r2.length > 0) setRoles(r2.map((r: Record<string, unknown>) => String(r.label || r.name || '')).filter(Boolean))
      })
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return members.filter(m => m.name.toLowerCase().includes(q) || (m.username || '').toLowerCase().includes(q) || (m.role_label || '').toLowerCase().includes(q))
  }, [members, search])

  const openCreate = () => { setForm({ ...emptyForm }); setEditMember(null); setTab('general'); setSaveError(''); setModal('create') }
  const openEdit = (m: Member) => {
    const crRaw = rx(m).cost_rates; const costRates: CostRate[] = Array.isArray(crRaw) ? crRaw as CostRate[] : []
    // Load project assignments from org_chart
    const myOrg = orgChart.filter(o => o.member_id === m.id)
    const projects: ProjectAssign[] = (m.rooms || []).map(slug => {
      const org = myOrg.find(o => o.sala === slug)
      return { slug, dedication: org ? Math.round(org.dedication * 100) : 100, from: org?.start_date || '', to: org?.end_date || '' }
    })
    setForm({ name: m.name, username: m.username || '', password: '', email: (rx(m).email as string) || '', company: (rx(m).company as string) || 'ALTEN', role_label: m.role_label || '', avatar: m.avatar || '👤', color: m.color || '#007AFF', is_superuser: m.is_superuser || false, calendario_id: (rx(m).calendario_id as string) || '', cost_rates: costRates, hire_date: (rx(m).hire_date as string) || '', contract_type: (rx(m).contract_type as string) || 'indefinido', convenio: (rx(m).convenio as string) || '', projects, responsable_id: (rx(m).responsable_id as string) || '', vacation_carryover: Number(rx(m).vacation_carryover) || 0 })
    setEditMember(m); setTab('general'); setSaveError(''); setModal('edit')
  }

  const toggleProject = (slug: string) => {
    const has = form.projects.find(p => p.slug === slug)
    if (has) setForm({ ...form, projects: form.projects.filter(p => p.slug !== slug) })
    else setForm({ ...form, projects: [...form.projects, { slug, dedication: 100, from: '', to: '' }] })
  }
  const updProject = (slug: string, field: keyof ProjectAssign, val: string | number) => {
    setForm({ ...form, projects: form.projects.map(p => p.slug === slug ? { ...p, [field]: val } : p) })
  }

  const handleSave = async () => {
    setSaving(true); setSaveError('')
    const roomSlugs = form.projects.map(p => p.slug)
    const payload: Record<string, unknown> = {
      name: form.name, username: form.username, email: form.email, company: form.company,
      role_label: form.role_label, avatar: form.avatar, color: form.color,
      rooms: roomSlugs, is_superuser: form.is_superuser,
      calendario_id: form.calendario_id || null,
      cost_rates: form.cost_rates, cost_rate: getCurrentRate(form.cost_rates),
      hire_date: form.hire_date || null, contract_type: form.contract_type, convenio: form.convenio || null,
      responsable_id: form.responsable_id || null, vacation_carryover: form.vacation_carryover || 0,
    }

    let memberId = editMember?.id || ''

    if (modal === 'create') {
      memberId = uid()
      const { data, error } = await supabase.from('team_members').insert({ id: memberId, ...payload }).select().single()
      if (error) { setSaveError(error.message); setSaving(false); return }
      if (data) { setMembers(prev => [...prev, data]); soundCreate() }
      if (form.email && form.password) void supabase.rpc('create_auth_user', { user_email: form.email, user_password: form.password, user_id: memberId })
    } else if (editMember) {
      const { data, error } = await supabase.from('team_members').update(payload).eq('id', editMember.id).select().single()
      if (error) { setSaveError(error.message); setSaving(false); return }
      if (data) { setMembers(prev => prev.map(m => m.id === editMember.id ? data : m)); soundCreate() }
      if (form.password) void supabase.rpc('update_auth_password', { target_user_id: editMember.id, new_password: form.password })
      if (form.email && form.email !== (rx(editMember).email as string)) void supabase.rpc('update_auth_email', { target_user_id: editMember.id, new_email: form.email })
    }

    // Save org_chart entries
    for (const pa of form.projects) {
      const existing = orgChart.find(o => o.member_id === memberId && o.sala === pa.slug)
      const dedDecimal = pa.dedication / 100
      if (existing?.id) {
        await supabase.from('org_chart').update({ dedication: dedDecimal, start_date: pa.from || null, end_date: pa.to || null }).eq('id', existing.id)
      } else {
        await supabase.from('org_chart').insert({ member_id: memberId, sala: pa.slug, dedication: dedDecimal, start_date: pa.from || null, end_date: pa.to || null })
      }
    }
    // Remove org_chart entries for deselected projects
    const oldSlugs = (editMember?.rooms || []).filter(s => !roomSlugs.includes(s))
    for (const s of oldSlugs) {
      await supabase.from('org_chart').delete().eq('member_id', memberId).eq('sala', s)
    }
    // Refresh org_chart
    const { data: newOrg } = await supabase.from('org_chart').select('*')
    if (newOrg) setOrgChart(newOrg as OrgRow[])

    setSaving(false); setModal(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return
    await supabase.from('team_members').delete().eq('id', deleteTarget.id)
    await supabase.from('org_chart').delete().eq('member_id', deleteTarget.id)
    void supabase.rpc('delete_auth_user', { target_user_id: deleteTarget.id })
    setMembers(prev => prev.filter(m => m.id !== deleteTarget.id)); setDeleteTarget(null); setDeleteConfirm(''); soundDelete()
  }

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div><h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text">Equipo</h2><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{members.length} personas</p></div>
        <div className="flex gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-revelio-subtle" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 pr-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs outline-none w-40 dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
          <button onClick={downloadTemplate} className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle flex items-center gap-1 hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Download className="w-3.5 h-3.5" /> Plantilla</button>
          <label className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle flex items-center gap-1 cursor-pointer hover:bg-revelio-bg dark:hover:bg-revelio-dark-border">
            <Upload className="w-3.5 h-3.5" /> {importing ? 'Importando...' : 'Importar Excel'}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImportExcel(f); e.target.value = '' }} disabled={importing} />
          </label>
          <button onClick={openCreate} className="px-3 py-1.5 rounded-lg bg-revelio-text text-white text-xs font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nueva persona</button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`rounded-lg px-4 py-2 mb-3 text-xs font-medium ${importResult.includes('Error') ? 'bg-revelio-red/10 text-revelio-red' : 'bg-revelio-green/10 text-revelio-green'}`}>
          {importResult}
          <button onClick={() => setImportResult(null)} className="ml-2 text-revelio-subtle hover:underline">Cerrar</button>
        </div>
      )}

      {/* List */}
      <div className="space-y-1.5">
        {filtered.map(m => {
          const expanded = expandedId === m.id
          const crRaw = rx(m).cost_rates; const cr: CostRate[] = Array.isArray(crRaw) ? crRaw as CostRate[] : []
          const cost = getCurrentRate(cr)
          const calName = calendarios.find(c => c.id === (rx(m).calendario_id as string))?.name
          const myOrg = orgChart.filter(o => o.member_id === m.id)
          return (
            <div key={m.id} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-revelio-bg/30 dark:hover:bg-revelio-dark-border/30" onClick={() => setExpandedId(expanded ? null : m.id)}>
                <span className="text-lg w-8 text-center" style={{ color: m.color || '#007AFF' }}>{m.avatar || '👤'}</span>
                <div className="flex-1 min-w-0"><p className="text-xs font-semibold dark:text-revelio-dark-text">{m.name}</p><p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{m.role_label || 'Sin rol'} · {(m.rooms || []).length} proy. {calName ? `· ${calName}` : ''}</p></div>
                {cost > 0 && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle flex items-center gap-0.5"><DollarSign className="w-2.5 h-2.5" />{cost}€/h</span>}
                {m.is_superuser && <span className="text-[7px] font-bold text-revelio-violet bg-revelio-violet/10 px-1.5 py-0.5 rounded">ADMIN</span>}
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(m)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Edit className="w-3 h-3 text-revelio-blue" /></button>
                  <button onClick={() => { setDeleteTarget(m); setDeleteConfirm('') }} className="w-6 h-6 rounded border border-revelio-red/20 flex items-center justify-center hover:bg-revelio-red/5"><Trash2 className="w-3 h-3 text-revelio-red" /></button>
                </div>
                {expanded ? <ChevronDown className="w-3 h-3 text-revelio-subtle" /> : <ChevronRight className="w-3 h-3 text-revelio-subtle" />}
              </div>
              {expanded && (
                <div className="px-4 py-3 border-t border-revelio-border/50 dark:border-revelio-dark-border/50 bg-revelio-bg/20 dark:bg-revelio-dark-border/10 text-[9px]">
                  <div className="grid sm:grid-cols-3 gap-2">
                    <R l="Email" v={(rx(m).email as string) || '—'} /><R l="Empresa" v={(rx(m).company as string) || '—'} /><R l="Alta" v={(rx(m).hire_date as string) || '—'} />
                    <R l="Contrato" v={(rx(m).contract_type as string) || '—'} /><R l="Calendario" v={calName || '—'} />
                  </div>
                  {myOrg.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-revelio-border/30 dark:border-revelio-dark-border/30">
                      <p className="text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1">Proyectos</p>
                      {myOrg.map(o => {
                        const rName = rooms.find(r => r.slug === o.sala)?.name || o.sala
                        return <div key={o.sala} className="dark:text-revelio-dark-text"><span className="font-bold text-revelio-blue">{rName}</span> — {Math.round((o.dedication || 0) * 100)}% {o.start_date ? `(${o.start_date}` : ''}{o.end_date ? ` → ${o.end_date})` : o.start_date ? ' → actual)' : ''}</div>
                      })}
                    </div>
                  )}
                  {cr.length > 0 && <div className="mt-2 pt-2 border-t border-revelio-border/30 dark:border-revelio-dark-border/30"><p className="text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1">Historial coste</p>{cr.map((c, i) => <span key={i} className="mr-3 dark:text-revelio-dark-text"><span className="font-bold">{c.rate}€/h</span> {c.from}{c.to ? ` → ${c.to}` : ' → actual'}</span>)}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ═══ MODAL ═══ */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-3 dark:text-revelio-dark-text">{modal === 'create' ? 'Nueva persona' : `Editar: ${form.name}`}</h3>
            <div className="flex gap-0.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden mb-4">
              {(['general', 'costes', 'contrato'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`flex-1 py-1.5 text-[10px] font-semibold ${tab === t ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{t === 'general' ? 'General' : t === 'costes' ? 'Costes' : 'Contrato'}</button>)}
            </div>

            {tab === 'general' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3"><div><L>Nombre *</L><I value={form.name} onChange={v => setForm({ ...form, name: v })} /></div><div><L>Username</L><I value={form.username} onChange={v => setForm({ ...form, username: v })} /></div></div>
                <div className="grid grid-cols-2 gap-3"><div><L>Email</L><I value={form.email} onChange={v => setForm({ ...form, email: v })} /></div><div><L>Contraseña</L><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" placeholder={modal === 'edit' ? 'vacío = mantener' : ''} /></div></div>
                <div><L>Rol</L><select value={form.role_label} onChange={e => setForm({ ...form, role_label: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="">Sin rol</option>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select>{roles.length === 0 && <p className="text-[8px] text-revelio-orange mt-0.5">No hay roles. Créalos en CdC → Roles.</p>}</div>

                {/* Avatar */}
                <div><L>Avatar</L><div className="flex gap-0.5 flex-wrap max-h-[100px] overflow-y-auto rounded-lg border border-revelio-border/30 dark:border-revelio-dark-border/30 p-1.5">{AVATARS.map(a => <button key={a} onClick={() => setForm({ ...form, avatar: a })} className={`w-7 h-7 rounded text-sm flex items-center justify-center ${form.avatar === a ? 'ring-2 ring-revelio-blue bg-revelio-blue/10' : 'hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}>{a}</button>)}</div></div>
                <div><L>Color</L><div className="flex gap-1 flex-wrap">{COLORS.map(c => <button key={c} onClick={() => setForm({ ...form, color: c })} className={`w-6 h-6 rounded-full ${form.color === c ? 'ring-2 ring-offset-1 ring-revelio-text dark:ring-revelio-dark-text' : ''}`} style={{ background: c }} />)}</div><div className="mt-1.5 text-2xl w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: form.color + '20', color: form.color }}>{form.avatar}</div></div>

                {/* Projects with dedication + dates */}
                <div>
                  <L>Proyectos asignados</L>
                  <div className="flex gap-1 flex-wrap mb-2">
                    {rooms.map(r => {
                      const active = form.projects.some(p => p.slug === r.slug)
                      return <button key={r.slug} onClick={() => toggleProject(r.slug)} className={`px-2 py-0.5 rounded text-[9px] font-semibold ${active ? 'bg-revelio-blue text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{r.name}</button>
                    })}
                  </div>
                  {form.projects.length > 0 && (
                    <div className="space-y-1.5">
                      {form.projects.map(pa => {
                        const rName = rooms.find(r => r.slug === pa.slug)?.name || pa.slug
                        return (
                          <div key={pa.slug} className="rounded-lg bg-revelio-bg dark:bg-revelio-dark-border px-3 py-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-semibold text-revelio-blue">{rName}</span>
                              <button onClick={() => toggleProject(pa.slug)} className="text-revelio-subtle hover:text-revelio-red"><X className="w-3 h-3" /></button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div><label className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">Dedicación %</label><input type="number" value={pa.dedication} onChange={e => updProject(pa.slug, 'dedication', Number(e.target.value))} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={0} max={100} step={5} /></div>
                              <div><label className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">Desde</label><input type="date" value={pa.from} onChange={e => updProject(pa.slug, 'from', e.target.value)} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                              <div><label className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">Hasta</label><input type="date" value={pa.to} onChange={e => updProject(pa.slug, 'to', e.target.value)} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_superuser} onChange={e => setForm({ ...form, is_superuser: e.target.checked })} className="w-4 h-4 accent-revelio-violet rounded" /><span className="text-xs dark:text-revelio-dark-text">Superusuario (admin)</span></label>
              </div>
            )}

            {tab === 'costes' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2"><L>Coste empresa (€/hora) con fechas</L><button onClick={() => setForm({ ...form, cost_rates: [...form.cost_rates, { from: new Date().toISOString().slice(0, 7), rate: 0 }] })} className="text-[9px] text-revelio-blue font-medium flex items-center gap-0.5"><Plus className="w-3 h-3" /> Periodo</button></div>
                  <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle mb-2">Cuando hay subida salarial, añade un nuevo periodo.</p>
                  {form.cost_rates.length === 0 && <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle bg-revelio-bg dark:bg-revelio-dark-border rounded-lg px-3 py-2">Sin costes definidos.</p>}
                  {form.cost_rates.map((cr, i) => (
                    <div key={i} className="flex gap-2 items-center mb-2 bg-revelio-bg dark:bg-revelio-dark-border rounded-lg px-3 py-2">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <div><label className="text-[8px] text-revelio-subtle">Desde</label><input type="month" value={cr.from} onChange={e => { const n = [...form.cost_rates]; n[i] = { ...n[i]!, from: e.target.value }; setForm({ ...form, cost_rates: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                        <div><label className="text-[8px] text-revelio-subtle">Hasta</label><input type="month" value={cr.to || ''} onChange={e => { const n = [...form.cost_rates]; n[i] = { ...n[i]!, to: e.target.value || undefined }; setForm({ ...form, cost_rates: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" placeholder="actual" /></div>
                        <div><label className="text-[8px] text-revelio-subtle">€/hora</label><input type="number" value={cr.rate || ''} onChange={e => { const n = [...form.cost_rates]; n[i] = { ...n[i]!, rate: Number(e.target.value) }; setForm({ ...form, cost_rates: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text text-right font-bold" step={0.5} /></div>
                      </div>
                      <button onClick={() => setForm({ ...form, cost_rates: form.cost_rates.filter((_, j) => j !== i) })} className="text-revelio-subtle hover:text-revelio-red"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {form.cost_rates.length > 0 && <div className="bg-revelio-green/5 border border-revelio-green/20 rounded-lg px-3 py-2"><p className="text-[9px] font-semibold dark:text-revelio-dark-text flex items-center gap-1"><DollarSign className="w-3 h-3 text-revelio-green" /> Coste actual: <span className="text-revelio-green font-bold">{getCurrentRate(form.cost_rates)}€/h</span></p></div>}
                </div>
              </div>
            )}

            {tab === 'contrato' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><L>Fecha de alta</L><input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                  <div><L>Empresa</L><I value={form.company} onChange={v => setForm({ ...form, company: v })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><L>Tipo contrato</L><select value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="indefinido">Indefinido</option><option value="temporal">Temporal</option><option value="practicas">Prácticas</option><option value="becario">Becario</option><option value="externo">Externo</option></select></div>
                  <div><L>Calendario / Convenio</L><select value={form.calendario_id} onChange={e => setForm({ ...form, calendario_id: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="">Sin calendario</option>{calendarios.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><L>Responsable</L><select value={form.responsable_id} onChange={e => setForm({ ...form, responsable_id: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="">Sin responsable</option>{members.filter(m => m.is_superuser || m.role_label?.toLowerCase().includes('manager')).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                  <div><L>Vacaciones pendientes año anterior</L><input type="number" value={form.vacation_carryover || 0} onChange={e => setForm({ ...form, vacation_carryover: Number(e.target.value) })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={0} /><p className="text-[8px] text-revelio-subtle mt-0.5">Días no disfrutados del año anterior. Se suman al total disponible.</p></div>
                </div>
              </div>
            )}

            {saveError && <div className="mt-2 bg-revelio-red/10 border border-revelio-red/20 rounded-lg px-3 py-2 text-[10px] text-revelio-red">{saveError}</div>}
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
            <div className="text-center mb-4"><Trash2 className="w-8 h-8 text-revelio-red mx-auto mb-2" /><h3 className="font-semibold dark:text-revelio-dark-text">Eliminar persona</h3><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mt-1">Escribe <strong className="text-revelio-red">{deleteTarget.name}</strong></p></div>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && deleteConfirm === deleteTarget.name && handleDelete()} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-red mb-3 dark:bg-revelio-dark-bg dark:text-revelio-dark-text" autoFocus />
            <div className="flex gap-2"><button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 rounded-lg border border-revelio-border text-sm font-medium text-revelio-subtle">Cancelar</button><button onClick={handleDelete} disabled={deleteConfirm !== deleteTarget.name} className="flex-1 py-2 rounded-lg bg-revelio-red text-white text-sm font-medium disabled:opacity-30">Eliminar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function L({ children }: { children: React.ReactNode }) { return <label className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase block mb-1">{children}</label> }
function I({ value, onChange }: { value: string; onChange: (v: string) => void }) { return <input value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /> }
function R({ l, v }: { l: string; v: string }) { return <div><span className="font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase">{l}:</span> <span className="dark:text-revelio-dark-text">{v}</span></div> }
