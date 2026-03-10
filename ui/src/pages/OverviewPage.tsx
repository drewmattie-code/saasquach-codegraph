import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { DependencyGraphCanvas } from '@/components/graph/DependencyGraphCanvas'
import { healthSub, velocity } from '@/data/mock'

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

function HealthRing({ value }: { value: number }) {
  const r = 70
  const c = 2 * Math.PI * r
  const offset = c * (1 - value / 100)
  const color = value < 40 ? 'var(--accent-risk)' : value < 70 ? 'var(--accent-insight)' : 'var(--accent-health)'
  return (
    <div className="relative grid h-44 w-44 place-items-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle cx="90" cy="90" r={r} stroke="var(--border-default)" strokeWidth="12" fill="none" />
        <circle cx="90" cy="90" r={r} stroke={color} strokeWidth="12" fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <motion.div
        className="absolute text-4xl font-bold"
        style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}
        animate={{ boxShadow: ['0 0 0 rgba(0,0,0,0)', `0 0 32px ${value > 70 ? 'var(--glow-health)' : 'var(--glow-insight)'}`, '0 0 0 rgba(0,0,0,0)'] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        {value}
      </motion.div>
    </div>
  )
}

export default function OverviewPage() {
  const [events, setEvents] = useState<string[]>([])

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
      <motion.section variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-5" style={{ gridArea: 'health' }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Org Health</div>
            <div className="mt-2 text-5xl font-bold" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>84</div>
          </div>
          <HealthRing value={84} />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {healthSub.map((m) => (
            <div key={m.label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{m.label}</div>
              <div className="text-sm font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
              <div className="h-8">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={m.data.map((v) => ({ v }))}>
                    <Line type="monotone" dataKey="v" stroke="var(--accent-flow)" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Velocity */}
      <motion.section variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-5" style={{ gridArea: 'velocity' }}>
        <div className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Velocity</div>
        <div className="grid grid-cols-2 gap-3">
          {velocity.map((m) => (
            <motion.article key={m.label} whileHover={{ y: -2 }} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 pb-3 pt-2">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{m.label}</div>
              <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
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
      <motion.section variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4" style={{ gridArea: 'graph' }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Live Dependency Graph</h3>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">Zoom · Layout · Search</div>
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
        <div className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Active Repositories</div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <motion.article key={i} whileHover={{ y: -2 }} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
              <div className="font-mono text-sm">repo-{i}</div>
              <div className="mt-2 h-1 rounded bg-[var(--bg-active)]">
                <div className="h-full rounded bg-[var(--accent-health)]" style={{ width: `${70 + i * 2}%` }} />
              </div>
              <div className="mt-2 text-xs text-[var(--text-tertiary)]">Updated {i + 1}h ago</div>
            </motion.article>
          ))}
        </div>
      </motion.section>

      {/* Insights */}
      <motion.section variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4" style={{ gridArea: 'insights' }}>
        <div className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">AI Insights</div>
        <div className="space-y-2">
          {['Dependency Risk', 'Velocity Drop', 'Review Bottleneck', 'Security Advisory'].map((t, i) => (
            <motion.div key={t}
              animate={i === 0 ? { boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 0 24px var(--glow-insight)', '0 0 0 rgba(0,0,0,0)'] } : {}}
              transition={{ duration: 4, repeat: Infinity }}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
              <div className="border-l-2 border-[var(--accent-insight)] pl-2 text-[10px] uppercase tracking-[0.08em] text-[var(--accent-insight)]">{t}</div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Service coupling increased 27% in payments chain. Investigate fan-out from gateway.</p>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  )
}
