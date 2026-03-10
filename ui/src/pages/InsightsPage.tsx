import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

type Complexity = { function_name: string; path: string; complexity: number; line_number: number }
type DeadCodeResult = { potentially_unused_functions: Array<{ function_name: string; path: string; line_number: number }> }
type Insight = { id: string; type: 'HIGH COMPLEXITY' | 'DEAD CODE' | 'COUPLING RISK' | 'VELOCITY DROP'; severity: 'critical' | 'warning' | 'info'; title: string; description: string; path: string }

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

const short = (p: string) => p.split('/').filter(Boolean).slice(-2).join('/') || p

export default function InsightsPage() {
  const [complexity, setComplexity] = useState<Complexity[]>([])
  const [deadCode, setDeadCode] = useState<DeadCodeResult['potentially_unused_functions']>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/analysis/complexity?limit=10').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/analysis/dead-code?limit=10').then((r) => (r.ok ? r.json() : { potentially_unused_functions: [] })),
    ])
      .then(([cx, dc]: [Complexity[], DeadCodeResult]) => {
        setComplexity(cx)
        setDeadCode(dc.potentially_unused_functions)
      })
      .finally(() => setLoading(false))
  }, [])

  const insights = useMemo<Insight[]>(() => {
    const fromCx: Insight[] = complexity.map((c, i) => ({
      id: `cx-${i}`,
      type: 'HIGH COMPLEXITY',
      severity: c.complexity > 40 ? 'critical' : c.complexity > 20 ? 'warning' : 'info',
      title: c.function_name,
      description: `complexity score: ${c.complexity}`,
      path: c.path,
    }))

    const fromDead: Insight[] = deadCode.map((d, i) => ({
      id: `dc-${i}`,
      type: 'DEAD CODE',
      severity: 'warning',
      title: d.function_name,
      description: 'potentially unused — no callers found',
      path: d.path,
    }))

    const mock: Insight[] = [
      { id: 'm1', type: 'COUPLING RISK', severity: 'critical', title: 'gateway.dispatch_workflow', description: 'fan-out increased to 18 downstream calls', path: 'services/gateway/dispatcher.py' },
      { id: 'm2', type: 'VELOCITY DROP', severity: 'warning', title: 'review queue saturation', description: 'avg review latency up 34% over 7 days', path: 'org/metrics/reviews' },
      { id: 'm3', type: 'COUPLING RISK', severity: 'info', title: 'auth.token_provider', description: 'cross-package references trending upward', path: 'packages/auth/provider.ts' },
    ]

    return [...fromCx, ...fromDead, ...mock]
  }, [complexity, deadCode])

  const severityCount = useMemo(() => {
    const v = { critical: 0, warning: 0, info: 0 }
    insights.forEach((i) => (v[i.severity] += 1))
    return [
      { name: 'critical', value: v.critical, color: 'var(--accent-risk)' },
      { name: 'warning', value: v.warning, color: 'var(--accent-insight)' },
      { name: 'info', value: v.info, color: 'var(--accent-flow)' },
    ]
  }, [insights])

  const mostComplex = useMemo(() => [...complexity].sort((a, b) => b.complexity - a.complexity)[0], [complexity])
  const densestDead = deadCode[0]

  const dotColor = (severity: Insight['severity']) => severity === 'critical' ? 'var(--accent-risk)' : severity === 'warning' ? 'var(--accent-insight)' : 'var(--accent-flow)'

  return (
    <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.06 }} className="space-y-4 p-5">
      <motion.header variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4">
        <h1 className="text-3xl font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Insights</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">AI-ranked signals combining complexity trends and dead-code likelihood.</p>
      </motion.header>

      <motion.section variants={card} className="grid grid-cols-[1.5fr_1fr] gap-4">
        <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--bg-hover)]" />)
            : insights.map((insight) => (
                <motion.article key={insight.id} whileHover={{ y: -2 }} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 transition hover:border-[var(--border-strong)]">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">{insight.type}</span>
                    <span className="h-2 w-2 rounded-full" style={{ background: dotColor(insight.severity) }} />
                  </div>
                  <div className="mt-2 text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{insight.title}</div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{insight.description}</p>
                  <div className="mt-2 text-xs text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>{short(insight.path)}</div>
                  <button className="mt-2 rounded-lg border border-[var(--accent-insight)] bg-transparent px-2 py-1 text-xs text-[var(--accent-insight)] hover:bg-[color:var(--glow-insight)]">Investigate →</button>
                </motion.article>
              ))}
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
            <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Total insights</div>
            <div className="mt-1 text-3xl font-bold" style={numberStyle}>{insights.length}</div>
            <div className="mt-2 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severityCount} innerRadius={36} outerRadius={58} dataKey="value" stroke="none">
                    {severityCount.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
            <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Most complex function</div>
            <div className="mt-2 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{mostComplex?.function_name ?? '—'}</div>
            <div className="text-xs text-[var(--text-tertiary)]" style={numberStyle}>score {mostComplex?.complexity ?? 0}</div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
            <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Highest dead code density</div>
            <div className="mt-2 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{densestDead?.function_name ?? '—'}</div>
            <div className="text-xs text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>{short(densestDead?.path ?? 'n/a')}</div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  )
}
