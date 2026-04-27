import { useEffect, useState, useRef } from 'react'

interface CelebrationProps {
  show: boolean
  onClose: () => void
  stats: {
    notes: number
    actions: number
    risks: number
    participants: number
    actionsDone: number
  }
}

// Quality tier based on retro completeness
function calcTier(stats: CelebrationProps['stats']): { name: string; emoji: string; color: string; label: string; score: number } {
  let score = 0
  // Notes (max 25pts)
  score += Math.min(25, stats.notes * 3)
  // Actions created (max 25pts)
  score += Math.min(25, stats.actions * 5)
  // Risks identified (max 20pts)
  score += Math.min(20, stats.risks * 7)
  // Participation (max 15pts)
  score += Math.min(15, stats.participants * 5)
  // Actions completed (max 15pts)
  score += Math.min(15, stats.actionsDone * 5)

  if (score >= 80) return { name: 'Outstanding', emoji: '🏆', color: '#FFD700', label: 'Retrospectiva excepcional', score }
  if (score >= 60) return { name: 'Expecto Patronum', emoji: '✨', color: '#007AFF', label: 'Gran retrospectiva', score }
  if (score >= 40) return { name: 'Lumos', emoji: '💡', color: '#34C759', label: 'Buena retrospectiva', score }
  if (score >= 20) return { name: 'Alohomora', emoji: '🔑', color: '#FF9500', label: 'Retrospectiva básica', score }
  return { name: 'Nox', emoji: '🌑', color: '#86868B', label: 'Necesita más participación', score }
}

// Confetti particle
interface Particle { x: number; y: number; vx: number; vy: number; size: number; color: string; rotation: number; rotationSpeed: number; opacity: number }

function createParticles(count: number): Particle[] {
  const colors = ['#007AFF', '#5856D6', '#34C759', '#FF9500', '#FF3B30', '#FFD700', '#FF2D55', '#00C7BE']
  return Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * 200,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 2,
    size: Math.random() * 8 + 4,
    color: colors[Math.floor(Math.random() * colors.length)]!,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    opacity: 1,
  }))
}

export function Celebration({ show, onClose, stats }: CelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [visible, setVisible] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const tier = calcTier(stats)

  useEffect(() => {
    if (!show) { setVisible(false); return }
    setVisible(true)
    setParticles(createParticles(120))

    return () => { cancelAnimationFrame(animRef.current) }
  }, [show])

  // Animate confetti
  useEffect(() => {
    if (!visible || particles.length === 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    let ps = [...particles]

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ps = ps.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vy: p.vy + 0.05,
        vx: p.vx * 0.999,
        rotation: p.rotation + p.rotationSpeed,
        opacity: Math.max(0, p.opacity - 0.003),
      })).filter(p => p.y < canvas.height + 50 && p.opacity > 0)

      ps.forEach(p => {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      })

      if (ps.length > 0) {
        animRef.current = requestAnimationFrame(animate)
      }
    }

    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [visible, particles])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      {/* Confetti canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

      {/* Card */}
      <div className="relative z-10 bg-white dark:bg-[#2C2C2E] rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center animate-celebration-enter" onClick={e => e.stopPropagation()}>
        {/* Tier badge */}
        <div className="text-6xl mb-3 animate-tier-bounce">{tier.emoji}</div>
        <h2 className="text-2xl font-bold dark:text-white" style={{ color: tier.color }}>{tier.name}</h2>
        <p className="text-sm text-[#86868B] mt-1 mb-5">{tier.label}</p>

        {/* Score bar */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-[#86868B] mb-1">
            <span>Calidad</span>
            <span className="font-bold" style={{ color: tier.color }}>{tier.score}/100</span>
          </div>
          <div className="h-2 bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${tier.score}%`, background: tier.color }} />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { v: stats.notes, l: 'Notas', c: '#007AFF' },
            { v: stats.actions, l: 'Items', c: '#5856D6' },
            { v: stats.risks, l: 'Riesgos', c: '#FF9500' },
            { v: stats.participants, l: 'Participantes', c: '#34C759' },
          ].map(s => (
            <div key={s.l} className="bg-[#F9F9FB] dark:bg-[#3A3A3C] rounded-xl p-3">
              <p className="text-xl font-bold" style={{ color: s.c }}>{s.v}</p>
              <p className="text-[9px] text-[#86868B] uppercase tracking-wide">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Close button */}
        <button onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{ background: tier.color + '15', color: tier.color }}>
          Cerrar retrospectiva
        </button>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes celebration-enter { 0% { opacity: 0; transform: scale(0.7) translateY(30px); } 60% { transform: scale(1.03) translateY(-5px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes tier-bounce { 0% { transform: scale(0) rotate(-30deg); } 50% { transform: scale(1.4) rotate(10deg); } 100% { transform: scale(1) rotate(0deg); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-celebration-enter { animation: celebration-enter 0.5s ease-out; }
        .animate-tier-bounce { animation: tier-bounce 0.6s ease-out 0.2s both; }
      `}</style>
    </div>
  )
}
