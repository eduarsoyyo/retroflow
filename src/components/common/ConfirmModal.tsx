import { useState, useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title: string
  children?: ReactNode
  /** If set, user must type this string to confirm (safe delete — Rule #3) */
  confirmText?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  children,
  confirmText,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  // Rule #4: Enter = confirm, Escape = cancel
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && (!confirmText || typed === confirmText)) onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, confirmText, typed, onConfirm, onCancel])

  if (!open) return null

  const canConfirm = !confirmText || typed === confirmText

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold dark:text-revelio-dark-text">{title}</h3>
          <button onClick={onCancel} className="text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-text dark:text-revelio-dark-text">
            <X size={18} />
          </button>
        </div>

        {children && <div className="mb-4 text-sm text-revelio-subtle dark:text-revelio-dark-subtle">{children}</div>}

        {confirmText && (
          <div className="mb-4">
            <p className="mb-2 text-sm">
              Escribe <strong>{confirmText}</strong> para confirmar:
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-4 py-2 text-sm hover:bg-revelio-bg dark:bg-revelio-dark-border"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40 ${
              danger ? 'bg-revelio-red' : 'bg-revelio-blue'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
