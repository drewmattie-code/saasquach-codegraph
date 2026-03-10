import { Button } from './Button'

interface EmptyStateProps {
  title: string
  hint: string
  cta: string
  onCta?: () => void
}

export function EmptyState({ title, hint, cta, onCta }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center gap-4 p-8 text-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
        <circle cx="36" cy="36" r="34" stroke="#2a2a3a" strokeWidth="2" />
        <circle cx="31" cy="31" r="14" stroke="#00B4D8" strokeWidth="3" />
        <path d="M42 42L52 52" stroke="#00B4D8" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-xl text-sm text-[#8888aa]">{hint}</p>
      <Button onClick={onCta}>{cta}</Button>
    </div>
  )
}
