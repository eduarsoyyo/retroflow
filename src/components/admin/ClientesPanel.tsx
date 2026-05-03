import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search, Building2 } from 'lucide-react'
import { fetchClientes, deleteCliente } from '@/data/clientes'
import { supabase } from '@/data/supabase'
import type { Cliente } from '@/types'
import { ClienteFormModal, ClienteDeleteModal } from './ClienteFormModal'

type EditingState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; cliente: Cliente }

export function ClientesPanel() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingState>({ mode: 'closed' })
  const [confirmDelete, setConfirmDelete] = useState<Cliente | null>(null)
  const [deleteInput, setDeleteInput] = useState('')
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Initial load: clientes + project counts grouped by cliente_id.
  useEffect(() => {
    const load = async () => {
      try {
        const [cs, roomsR] = await Promise.all([
          fetchClientes(),
          supabase.from('rooms').select('cliente_id'),
        ])
        setClientes(cs)
        const counts: Record<string, number> = {}
        ;(roomsR.data ?? []).forEach((r: { cliente_id: string | null }) => {
          if (r.cliente_id) counts[r.cliente_id] = (counts[r.cliente_id] ?? 0) + 1
        })
        setProjectCounts(counts)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clientes.filter(c => {
      if (!showInactive && c.status === 'inactive') return false
      if (!q) return true
      return (c.name ?? '').toLowerCase().includes(q) || (c.slug ?? '').toLowerCase().includes(q)
    })
  }, [clientes, search, showInactive])

  const handleSaved = (saved: Cliente) => {
    setClientes(prev => {
      const idx = prev.findIndex(c => c.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
    })
    setEditing({ mode: 'closed' })
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    if (deleteInput.trim() !== confirmDelete.name) return
    await deleteCliente(confirmDelete.id)
    setClientes(prev => prev.filter(c => c.id !== confirmDelete.id))
    setConfirmDelete(null)
    setDeleteInput('')
  }

  if (loading) {
    return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando clientes...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold dark:text-revelio-dark-text flex items-center gap-2">
            <Building2 className="w-4 h-4 text-revelio-blue" /> Clientes
          </h2>
          <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle mt-0.5">
            {clientes.filter(c => c.status !== 'inactive').length} activos · {clientes.filter(c => c.status === 'inactive').length} inactivos
          </p>
        </div>
        <button
          onClick={() => setEditing({ mode: 'create' })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-revelio-blue text-white text-xs font-semibold hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo cliente
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-revelio-subtle" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o slug..."
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text"
          />
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="accent-revelio-blue"
          />
          Mostrar inactivos
        </label>
      </div>

      {/* Table */}
      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-revelio-bg dark:bg-revelio-dark-border">
              {['Cliente', 'Slug', 'Estado', 'Proyectos', 'Contacto', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-revelio-subtle dark:text-revelio-dark-subtle text-[11px]">
                  {search ? 'Sin resultados' : 'No hay clientes. Crea el primero.'}
                </td>
              </tr>
            )}
            {filtered.map(c => {
              const count = projectCounts[c.id] ?? 0
              const inactive = c.status === 'inactive'
              return (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/admin/clientes/${c.slug}`)}
                  className="border-t border-revelio-border/50 dark:border-revelio-dark-border/50 hover:bg-revelio-bg/40 dark:hover:bg-revelio-dark-border/40 cursor-pointer"
                >
                  <td className="px-4 py-2.5 dark:text-revelio-dark-text">
                    <div className="flex items-center gap-2">
                      {c.logo_url ? (
                        <img src={c.logo_url} alt="" className="w-5 h-5 rounded object-contain" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-revelio-blue/10 flex items-center justify-center text-[9px] font-bold text-revelio-blue">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className={inactive ? 'line-through text-revelio-subtle' : 'font-medium'}>{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-revelio-subtle dark:text-revelio-dark-subtle font-mono text-[10px]">{c.slug}</td>
                  <td className="px-4 py-2.5">
                    {inactive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-revelio-subtle/10 text-revelio-subtle">Inactivo</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-revelio-green/10 text-revelio-green">Activo</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[11px] ${count > 0 ? 'font-semibold dark:text-revelio-dark-text' : 'text-revelio-subtle'}`}>{count}</span>
                  </td>
                  <td className="px-4 py-2.5 text-revelio-subtle dark:text-revelio-dark-subtle text-[10px]">
                    {c.contact_name || c.contact_email || <span className="text-revelio-subtle/60">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); setEditing({ mode: 'edit', cliente: c }) }}
                        className="p-1.5 rounded hover:bg-revelio-blue/10 text-revelio-blue"
                        title="Editar (rápido)"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(c); setDeleteInput('') }}
                        className="p-1.5 rounded hover:bg-revelio-red/10 text-revelio-red"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create / edit modal */}
      {editing.mode !== 'closed' && (
        <ClienteFormModal
          initial={editing.mode === 'edit' ? editing.cliente : null}
          existingSlugs={clientes.filter(c => editing.mode !== 'edit' || c.id !== editing.cliente.id).map(c => c.slug)}
          onClose={() => setEditing({ mode: 'closed' })}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <ClienteDeleteModal
          cliente={confirmDelete}
          projectCount={projectCounts[confirmDelete.id] ?? 0}
          deleteInput={deleteInput}
          setDeleteInput={setDeleteInput}
          onCancel={() => { setConfirmDelete(null); setDeleteInput('') }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

