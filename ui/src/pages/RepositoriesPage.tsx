import { motion } from 'framer-motion'
import { Plus } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'

type Repo = {
  name: string
  path: string
  is_dependency: boolean
  stats: { files: number; functions: number; classes: number }
}

type Stats = { repositories: number; files: number; functions: number; classes: number }

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

const numberStyle = {
  fontFamily: 'var(--font-display)',
  fontVariantNumeric: 'tabular-nums' as const,
}

function shortPath(path: string) {
  const parts = path.split('/').filter(Boolean)
  return parts.slice(-2).join('/') || path
}

function detectLanguage(path: string) {
  const p = path.toLowerCase()
  if (p.includes('frontend') || p.includes('react') || p.includes('next')) return 'TypeScript'
  if (p.includes('go')) return 'Go'
  if (p.includes('java')) return 'Java'
  if (p.includes('rust')) return 'Rust'
  return 'Python'
}

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/repos').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`repos ${r.status}`)))),
      fetch('/api/stats').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`stats ${r.status}`)))),
    ])
      .then(([repoData, statsData]: [Repo[], Stats]) => {
        if (cancelled) return
        const filtered = repoData.filter((r: Repo) =>
          !r.path.startsWith('/private/var/') &&
          !r.path.startsWith('/tmp/') &&
          !r.path.includes('/T/cgc_test')
        )
        setRepos(filtered)
        setStats(statsData)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const summary = useMemo(() => {
    if (!stats) return 'Loading repository intelligence…'
    return `${stats.repositories} repos · ${stats.files.toLocaleString()} files · ${stats.functions.toLocaleString()} functions`
  }, [stats])

  return (
    <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.06 }} className="space-y-5 p-5">
      <motion.header variants={card} className="flex items-start justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Repositories</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]" style={numberStyle}>{summary}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)]"
          type="button"
        >
          <Plus size={14} />
          Add repo
        </button>
      </motion.header>

      <motion.section variants={card} className="grid grid-cols-1 gap-4 pr-5 xl:grid-cols-3 md:grid-cols-2">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-4">
                <div className="h-4 w-1/2 rounded bg-[var(--bg-hover)]" />
                <div className="mt-3 h-2 rounded bg-[var(--bg-hover)]" />
                <div className="mt-4 h-3 w-3/4 rounded bg-[var(--bg-hover)]" />
                <div className="mt-3 h-3 w-1/3 rounded bg-[var(--bg-hover)]" />
              </div>
            ))
          : repos.map((repo) => {
              const fns = repo.stats.functions
              const health = fns > 500 ? 'var(--accent-health)' : fns > 100 ? 'var(--accent-insight)' : 'var(--accent-risk)'
              return (
                <motion.article
                  key={`${repo.name}-${repo.path}`}
                  whileHover={{ y: -2 }}
                  className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4 transition hover:border-[var(--border-strong)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-base font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{repo.name}</h3>
                    <span className="rounded-full border border-[var(--border-subtle)] bg-[color:var(--glow-health)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--accent-health)]">INDEXED</span>
                  </div>

                  <div className="mt-3 h-1.5 rounded bg-[var(--bg-base)]">
                    <div className="h-full rounded" style={{ width: `${Math.min(100, Math.max(12, Math.log10(fns + 1) * 28))}%`, background: health }} />
                  </div>

                  <div className="mt-3 text-sm text-[var(--text-secondary)]" style={numberStyle}>
                    {repo.stats.files.toLocaleString()} files · {repo.stats.functions.toLocaleString()} fns · {repo.stats.classes.toLocaleString()} cls
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>{shortPath(repo.path)}</span>
                    <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-[var(--text-secondary)]">{detectLanguage(repo.path)}</span>
                  </div>
                </motion.article>
              )
            })}
      </motion.section>
    </motion.div>
  )
}
