import { useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'

export function Toast() {
  const { toast, setToast } = useUIStore()
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast, setToast])
  if (!toast) return null
  return <div className="fixed bottom-4 right-4 rounded-xl border border-[#2a2a3a] bg-[#1a1a26] px-4 py-3">{toast}</div>
}
