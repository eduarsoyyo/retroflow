import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function SplashPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (user) { navigate('/', { replace: true }); return }
    requestAnimationFrame(() => setMounted(true))
  }, [user, navigate])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#007AFF] via-[#3B82F6] to-[#5856D6] animate-gradient" />

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl -top-32 -left-32 animate-float-slow" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[#5856D6]/20 blur-3xl top-1/2 -right-20 animate-float-medium" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-[#34C759]/10 blur-3xl -bottom-20 left-1/3 animate-float-fast" />
      </div>

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className={`relative z-10 text-center transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        {/* Logo text */}
        <h1 className={`font-logo text-7xl text-white tracking-tight mb-4 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          revelio
        </h1>

        {/* Tagline */}
        <p className={`text-white/60 text-lg tracking-wide mb-10 transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          Ningún proyecto debería moverse en las sombras.
        </p>

        {/* CTA */}
        <button
          onClick={() => navigate('/login')}
          className={`group relative px-10 py-3.5 rounded-xl bg-white text-[#007AFF] font-semibold text-base tracking-wide shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/15 transition-all duration-500 delay-700 hover:scale-[1.02] active:scale-[0.98] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <span className="relative z-10 flex items-center gap-2">
            Acceder
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </button>

        {/* Version badge */}
        <p className={`mt-8 text-white/25 text-xs tracking-widest uppercase transition-all duration-1000 delay-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          Consulting Management Platform
        </p>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/10 to-transparent" />

      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient { background-size: 200% 200%; animation: gradient-shift 8s ease infinite; }
        @keyframes float-slow { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -40px) scale(1.1); } }
        @keyframes float-medium { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-20px, 30px) scale(1.05); } }
        @keyframes float-fast { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(40px, -20px) scale(1.08); } }
        .animate-float-slow { animation: float-slow 12s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 9s ease-in-out infinite; }
        .animate-float-fast { animation: float-fast 7s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
