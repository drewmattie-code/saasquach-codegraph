import { cn } from '@/lib/utils'

export const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={cn('rounded-xl', className)}
    style={{
      background: 'linear-gradient(90deg, var(--bg-raised) 25%, var(--bg-hover) 50%, var(--bg-raised) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }}
  />
)
