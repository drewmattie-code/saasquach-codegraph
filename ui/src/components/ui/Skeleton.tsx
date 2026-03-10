interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = 'h-4 w-3/4' }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-[#1a1a26] ${className}`} />
}
