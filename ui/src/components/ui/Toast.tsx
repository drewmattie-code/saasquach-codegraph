import { useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'

const levelStyles = {
  success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  error: 'border-red-400/30 bg-red-500/10 text-red-200',
  warning: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
} as const

export function Toast() {
  const { toasts, removeToast } = useUIStore()

  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map((toast) => setTimeout(() => removeToast(toast.id), 4000))
    return () => timers.forEach(clearTimeout)
  }, [toasts, removeToast])

  return (
    <div className="fixed bottom-4 right-4 z-[70] space-y-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={`min-w-72 rounded-xl border px-4 py-3 shadow-lg ${levelStyles[toast.level]}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}
