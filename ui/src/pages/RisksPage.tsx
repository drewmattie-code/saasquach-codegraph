import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

type Complexity = { function_name: string; path: string; complexity: number; line_number: number }
type DeadCode = { function_name: string; path: string; line_number: number }
type DeadCodeResponse = { potentially_unused_functions: DeadCode[] }

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

const short = (p: string) => p.split('/').filter(Boolean).slice(-2).join('/') || p

function RiskRing({ value }: { value: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const offset = c * (1 - value / 100)
  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <svg width="124" height="124" className="-rotate-90">
        <circle cx="62" cy="62" r={r} stroke="var(--border-default)" strokeWidth="10" fill="none" />
        <circle cx="62" cy="62" r={r} stroke="var(--accent-insight)" strokeWidth="10" fill="none" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute text-3xl font-bold" style={numberStyle}>{value}</div>
    </div>
  )
}

export default function RisksPage() {
  const [complexity, setComplexity] = useState<Complexity[]>([])
  const [deadCode, setDeadCode] = useState<DeadCode[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/analysis/complexity?limit=20').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/analysis/dead-code?limit=20').then((r) => (r.ok ? r.json() : { potentially_unused_functions: [] })),
    ]).then(([cx, dc]: [Complexity[], DeadCodeResponse]) => {
      setComplexity(cx)
      setDeadCode(dc.potentially_unused_functions)
    })
  }, [])

  const topComplex = useMemo(() => [...complexity].sort((a, b) => b.complexity - a.complexity).slice(0, 8), [complexity])
  const maxComplex = topComplex[0]?.complexity ?? 1

  const mockRisks = [
    ['Dependency: requests 2.28.0', 'CVE-2023-32681', 'HIGH'],
    ['Hardcoded credentials pattern', '2 locations', 'CRITICAL'],
    ['SQL injection risk', 'unparameterized query', 'MEDIUM'],
    ['Outdated dependency: cryptography', 'update available', 'LOW'],
    ['Missing input validation', 'API endpoint', 'MEDIUM'],
  ] as const

  const sevColor = (s: string) => (s === 'CRITICAL' || s === 'HIGH' ? 'var(--accent-risk)' : s === 'MEDIUM' ? 'var(--accent-insight)' : 'var(--accent-health)')

  return (
    <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.06 }} className="space-y-4 p-5">
      <motion.header variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4">
        <h1 className="text-3xl font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Risks</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Security posture and technical debt concentration across code intelligence signals.</p>
      </motion.header>

      <motion.section variants={card} className="flex items-center justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4">
        <div>
          <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Risk score · moderate</div>
          <div className="text-6xl font-bold text-[var(--accent-insight)]" style={numberStyle}>73</div>
          <div className="mt-2 flex gap-5 text-sm">
            <span>Security <strong style={numberStyle}>32</strong> issues</span>
            <span>Tech Debt <strong style={numberStyle}>18</strong> issues</span>
            <span>Dependencies <strong style={numberStyle}>5</strong> issues</span>
          </div>
        </div>
        <RiskRing value={73} />
      </motion.section>

      <motion.section variants={card} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Dead Code</h3>
            <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-xs" style={numberStyle}>{deadCode.length}</span>
          </div>
          <div className="space-y-2">
            {deadCode.slice(0, 10).map((d, i) => (
              <div key={`${d.function_name}-${i}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2" style={{ borderLeftWidth: 3, borderLeftColor: 'var(--accent-risk)' }}>
                <div className="text-xs font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{d.function_name}</div>
                <div className="text-[11px] text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>{short(d.path)}</div>
                <div className="text-[11px] text-[var(--text-secondary)]" style={numberStyle}>line {d.line_number}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
          <h3 className="mb-3 text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Complexity Hotspots</h3>
          <div className="space-y-2">
            {topComplex.map((c, i) => {
              const width = (c.complexity / maxComplex) * 100
              const color = c.complexity < 20 ? 'var(--accent-health)' : c.complexity <= 40 ? 'var(--accent-insight)' : 'var(--accent-risk)'
              return (
                <div key={`${c.function_name}-${i}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate" style={{ fontFamily: 'var(--font-display)' }}>{c.function_name}</span>
                    <span style={numberStyle}>{c.complexity}</span>
                  </div>
                  <div className="h-1.5 rounded bg-[var(--bg-elevated)]"><div className="h-full rounded" style={{ width: `${width}%`, background: color }} /></div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
          <h3 className="mb-3 text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Security & Dependencies</h3>
          <div className="space-y-2">
            {mockRisks.map(([title, detail, sev]) => (
              <div key={title} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2 transition hover:bg-[var(--bg-hover)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-primary)]">{title}</span>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] tracking-[0.08em]" style={{ color: sevColor(sev), borderColor: sevColor(sev) }}>{sev}</span>
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>
    </motion.div>
  )
}
