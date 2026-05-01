import { useState, useEffect, useRef } from 'react'
import { Home, User, Settings, LogOut, ChevronDown, Moon, Sun } from 'lucide-react'
import { Outlet, Link, useNavigate, useLocation, useMatch } from 'react-router-dom'
import { ClockWidget, isClockRunning } from '@/components/common/ClockWidget'
import { NotificationBell } from '@/components/common/NotificationBell'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/data/supabase'
import { fetchClienteById } from '@/data/clientes'
import { trackSessionEnd } from '@/lib/usage'
import type { Room, Cliente } from '@/types'

export function FullScreenLayout() {
  const { user, logout } = useAuth()
  const { isDark, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [showLogoutWarning, setShowLogoutWarning] = useState(false)

  // ─── Project context for top bar ────────────────────────────────────────
  // Same logic as in MainLayout. Duplicated on purpose; will be unified
  // with a shared ProjectContext when we merge layouts (see backlog).
  const projectMatch = useMatch('/project/:slug/*')
  const projectSlug = projectMatch?.params.slug
  const isRetro = !!projectSlug && location.pathname === `/project/${projectSlug}/retro`
  const [projectRoom, setProjectRoom] = useState<Room | null>(null)
  const [projectCliente, setProjectCliente] = useState<Cliente | null>(null)

  useEffect(() => {
    if (!projectSlug) {
      setProjectRoom(null); setProjectCliente(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const r = await supabase.from('rooms').select('*').eq('slug', projectSlug).single()
      if (cancelled) return
      const room = r.data as Room | null
      setProjectRoom(room)
      if (room?.cliente_id) {
        const c = await fetchClienteById(room.cliente_id)
        if (!cancelled) setProjectCliente(c)
      } else {
        setProjectCliente(null)
      }
    })()
    return () => { cancelled = true }
  }, [projectSlug])

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false) }
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    if (isClockRunning()) { setShowLogoutWarning(true); return }
    if (user?.id) trackSessionEnd(user.id); logout(); navigate('/welcome')
  }
  const forceLogout = () => { if (user?.id) trackSessionEnd(user.id); localStorage.removeItem('revelio-clock'); logout(); navigate('/welcome') }

  return (
    <div className="h-screen flex flex-col bg-revelio-bg dark:bg-revelio-dark-bg">
      <header className="h-12 flex items-center justify-between px-4 bg-white dark:bg-revelio-dark-card border-b border-revelio-border dark:border-revelio-dark-border flex-shrink-0 gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-bold text-revelio-blue" style={{ fontFamily: 'Comfortaa, sans-serif' }}>revelio</span>
        </Link>

        {/* Breadcrumb */}
        <div className="flex-1 min-w-0 hidden sm:flex items-center px-2">
          {projectRoom ? (
            <p className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text truncate">
              {projectCliente && <><span className="text-revelio-blue">{projectCliente.name}</span> <span className="text-revelio-subtle dark:text-revelio-dark-subtle font-normal">·</span> </>}
              {projectRoom.name}
              {isRetro && <> <span className="text-revelio-subtle dark:text-revelio-dark-subtle font-normal">·</span> Retro</>}
            </p>
          ) : location.pathname.startsWith('/admin') ? (
            <h1 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text">Centro de Control</h1>
          ) : null}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ClockWidget userId={user?.id} />
          <button onClick={toggleTheme} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border transition-colors">
            {isDark ? <Sun className="w-4 h-4 text-revelio-orange" /> : <Moon className="w-4 h-4 text-revelio-subtle" />}
          </button>
          <NotificationBell userId={user?.id} />
          <Link to="/" title="Inicio" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border transition-colors">
            <Home className="w-4 h-4 text-revelio-subtle" />
          </Link>

          {/* Avatar menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-revelio-bg dark:hover:bg-revelio-dark-border transition-colors">
              <span className="text-sm" style={{ color: user?.color }}>{user?.avatar || '👤'}</span>
              <span className="text-xs font-medium dark:text-revelio-dark-text hidden sm:block">{user?.name?.split(' ')[0]}</span>
              <ChevronDown className="w-3 h-3 text-revelio-subtle" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-revelio-dark-card border border-revelio-border dark:border-revelio-dark-border rounded-xl shadow-lg z-50 overflow-hidden">
                <Link to="/profile" onClick={() => setShowMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-revelio-text dark:text-revelio-dark-text hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><User className="w-3.5 h-3.5 text-revelio-blue" /> Mi perfil</Link>
                {user?.is_superuser && <Link to="/admin" onClick={() => setShowMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-revelio-text dark:text-revelio-dark-text hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Settings className="w-3.5 h-3.5 text-revelio-violet" /> Centro de Control</Link>}
                <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-revelio-red hover:bg-revelio-red/5"><LogOut className="w-3.5 h-3.5" /> Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Logout warning */}
      {showLogoutWarning && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-sm w-full p-6 shadow-xl text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-base font-semibold dark:text-revelio-dark-text mb-1">Fichada abierta</h3>
            <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-4">Debes cerrar la fichada antes de salir.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowLogoutWarning(false)} className="flex-[2] py-2.5 rounded-lg bg-revelio-blue text-white text-sm font-semibold">Volver</button>
              <button onClick={forceLogout} className="flex-1 py-2.5 rounded-lg border border-revelio-red/30 text-sm font-medium text-revelio-red">Salir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
