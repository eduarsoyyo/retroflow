import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, X, Search, Building2, AlertTriangle } from 'lucide-react'
import { fetchClientes, createCliente, updateCliente, deleteCliente } from '@/data/clientes'
import { supabase } from '@/data/supabase'
import type { Cliente } from '@/types'

type EditingState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; cliente: Cliente }

// Slugify a name into a URL-safe slug: lowercase, no accents, only [a-z0-9-].
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function ClientesPanel() {
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
                <tr key={c.id} className="border-t border-revelio-border/50 dark:border-revelio-dark-border/50 hover:bg-revelio-bg/40 dark:hover:bg-revelio-dark-border/40">
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
                        onClick={() => setEditing({ mode: 'edit', cliente: c })}
                        className="p-1.5 rounded hover:bg-revelio-blue/10 text-revelio-blue"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setConfirmDelete(c); setDeleteInput('') }}
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
        <DeleteModal
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

// ───────────────────────────────────────────────────────────────────────────
// Create / edit form modal
// ───────────────────────────────────────────────────────────────────────────

interface ClienteFormModalProps {
  initial: Cliente | null
  existingSlugs: string[]
  onClose: () => void
  onSaved: (cliente: Cliente) => void
}

function ClienteFormModal({ initial, existingSlugs, onClose, onSaved }: ClienteFormModalProps) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(isEdit) // don't autofill if editing
  const [status, setStatus] = useState<'active' | 'inactive'>((initial?.status as 'active' | 'inactive') ?? 'active')
  const [contactName, setContactName] = useState(initial?.contact_name ?? '')
  const [contactEmail, setContactEmail] = useState(initial?.contact_email ?? '')
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-slug from name when slug hasn't been manually edited
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  // Keyboard: Escape to cancel, Enter outside textarea to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const trimmedName = name.trim()
  const trimmedSlug = slug.trim()
  const slugPattern = /^[a-z0-9-]+$/
  const slugValid = slugPattern.test(trimmedSlug)
  const slugUnique = !existingSlugs.includes(trimmedSlug)
  const emailValid = !contactEmail.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim())
  const canSave = trimmedName.length > 0 && trimmedSlug.length > 0 && slugValid && slugUnique && emailValid && !saving

  const handleSubmit = async () => {
    if (!canSave) return
    setSaving(true); setError(null)
    try {
      const payload = {
        name: trimmedName,
        slug: trimmedSlug,
        status,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        logo_url: logoUrl.trim() || null,
        notes: notes.trim() || null,
      }
      if (isEdit && initial) {
        await updateCliente(initial.id, payload)
        onSaved({ ...initial, ...payload })
      } else {
        const created = await createCliente(payload)
        onSaved(created)
      }
    } catch (e) {
      setError((e as Error).message || 'Error guardando el cliente')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-revelio-border dark:border-revelio-dark-border">
          <h3 className="text-sm font-semibold dark:text-revelio-dark-text">{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-revelio-bg dark:hover:bg-revelio-dark-border">
            <X className="w-4 h-4 text-revelio-subtle" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Name */}
          <div>
            <label className="text-[10px] font-semibold uppercase text-revelio-subtle dark:text-revelio-dark-subtle">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text"
              placeholder="ej. Volkswagen Financial Services"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="text-[10px] font-semibold uppercase text-revelio-subtle dark:text-revelio-dark-subtle">Slug (URL) *</label>
            <input
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugTouched(true) }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              className={`mt-1 w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text ${trimmedSlug && (!slugValid || !slugUnique) ? 'border-revelio-red' : 'border-revelio-border dark:border-revelio-dark-border'}`}
              placeholder="vwfs"
            />
            <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle mt-1">
              {trimmedSlug && !slugValid && <span className="text-revelio-red">Solo minúsculas, números y guiones</span>}
              {trimmedSlug && slugValid && !slugUnique && <span className="text-revelio-red">Este slug ya existe</span>}
              {(!trimmedSlug || (slugValid && slugUnique)) && 'Solo minúsculas, números y guiones'}
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-semibold uppercase text-revelio-subtle dark:text-revelio-dark-subtle">Estado</label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border ${status === 'active' ? 'bg-revelio-green/10 border-revelio-green text-revelio-green' : 'border-revelio-border dark:border-revelio-dark-border text-revelio-subtle hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}
              >
                Activo
              </button>
              <button
                type="button"
                onClick={() => setStatus('inactive')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border ${status === 'inactive' ? 'bg-revelio-subtle/10 border-revelio-subtle text-revelio-subtle' : 'border-revelio-border dark:border-revelio-dark-border text-revelio-subtle hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}
              >
                Inactivo
              </button>
            </div>
          </div>

          {/* Contact name + email side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase text-revelio-subtle dark:text-revelio-dark-subtle">Persona contacto</label>
              <input
                type="text"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text"
                placeholder="Nombre y apellido"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase text-revelio-subtle dark:text-revelio-dark-subtle">Email contacto</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                className={`mt-1 w-full px-3 py-2 rounded-lg border text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text ${contactEmail.trim() && !emailValid ? 'border-revelio-red' : 'border-revelio-border dark:border-revelio-dark-border'}`}
                placeholder="email@cliente.com"
              />
              {contactEmail.trim() && !emailValid && <p className="text-[10px] text-revelio-red mt-1">Email no válido</p>}
            </div>
          </div>

          {/* Logo URL */}
          <div>
            <label className="text-[10px] font-semibold uppercase text-revelio-subtle dark:text-revelio-dark-subtle">Logo URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text"
              placeholder="https://..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-semibold uppercase text-revelio-subtle dark:text-revelio-dark-subtle">Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text resize-none"
              placeholder="Notas internas (opcional)"
            />
          </div>

          {error && (
            <div className="text-[11px] text-revelio-red bg-revelio-red/5 px-3 py-2 rounded-lg">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-revelio-border dark:border-revelio-dark-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle hover:bg-revelio-bg dark:hover:bg-revelio-dark-border">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSave}
            className="px-4 py-2 rounded-lg bg-revelio-blue text-white text-xs font-semibold disabled:opacity-50 hover:opacity-90"
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Delete confirmation modal (safe-delete: type the name to confirm)
// ───────────────────────────────────────────────────────────────────────────

interface DeleteModalProps {
  cliente: Cliente
  projectCount: number
  deleteInput: string
  setDeleteInput: (s: string) => void
  onCancel: () => void
  onConfirm: () => void
}

function DeleteModal({ cliente, projectCount, deleteInput, setDeleteInput, onCancel, onConfirm }: DeleteModalProps) {
  // Block deletion if the cliente has projects assigned.
  const blocked = projectCount > 0
  const canDelete = !blocked && deleteInput.trim() === cliente.name

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      if (e.key === 'Enter' && canDelete) { e.preventDefault(); onConfirm() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canDelete, onCancel, onConfirm])

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-revelio-border dark:border-revelio-dark-border">
          <h3 className="text-sm font-semibold dark:text-revelio-dark-text flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-revelio-red" /> Eliminar cliente
          </h3>
          <button onClick={onCancel} className="p-1 rounded hover:bg-revelio-bg dark:hover:bg-revelio-dark-border">
            <X className="w-4 h-4 text-revelio-subtle" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {blocked ? (
            <>
              <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">
                <strong className="dark:text-revelio-dark-text">{cliente.name}</strong> tiene <strong className="text-revelio-orange">{projectCount} proyecto{projectCount === 1 ? '' : 's'}</strong> asignado{projectCount === 1 ? '' : 's'}.
              </p>
              <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">
                Reasigna o elimina sus proyectos antes de borrar el cliente. Como alternativa, márcalo como <strong>Inactivo</strong> desde editar.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">
                Esta acción no se puede deshacer. Para confirmar, escribe el nombre exacto del cliente:
              </p>
              <p className="text-xs font-semibold dark:text-revelio-dark-text bg-revelio-bg dark:bg-revelio-dark-border px-3 py-2 rounded-lg">{cliente.name}</p>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                autoFocus
                placeholder={cliente.name}
                className="w-full px-3 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text"
              />
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-revelio-border dark:border-revelio-dark-border">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle hover:bg-revelio-bg dark:hover:bg-revelio-dark-border">
            {blocked ? 'Cerrar' : 'Cancelar'}
          </button>
          {!blocked && (
            <button
              onClick={onConfirm}
              disabled={!canDelete}
              className="px-4 py-2 rounded-lg bg-revelio-red text-white text-xs font-semibold disabled:opacity-50 hover:opacity-90"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
