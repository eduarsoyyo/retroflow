// _shared.tsx — Componentes pequeños reutilizados por varios *Tab del proyecto.
// Consolidamos aquí helpers UI puros (sin lógica de negocio).
import { MessageSquare } from 'lucide-react'

export function Empty({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <MessageSquare className="w-8 h-8 mx-auto mb-1.5 text-revelio-border" />
      <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{message}</p>
    </div>
  )
}
