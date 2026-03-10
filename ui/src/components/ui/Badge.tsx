import type { PropsWithChildren } from 'react'

export function Badge({ children }: PropsWithChildren) {
  return <span className="rounded-md border border-[#2a2a3a] bg-[#1a1a26] px-2 py-1 text-xs text-[#8888aa]">{children}</span>
}
