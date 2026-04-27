import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[revelio] Error boundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex min-h-[300px] items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-[#FF3B30]" />
            </div>
            <h3 className="text-sm font-semibold dark:text-[#F5F5F7] mb-1">Algo salió mal</h3>
            <p className="text-[10px] text-[#8E8E93] mb-4">{this.state.error?.message || 'Error inesperado'}</p>
            <button onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
              className="px-4 py-2 rounded-xl bg-[#007AFF] text-white text-xs font-semibold hover:bg-[#007AFF]/90 transition-colors">
              Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
