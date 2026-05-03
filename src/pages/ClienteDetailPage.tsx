// ClienteDetailPage — Vista detalle de un cliente.
//
// URL: /admin/clientes/:slug
//
// Muestra los datos del cliente y todos sus proyectos asociados (rooms con
// cliente_id = cliente.id). Desde aquí se pueden editar los datos del
// cliente o eliminarlo, reusando los mismos modales del panel de admin.
//
// Pendiente para sesión 24:
//   - Resumen financiero agregado (suma presupuestos, costes, márgenes
//     de los proyectos del cliente).
//   - Histórico de actividad.
//
// El portal de cliente (ruta /cliente/:slug, vista filtrada para usuarios
// no-admin) es trabajo del Anligo 2 — depende de RLS y no se construye aquí.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Building2, ChevronLeft, Pencil, Trash2, ExternalLink, Mail, User as UserIcon, FileText, FolderOpen,
} from 'lucide-react'
import { fetchClienteBySlug, deleteCliente, fetchClientes } from '@/data/clientes'
import { fetchRoomsByCliente } from '@/data/rooms'
import type { Cliente, Room } from '@/types'
import { ClienteFormModal, ClienteDeleteModal } from '@/components/admin/ClienteFormModal'

export function ClienteDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [projects, setProjects] = useState<Room[]>([])
  // existingSlugs is needed by ClienteFormModal for slug uniqueness validation;
  // we collect them here once.
  const [existingSlugs, setExistingSlugs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  // Initial load: fetch cliente + its projects + slugs of all clientes.
  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return }
    let cancelled = false
    const load = async () => {
      try {
        const c = await fetchClienteBySlug(slug)
        if (cancelled) return
        if (!c) { setNotFound(true); return }
        setCliente(c)
        const [proj, allClientes] = await Promise.all([
          fetchRoomsByCliente(c.id),
          fetchClientes(),
        ])
        if (cancelled) return
        setProjects(proj)
        // For uniqueness validation in the edit modal, exclude the
        // current cliente's own slug (so editing the same cliente
        // without changing the slug doesn't trigger a 'duplicate' error).
        setExistingSlugs(allClientes.filter(a => a.id !== c.id).map(a => a.slug))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  const isInactive = useMemo(() => cliente?.status === 'inactive', [cliente])

  const handleSaved = (saved: Cliente) => {
    setCliente(saved)
    setEditing(false)
    // If the slug changed, redirect to the new URL — the old one no
    // longer points to anything once the DB row is updated.
    if (saved.slug !== slug) {
      navigate(`/admin/clientes/${saved.slug}`, { replace: true })
    }
  }

  const handleDelete = async () => {
    if (!cliente) return
    if (deleteInput.trim() !== cliente.name) return
    await deleteCliente(cliente.id)
    // After deletion, return to the clientes admin tab.
    navigate('/admin/clientes', { replace: true })
  }

  if (loading) {
    return <div className="p-6 text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center">Cargando cliente...</div>
  }

  if (notFound || !cliente) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle mb-3">Cliente no encontrado.</p>
        <Link to="/admin/clientes" className="text-xs text-revelio-blue hover:underline inline-flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" /> Volver a clientes
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top bar: back link + actions */}
      <div className="flex items-center justify-between">
        <Link to="/admin/clientes" className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-blue inline-flex items-center gap-1">
          <ChevronLeft className="w-3.5 h-3.5" /> Volver a clientes
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-text dark:text-revelio-dark-text hover:bg-revelio-bg dark:hover:bg-revelio-dark-border inline-flex items-center gap-1.5"
          >
            <Pencil className="w-3 h-3" /> Editar
          </button>
          <button
            onClick={() => { setDeleting(true); setDeleteInput('') }}
            className="px-3 py-1.5 rounded-lg border border-revelio-red/40 text-xs font-medium text-revelio-red hover:bg-revelio-red/5 inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" /> Eliminar
          </button>
        </div>
      </div>

      {/* Header card with cliente data */}
      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-6">
        <div className="flex items-start gap-4">
          {cliente.logo_url ? (
            <img src={cliente.logo_url} alt="" className="w-16 h-16 rounded-lg object-contain border border-revelio-border dark:border-revelio-dark-border" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-revelio-blue/10 flex items-center justify-center text-2xl font-bold text-revelio-blue">
              {cliente.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`text-xl font-semibold dark:text-revelio-dark-text ${isInactive ? 'line-through text-revelio-subtle' : ''}`}>
                {cliente.name}
              </h1>
              {isInactive ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-revelio-subtle/10 text-revelio-subtle">Inactivo</span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-revelio-green/10 text-revelio-green">Activo</span>
              )}
            </div>
            <p className="text-[11px] text-revelio-subtle dark:text-revelio-dark-subtle font-mono mt-0.5">{cliente.slug}</p>
          </div>
        </div>

        {/* Contact + notes */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-2 flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Contacto
            </p>
            {(cliente.contact_name || cliente.contact_email) ? (
              <div className="space-y-1.5">
                {cliente.contact_name && (
                  <div className="text-xs text-revelio-text dark:text-revelio-dark-text flex items-center gap-1.5">
                    <UserIcon className="w-3 h-3 text-revelio-subtle" /> {cliente.contact_name}
                  </div>
                )}
                {cliente.contact_email && (
                  <div className="text-xs text-revelio-text dark:text-revelio-dark-text flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-revelio-subtle" />
                    <a href={`mailto:${cliente.contact_email}`} className="text-revelio-blue hover:underline">{cliente.contact_email}</a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-revelio-subtle italic">Sin datos de contacto.</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-2 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Notas
            </p>
            {cliente.notes ? (
              <p className="text-xs text-revelio-text dark:text-revelio-dark-text whitespace-pre-line">{cliente.notes}</p>
            ) : (
              <p className="text-[11px] text-revelio-subtle italic">Sin notas internas.</p>
            )}
          </div>
        </div>
      </div>

      {/* Projects list */}
      <div>
        <h2 className="text-sm font-semibold dark:text-revelio-dark-text mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-revelio-blue" /> Proyectos
          <span className="text-[11px] font-normal text-revelio-subtle dark:text-revelio-dark-subtle">({projects.length})</span>
        </h2>
        {projects.length === 0 ? (
          <div className="rounded-card border border-dashed border-revelio-border dark:border-revelio-dark-border p-8 text-center">
            <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">Este cliente todavía no tiene proyectos asignados.</p>
          </div>
        ) : (
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-revelio-bg dark:bg-revelio-dark-border">
                  {['Proyecto', 'Slug', 'Estado', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const status = (p.status as string) || 'active'
                  const statusLabel = status === 'active' ? 'Activo' : status === 'paused' ? 'En pausa' : status === 'closed' ? 'Cerrado' : status
                  const statusColor =
                    status === 'active' ? 'bg-revelio-green/10 text-revelio-green' :
                    status === 'paused' ? 'bg-revelio-orange/10 text-revelio-orange' :
                    status === 'closed' ? 'bg-revelio-subtle/10 text-revelio-subtle' :
                    'bg-revelio-blue/10 text-revelio-blue'
                  return (
                    <tr key={p.slug} className="border-t border-revelio-border/50 dark:border-revelio-dark-border/50 hover:bg-revelio-bg/40 dark:hover:bg-revelio-dark-border/40">
                      <td className="px-4 py-2.5 dark:text-revelio-dark-text font-medium">
                        <Link to={`/project/${p.slug}`} className="hover:text-revelio-blue inline-flex items-center gap-1.5">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-revelio-subtle dark:text-revelio-dark-subtle font-mono text-[10px]">{p.slug}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold ${statusColor}`}>{statusLabel}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          to={`/project/${p.slug}`}
                          className="p-1.5 rounded hover:bg-revelio-blue/10 text-revelio-blue inline-flex items-center"
                          title="Abrir proyecto"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {editing && (
        <ClienteFormModal
          initial={cliente}
          existingSlugs={existingSlugs}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      )}
      {deleting && (
        <ClienteDeleteModal
          cliente={cliente}
          projectCount={projects.length}
          deleteInput={deleteInput}
          setDeleteInput={setDeleteInput}
          onCancel={() => { setDeleting(false); setDeleteInput('') }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
