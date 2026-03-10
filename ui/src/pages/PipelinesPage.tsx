import { motion } from 'framer-motion'
import { GitBranch } from '@phosphor-icons/react'

type Status = 'PASSING' | 'FAILING' | 'RUNNING' | 'QUEUED'

type Pipeline = { name: string; repo: string; status: Status; duration: string; time: string; branch: string; progress?: number }

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

const pipelines: Pipeline[] = [
  { name: 'build-test', repo: 'platform-core', status: 'PASSING', duration: '3m 41s', time: '2m ago', branch: 'main' },
  { name: 'deploy-staging', repo: 'graph-api', status: 'RUNNING', duration: '1m 12s', time: 'now', branch: 'release/v1', progress: 62 },
  { name: 'lint-check', repo: 'ui-dashboard', status: 'PASSING', duration: '1m 08s', time: '6m ago', branch: 'feat/insights' },
  { name: 'security-scan', repo: 'infra-tools', status: 'FAILING', duration: '5m 30s', time: '9m ago', branch: 'main' },
  { name: 'integration-tests', repo: 'graph-api', status: 'RUNNING', duration: '2m 45s', time: 'now', branch: 'main', progress: 37 },
  { name: 'deploy-prod', repo: 'platform-core', status: 'QUEUED', duration: '—', time: 'queued', branch: 'release/v1' },
  { name: 'type-check', repo: 'ui-dashboard', status: 'PASSING', duration: '52s', time: '13m ago', branch: 'main' },
  { name: 'e2e-tests', repo: 'ui-dashboard', status: 'FAILING', duration: '8m 11s', time: '18m ago', branch: 'main' },
  { name: 'coverage-report', repo: 'graph-api', status: 'PASSING', duration: '2m 04s', time: '24m ago', branch: 'main' },
  { name: 'docker-build', repo: 'infra-tools', status: 'RUNNING', duration: '3m 09s', time: 'now', branch: 'docker/cache', progress: 81 },
]

export default function PipelinesPage() {
  const statusBadge = (status: Status) => {
    if (status === 'PASSING') return 'bg-[color:var(--glow-health)] text-[var(--accent-health)] border-[var(--accent-health)]'
    if (status === 'FAILING') return 'bg-[color:var(--glow-risk)] text-[var(--accent-risk)] border-[var(--accent-risk)]'
    if (status === 'RUNNING') return 'bg-[color:var(--glow-flow)] text-[var(--accent-flow)] border-[var(--accent-flow)]'
    return 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-default)]'
  }

  return (
    <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.06 }} className="space-y-4 p-5">
      <motion.header variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4">
        <h1 className="text-3xl font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Pipelines</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">CI/CD execution board with runtime, queue depth, and branch-level flow visibility.</p>
      </motion.header>

      <motion.section variants={card} className="grid grid-cols-4 gap-3">
        {[
          ['Passing', '8', 'var(--accent-health)'],
          ['Failing', '2', 'var(--accent-risk)'],
          ['Running', '3', 'var(--accent-flow)'],
          ['Avg Duration', '4m 32s', 'var(--accent-insight)'],
        ].map(([label, value, color], i) => (
          <div key={label} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]">
            <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">{label}</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-bold" style={{ ...numberStyle, color }}>
              {label === 'Running' && <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: color }} />}
              {value}
            </div>
            <div className="mt-2 h-1 rounded bg-[var(--bg-base)]"><div className="h-full rounded" style={{ width: `${62 + i * 8}%`, background: color }} /></div>
          </div>
        ))}
      </motion.section>

      <motion.section variants={card} className="grid grid-cols-1 gap-3 xl:grid-cols-3 md:grid-cols-2">
        {pipelines.map((p) => (
          <motion.article key={p.name} whileHover={{ y: -2 }} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4 transition hover:border-[var(--border-strong)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{p.name}</h3>
                <p className="text-xs text-[var(--text-secondary)]">{p.repo}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] tracking-[0.08em] ${statusBadge(p.status)}`}>
                {p.status === 'RUNNING' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-flow)]" />}
                {p.status}
              </span>
            </div>

            {p.status === 'RUNNING' && (
              <div className="mt-3">
                <div className="h-1.5 rounded bg-[var(--bg-base)]">
                  <div className="h-full rounded bg-[var(--accent-flow)]" style={{ width: `${p.progress ?? 0}%` }} />
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-secondary)]" style={numberStyle}>
              <span>{p.duration}</span>
              <span>{p.time}</span>
            </div>

            <div className="mt-3 flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
              <GitBranch size={12} />
              <span style={{ fontFamily: 'var(--font-display)' }}>{p.branch}</span>
            </div>
          </motion.article>
        ))}
      </motion.section>
    </motion.div>
  )
}
