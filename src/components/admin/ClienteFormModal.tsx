// ClienteFormModal — Create / edit / delete dialogs for a Cliente.
//
// Two modals exported from this file:
//   - ClienteFormModal: create or edit a cliente. Auto-fills slug from
//     name until the user types in the slug field.
//   - ClienteDeleteModal: safe-delete with name confirmation. Blocks the
//     deletion if the cliente has projects assigned (suggests using the
//     'inactive' status instead).
//
// Used from both the admin clientes panel (list) and the cliente detail
// page (per-cliente view). Centralised here to avoid duplication and to
// keep the validation rules in a single place.
import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { createCliente, updateCliente } from '@/data/clientes'
import type { Cliente } from '@/types'

/**
 * Slugify a name into a URL-safe slug: lowercase, no accents, only [a-z0-9-].
 * Used by the form to autofill the slug field. Exported so callers can
 * preview the slug or generate one on demand.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

// ───────────────────────────────────────────────────────────────────────────
// Create / edit form modal
// ───────────────────────────────────────────────────────────────────────────

interface ClienteFormModalProps {
  initial: Cliente | null
  /** Other slugs already in use, to validate uniqueness. Exclude the
   *  current one if editing (the parent decides). */
  existingSlugs: string[]
  onClose: () => void
  onSaved: (cliente: Cliente) => void
}

export function ClienteFormModal({ initial, existingSlugs, onClose, onSaved }: ClienteFormModalProps) {
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

interface ClienteDeleteModalProps {
  cliente: Cliente
  projectCount: number
  deleteInput: string
  setDeleteInput: (s: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function ClienteDeleteModal({ cliente, projectCount, deleteInput, setDeleteInput, onCancel, onConfirm }: ClienteDeleteModalProps) {
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
