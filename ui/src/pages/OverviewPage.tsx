import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { ArrowRight } from '@phosphor-icons/react'
import { DependencyGraphCanvas } from '@/components/graph/DependencyGraphCanvas'
import { healthSub, velocity } from '@/data/mock'
import { fetchHealthData, mockHealthData, type HealthData } from '@/data/healthScore'

type OverviewRepo = {
  name: string
  path: string
  is_dependency: boolean
  stats: { files: number; functions: number; classes: number }
}

function detectLanguage(path: string) {
  const p = path.toLowerCase()
  if (p.includes('frontend') || p.includes('react') || p.includes('next')) return 'TypeScript'
  if (p.includes('go')) return 'Go'
  if (p.includes('java')) return 'Java'
  if (p.includes('rust')) return 'Rust'
  return 'Python'
}

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

// Odometer-style animated number — counts from 0 to target on mount
function AnimatedNumber({ value, decimals = 0, suffix = '', prefix = '' }: { value: number; decimals?: number; suffix?: string; prefix?: string }) {
  const mv = useMotionValue(0)
  const display = useTransform(mv, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1] })
    return controls.stop
  }, [value, mv])

  useEffect(() => {
    const unsub = display.on('change', (v) => {
      if (ref.current) ref.current.textContent = v
    })
    return unsub
  }, [display])

  return <span ref={ref}>{`${prefix}0${suffix}`}</span>
}

function HealthRing({ value }: { value: number }) {
  const r = 70
  const c = 2 * Math.PI * r
  const targetOffset = c * (1 - value / 100)
  const color = value < 40 ? 'var(--accent-risk)' : value < 70 ? 'var(--accent-insight)' : 'var(--accent-health)'
  const glowColor = value < 40 ? 'var(--glow-risk)' : value < 70 ? 'var(--glow-insight)' : 'var(--glow-health)'

  // Animate stroke-dashoffset from full circumference (empty) to target
  const strokeOffset = useMotionValue(c)
  useEffect(() => {
    const controls = animate(strokeOffset, targetOffset, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
    })
    return controls.stop
  }, [targetOffset, strokeOffset, c])

  return (
    <div className="relative grid h-44 w-44 place-items-center">
      {/* Halo glow behind ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <svg width="180" height="180" className="-rotate-90">
        <circle cx="90" cy="90" r={r} stroke="var(--border-subtle)" strokeWidth="12" fill="none" />
        <motion.circle cx="90" cy="90" r={r} stroke={color} strokeWidth="12" fill="none"
          strokeLinecap="round" strokeDasharray={c}
          style={{ strokeDashoffset: strokeOffset, filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <motion.div
        className="absolute text-4xl font-bold"
        style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums', color }}
        animate={{ textShadow: [`0 0 0px transparent`, `0 0 20px ${glowColor}`, `0 0 0px transparent`] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <AnimatedNumber value={value} />
      </motion.div>
    </div>
  )
}

export default function OverviewPage() {
  const [events, setEvents] = useState<string[]>([])
  const [repos, setRepos] = useState<OverviewRepo[]>([])
  const [health, setHealth] = useState<HealthData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/repos')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: OverviewRepo[]) => {
        if (cancelled) return
        const filtered = data.filter(
          (r) =>
            !r.path.startsWith('/private/var/') &&
            !r.path.startsWith('/tmp/') &&
            !r.path.includes('/T/cgc_test')
        )
        setRepos(filtered.slice(0, 9))
      })
    return () => { cancelled = true }
  }, [])

  // Fetch real health score from CGC data
  useEffect(() => {
    fetchHealthData()
      .then(setHealth)
      .catch(() => setHealth(mockHealthData()))
  }, [])

  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}/ws/mcp-activity`)
    ws.onmessage = (e) => {
      const payload = JSON.parse(e.data) as { line?: string }
      setEvents((prev) => [payload.line ?? 'MCP update', ...prev].slice(0, 24))
    }
    return () => ws.close()
  }, [])

  return (
    <motion.div
      initial="initial"
      animate="animate"
      transition={{ staggerChildren: 0.08 }}
      className="grid gap-4 p-5"
      style={{
        gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
        gridTemplateAreas: '"health health velocity velocity" "graph graph graph activity" "graph graph graph activity" "repos repos insights insights"',
      }}
    >
      {/* Health Score */}
      <motion.section variants={card} className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-5" style={{ gridArea: 'health' }}>
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, var(--glow-health) 0%, transparent 70%)' }} />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Org Health</div>
            <div className="mt-2 text-sm text-[var(--text-tertiary)]">
              {health ? 'Derived from dead code ratio, complexity scores, and test coverage' : 'Computing from indexed data…'}
            </div>
          </div>
          <HealthRing value={health?.score ?? 0} />
        </div>
        <div className="relative mt-4 grid grid-cols-4 gap-2">
          {/* Real metrics from CGC data */}
          {health ? (
            <>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Dead Code</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
                    {(health.deadCodeRatio * 100).toFixed(1)}%
                  </div>
                  <span className="text-[10px]" style={{ color: health.deadCodeRatio < 0.05 ? 'var(--accent-health)' : 'var(--accent-risk)' }}>
                    {health.deadCodeCount} fns
                  </span>
                </div>
                <div className="mt-1 h-1 rounded bg-[var(--bg-active)]">
                  <div className="h-full rounded transition-all" style={{ width: `${Math.min(100, health.deadCodeRatio * 500)}%`, background: health.deadCodeRatio < 0.05 ? 'var(--accent-health)' : health.deadCodeRatio < 0.15 ? 'var(--accent-insight)' : 'var(--accent-risk)' }} />
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Avg Complexity</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
                    {health.avgComplexity.toFixed(1)}
                  </div>
                  <span className="text-[10px]" style={{ color: health.avgComplexity < 10 ? 'var(--accent-health)' : 'var(--accent-risk)' }}>
                    {health.avgComplexity < 10 ? '↓ low' : '↑ high'}
                  </span>
                </div>
                <div className="mt-1 h-1 rounded bg-[var(--bg-active)]">
                  <div className="h-full rounded transition-all" style={{ width: `${Math.min(100, health.avgComplexity * 3.3)}%`, background: health.avgComplexity < 10 ? 'var(--accent-health)' : health.avgComplexity < 20 ? 'var(--accent-insight)' : 'var(--accent-risk)' }} />
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Test Coverage</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
                    {health.testCoverage}%
                  </div>
                  <span className="text-[10px]" style={{ color: health.testCoverage > 70 ? 'var(--accent-health)' : 'var(--accent-risk)' }}>
                    inferred
                  </span>
                </div>
                <div className="mt-1 h-1 rounded bg-[var(--bg-active)]">
                  <div className="h-full rounded transition-all" style={{ width: `${health.testCoverage}%`, background: health.testCoverage > 70 ? 'var(--accent-health)' : health.testCoverage > 40 ? 'var(--accent-insight)' : 'var(--accent-risk)' }} />
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Symbols</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
                    {health.functionCount.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-[var(--accent-flow)]">indexed</span>
                </div>
                <div className="mt-1 h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={health.complexityScores.slice(0, 12).map((v) => ({ v }))}>
                      <Line type="monotone" dataKey="v" stroke="var(--accent-flow)" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            /* Fallback to mock data while loading */
            healthSub.map((m) => (
              <div key={m.label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{m.label}</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
                  <span className="text-[10px]" style={{ color: m.delta < 0 && m.label.includes('Rate') ? 'var(--accent-health)' : m.delta > 0 ? 'var(--accent-health)' : 'var(--accent-risk)' }}>
                    {(m.delta < 0 && m.label.includes('Rate')) || (m.delta < 0 && m.label.includes('Velocity')) ? '↓' : m.delta > 0 ? '↑' : '↓'} {Math.abs(m.delta)}%
                  </span>
                </div>
                <div className="h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={m.data.map((v) => ({ v }))}>
                      <Line type="monotone" dataKey="v" stroke="var(--accent-flow)" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.section>

      {/* Velocity */}
      <motion.section variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-5" style={{ gridArea: 'velocity' }}>
        <div className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Velocity</div>
        <div className="grid grid-cols-2 gap-3">
          {velocity.map((m) => (
            <motion.article key={m.label} whileHover={{ y: -4, scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 pb-3 pt-2">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{m.label}</div>
              <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
                {typeof m.value === 'number' ? (
                  <AnimatedNumber value={m.value} />
                ) : (
                  (() => {
                    const match = String(m.value).match(/^([\d.]+)(.*)$/)
                    if (match) {
                      const num = parseFloat(match[1])
                      const suf = match[2]
                      return <AnimatedNumber value={num} decimals={suf === 'h' || num % 1 !== 0 ? 1 : 0} suffix={suf} />
                    }
                    return m.value
                  })()
                )}
              </div>
              <div className="text-xs" style={{ color: m.delta > 0 ? 'var(--accent-health)' : 'var(--accent-risk)' }}>
                {m.delta > 0 ? '↑' : '↓'} {Math.abs(m.delta)}%
              </div>
              <div className="h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={m.data.map((v) => ({ v }))}>
                    <defs>
                      <linearGradient id={`g-${m.label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6C5CE7" stopOpacity={0.7} />
                        <stop offset="100%" stopColor="#6C5CE7" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area dataKey="v" stroke="var(--accent-graph)" fill={`url(#g-${m.label})`} strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.article>
          ))}
        </div>
      </motion.section>

      {/* Dependency Graph */}
      <motion.section variants={card} className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4" style={{ gridArea: 'graph' }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Live Dependency Graph</h3>
          <Link to="/graph" className="inline-flex items-center gap-1 text-xs text-[var(--accent-graph)] transition hover:underline">
            Open in Explorer <ArrowRight size={12} />
          </Link>
        </div>
        <DependencyGraphCanvas />
      </motion.section>

      {/* Activity Feed */}
      <motion.section variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4" style={{ gridArea: 'activity' }}>
        <div className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Activity</div>
        {events.map((line, i) => (
          <motion.div key={`${line}-${i}`} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-2 rounded-lg border-l-2 border-[var(--accent-change)] bg-[var(--bg-base)] p-2 text-xs">
            {line}
          </motion.div>
        ))}
        {events.length === 0 && <div className="text-xs text-[var(--text-tertiary)]">Connecting to activity feed…</div>}
      </motion.section>

      {/* Repos */}
      <motion.section variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4" style={{ gridArea: 'repos' }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Active Repositories</div>
          <Link to="/repositories" className="inline-flex items-center gap-1 text-xs text-[var(--accent-graph)] transition hover:underline">
            All repositories <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {repos.map((repo) => {
            const fns = repo.stats.functions
            const health = fns > 500 ? 'var(--accent-health)' : fns > 100 ? 'var(--accent-insight)' : 'var(--accent-risk)'
            return (
              <motion.article key={`${repo.name}-${repo.path}`} whileHover={{ y: -4, scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{repo.name}</div>
                  <span className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">{detectLanguage(repo.path)}</span>
                </div>
                <div className="mt-2 h-1 rounded bg-[var(--bg-active)]">
                  <div className="h-full rounded" style={{ width: `${Math.min(100, Math.max(12, Math.log10(fns + 1) * 28))}%`, background: health }} />
                </div>
                <div className="mt-2 text-xs text-[var(--text-tertiary)]">Updated recently</div>
              </motion.article>
            )
          })}
          {repos.length === 0 && Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
              <div className="h-4 w-2/3 rounded bg-[var(--bg-hover)]" />
              <div className="mt-2 h-1 rounded bg-[var(--bg-hover)]" />
              <div className="mt-2 h-3 w-1/2 rounded bg-[var(--bg-hover)]" />
            </div>
          ))}
        </div>
      </motion.section>

      {/* Insights */}
      <motion.section variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4" style={{ gridArea: 'insights' }}>
        <div className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">AI Insights</div>
        <div className="space-y-2">
          {[
            { type: 'Dependency Risk', severity: 'critical' as const, desc: 'Service coupling increased 27% in payments chain. Fan-out from gateway at 18 downstream calls.' },
            { type: 'Velocity Drop', severity: 'warning' as const, desc: 'Review queue latency up 34% this week. 6 PRs waiting >24h in platform-core.' },
            { type: 'Review Bottleneck', severity: 'warning' as const, desc: '3 engineers account for 72% of approvals. Bus factor risk on auth and billing modules.' },
            { type: 'Security Advisory', severity: 'critical' as const, desc: 'CVE-2024-32681 affects requests 2.28.0 in 4 repositories. Patch available.' },
          ].map((insight, i) => (
            <motion.div key={insight.type}
              animate={i === 0 ? { boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 0 24px var(--glow-insight)', '0 0 0 rgba(0,0,0,0)'] } : {}}
              transition={{ duration: 4, repeat: Infinity }}
              whileHover={{ y: -3, scale: 1.01 }}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="border-l-2 border-[var(--accent-insight)] pl-2 text-[10px] uppercase tracking-[0.08em] text-[var(--accent-insight)]">{insight.type}</div>
                <span className="h-2 w-2 rounded-full" style={{ background: insight.severity === 'critical' ? 'var(--accent-risk)' : 'var(--accent-insight)' }} />
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{insight.desc}</p>
              <button className="mt-2 text-xs text-[var(--accent-insight)] hover:underline">Investigate →</button>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  )
}
