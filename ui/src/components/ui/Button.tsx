import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('focus-ring rounded-lg border px-3 py-2 text-sm font-medium', className)} {...props} />
}
