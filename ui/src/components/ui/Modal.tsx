import type { PropsWithChildren } from 'react'

interface Props { open: boolean; title: string; onClose: () => void }

export function Modal({ open, title, onClose, children }: PropsWithChildren<Props>) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
      <div className="w-[520px] rounded-2xl border border-[#2a2a3a] bg-[#1a1a26] p-5">
        <div className="mb-4 flex items-center justify-between"><h3>{title}</h3><button onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  )
}
