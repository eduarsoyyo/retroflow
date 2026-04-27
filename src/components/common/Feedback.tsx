import { useEffect } from 'react'
import { CheckCircle, AlertCircle, X } from 'lucide-react'

interface FeedbackProps {
  type: 'success' | 'error'
  message: string
  onClose: () => void
  duration?: number
}

export function Feedback({ type, message, onClose, duration = 3000 }: FeedbackProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-card px-4 py-3 text-sm text-white shadow-lg ${
        type === 'success' ? 'bg-revelio-green' : 'bg-revelio-red'
      }`}
    >
      {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  )
}
