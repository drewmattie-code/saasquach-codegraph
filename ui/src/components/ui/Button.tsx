import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { clsx } from 'clsx'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'ghost' }

export function Button({ children, variant = 'primary', className, ...rest }: PropsWithChildren<Props>) {
  return <button className={clsx('rounded-lg px-3 py-2 text-sm transition border', variant === 'primary' ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200' : 'bg-transparent border-[#2a2a3a] text-[#f0f0f5]', className)} {...rest}>{children}</button>
}
