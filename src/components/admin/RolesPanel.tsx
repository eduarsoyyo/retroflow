import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { Plus, ChevronDown, ChevronRight, X, Pencil, Trash2 } from 'lucide-react'
import { fetchTeamMembers, updateMember, updateMembersByRoleLabel } from '@/data/team'
import { fetchAdminRolesFull, createAdminRole, renameAdminRole, deleteAdminRole } from '@/data/roles'
import type { Member } from '@/types'

const ROLE_COLORS: Record<string, string> = { 'Service Manager': '#FF3B30', 'Jefe de proyecto': '#FF9500', 'Scrum Master': '#007AFF', 'Product Owner': '#5856D6', 'Consultor': '#34C759', 'Analista Funcional': '#AF52DE', 'Desarrollador/a': '#00C7BE', 'QA / Tester': '#FF2D55', 'DevOps': '#5AC8FA', 'Tech Lead': '#FF6482' }

// ─── Reusable modal shell ─────────────────────────────────────────────────
// Centralises Escape-key dismissal, overlay-click dismissal, role/aria
// attributes and outer layout. Body content is provided by caller.
interface RoleModalProps {
  titleId: string
  title: string
  onClose: () => void
  children: React.ReactNode
}
function RoleModal({ titleId, title, onClose, children }: RoleModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-sm w-full p-5 shadow-xl"
      >
        <h3 id={titleId} className="text-sm font-semibold dark:text-revelio-dark-text mb-3">{title}</h3>
        {children}
      </div>
    </div>
  )
}

export function RolesPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  // Modal state
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [editingRole, setEditingRole] = useState<string | null>(null)  // role being renamed (null = closed)
  const [editName, setEditName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)  // role being deleted (null = closed)
  const [deleteInput, setDeleteInput] = useState('')

  // Refs for autofocus on modal open
  const createInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const deleteInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetchTeamMembers(),
      fetchAdminRolesFull(),
    ]).then(([membersData, rolesData]) => {
      setMembers(membersData)
      setRoles(rolesData.map(r => r.name).filter(Boolean))
      setLoading(false)
    })
  }, [])

  const allRoleNames = useMemo(() => [...new Set([...roles, ...members.map(m => m.role_label).filter(Boolean) as string[]])].sort(), [roles, members])
  const byRole = (role: string) => members.filter(m => m.role_label === role)
  const roleColor = (role: string) => ROLE_COLORS[role] || '#5856D6'

  // ─── Create role ──────────────────────────────────────────────────────
  const openCreate = () => { setCreateName(''); setShowCreate(true) }
  const closeCreate = useCallback(() => { setShowCreate(false); setCreateName('') }, [])
  useEffect(() => { if (showCreate) setTimeout(() => createInputRef.current?.focus(), 50) }, [showCreate])

  const handleCreateRole = async () => {
    const t = createName.trim()
    if (!t || allRoleNames.includes(t)) return
    await createAdminRole(t)
    setRoles(prev => [...prev, t])
    closeCreate()
  }

  // ─── Assign / Unassign (inline buttons within card, no modal) ─────────
  const handleAssignRole = async (memberId: string, role: string) => {
    setSaving(memberId)
    await updateMember(memberId, { role_label: role })
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role_label: role } : m))
    setSaving(null)
  }

  const handleUnassignRole = async (memberId: string) => {
    setSaving(memberId)
    await updateMember(memberId, { role_label: '' })
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role_label: '' } : m))
    setSaving(null)
  }

  // ─── Rename role ──────────────────────────────────────────────────────
  const openRename = (role: string) => { setEditName(role); setEditingRole(role) }
  const closeRename = useCallback(() => { setEditingRole(null); setEditName('') }, [])
  useEffect(() => { if (editingRole) setTimeout(() => editInputRef.current?.focus(), 50) }, [editingRole])

  const handleRenameRole = async () => {
    const oldName = editingRole
    if (!oldName) return
    const newName = editName.trim()
    if (!newName || newName === oldName) { closeRename(); return }
    // Rename in admin_roles
    await renameAdminRole(oldName, newName)
    // Update all team_members with this role
    await updateMembersByRoleLabel(oldName, newName)
    setRoles(prev => prev.map(r => r === oldName ? newName : r))
    setMembers(prev => prev.map(m => m.role_label === oldName ? { ...m, role_label: newName } : m))
    closeRename()
  }

  // ─── Delete role ──────────────────────────────────────────────────────
  const openDelete = (role: string) => { setDeleteInput(''); setConfirmDelete(role) }
  const closeDelete = useCallback(() => { setConfirmDelete(null); setDeleteInput('') }, [])
  useEffect(() => { if (confirmDelete) setTimeout(() => deleteInputRef.current?.focus(), 50) }, [confirmDelete])

  const handleDeleteRole = async () => {
    const name = confirmDelete
    if (!name) return
    if (deleteInput !== name) return
    // Remove from admin_roles
    await deleteAdminRole(name)
    // Clear role from all members with this role
    await updateMembersByRoleLabel(name, '')
    setRoles(prev => prev.filter(r => r !== name))
    setMembers(prev => prev.map(m => m.role_label === name ? { ...m, role_label: '' } : m))
    closeDelete()
  }

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando roles...</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text mb-1">Roles y Habilidades</h2>
          <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{allRoleNames.length} roles · {members.length} personas</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-revelio-blue text-white text-xs font-medium flex items-center gap-1 hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo rol
        </button>
      </div>

      {/* Role cards */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {allRoleNames.map(role => {
          const mems = byRole(role)
          const color = roleColor(role)
          const isExp = expandedRole === role
          const unassigned = members.filter(m => m.role_label !== role)

          return (
            <div key={role} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden">
              <button onClick={() => setExpandedRole(isExp ? null : role)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-revelio-bg dark:hover:bg-revelio-dark-border dark:bg-revelio-dark-border/50 transition-colors">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
                  <span className="text-base font-bold" style={{ color }}>{role.charAt(0)}</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text">{role}</p>
                  <p className="text-[10px]" style={{ color }}>{mems.length} persona{mems.length !== 1 ? 's' : ''}</p>
                </div>
                {isExp ? <ChevronDown className="w-4 h-4 text-revelio-subtle dark:text-revelio-dark-subtle" /> : <ChevronRight className="w-4 h-4 text-revelio-subtle dark:text-revelio-dark-subtle" />}
              </button>

              {isExp && (
                <div className="border-t border-revelio-border dark:border-revelio-dark-border px-4 py-3">
                  {/* Edit / Delete buttons (open modals) */}
                  <div className="flex gap-3 mb-3">
                    <button onClick={() => openRename(role)} className="flex items-center gap-1 text-[10px] text-revelio-blue hover:underline"><Pencil className="w-2.5 h-2.5" /> Renombrar</button>
                    <button onClick={() => openDelete(role)} className="flex items-center gap-1 text-[10px] text-revelio-red hover:underline"><Trash2 className="w-2.5 h-2.5" /> Eliminar</button>
                  </div>

                  {/* Assigned */}
                  {mems.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1.5">Asignados ({mems.length})</p>
                      {mems.map(m => (
                        <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1" style={{ background: color + '08' }}>
                          <div className="w-5 h-5 rounded flex items-center justify-center text-xs" style={{ background: m.color || '#007AFF' }}>{m.avatar || '👤'}</div>
                          <span className="text-xs font-medium flex-1">{m.name}</span>
                          <button
                            onClick={() => handleUnassignRole(m.id)}
                            disabled={saving === m.id}
                            aria-label={`Quitar rol de ${m.name}`}
                            className="text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red disabled:opacity-30"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {mems.length === 0 && <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-3">Nadie asignado</p>}

                  {/* Available to assign */}
                  <p className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1.5">Asignar personas</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {unassigned.map(m => (
                      <button key={m.id} onClick={() => handleAssignRole(m.id, role)} disabled={saving === m.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card text-[10px] hover:border-revelio-blue disabled:opacity-30">
                        <span className="text-xs">{m.avatar || '👤'}</span> {m.name.split(' ')[0]}
                        {m.role_label && <span className="text-revelio-subtle dark:text-revelio-dark-subtle">({m.role_label})</span>}
                      </button>
                    ))}
                    {unassigned.length === 0 && <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">Todos asignados</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ─── Create role modal ─────────────────────────────────────────── */}
      {showCreate && (
        <RoleModal titleId="role-create-title" title="Crear nuevo rol" onClose={closeCreate}>
          <input
            ref={createInputRef}
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateRole()}
            placeholder="Nombre del nuevo rol..."
            aria-label="Nombre del nuevo rol"
            className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text mb-4"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={closeCreate}
              className="px-4 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle dark:text-revelio-dark-subtle"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateRole}
              disabled={!createName.trim() || allRoleNames.includes(createName.trim())}
              className="px-4 py-2 rounded-lg bg-revelio-blue text-white text-xs font-semibold disabled:opacity-30"
            >
              Crear
            </button>
          </div>
        </RoleModal>
      )}

      {/* ─── Rename role modal ─────────────────────────────────────────── */}
      {editingRole && (
        <RoleModal titleId="role-rename-title" title={`Renombrar rol "${editingRole}"`} onClose={closeRename}>
          <input
            ref={editInputRef}
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRenameRole()}
            aria-label="Nuevo nombre del rol"
            className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text mb-4"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={closeRename}
              className="px-4 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle dark:text-revelio-dark-subtle"
            >
              Cancelar
            </button>
            <button
              onClick={handleRenameRole}
              disabled={!editName.trim() || editName.trim() === editingRole}
              className="px-4 py-2 rounded-lg bg-revelio-blue text-white text-xs font-semibold disabled:opacity-30"
            >
              Guardar
            </button>
          </div>
        </RoleModal>
      )}

      {/* ─── Delete role confirm modal (safe-delete with name typing) ──── */}
      {confirmDelete && (() => {
        const targetMems = byRole(confirmDelete)
        return (
          <RoleModal titleId="role-delete-title" title={`Eliminar rol "${confirmDelete}"`} onClose={closeDelete}>
            <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-2">
              Se desasignará el rol de {targetMems.length} persona{targetMems.length !== 1 ? 's' : ''}.
            </p>
            <p className="text-xs font-semibold text-revelio-red mb-2">
              Escribe "{confirmDelete}" para confirmar:
            </p>
            <input
              ref={deleteInputRef}
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && deleteInput === confirmDelete && handleDeleteRole()}
              aria-label={`Confirmar nombre del rol a eliminar`}
              placeholder={confirmDelete}
              className="w-full rounded-lg border border-revelio-red/30 px-3 py-2 text-sm outline-none focus:border-revelio-red dark:bg-revelio-dark-bg dark:text-revelio-dark-text mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeDelete}
                className="px-4 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle dark:text-revelio-dark-subtle"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteRole}
                disabled={deleteInput !== confirmDelete}
                className="px-4 py-2 rounded-lg bg-revelio-red text-white text-xs font-semibold disabled:opacity-30"
              >
                Eliminar
              </button>
            </div>
          </RoleModal>
        )
      })()}
    </div>
  )
}
