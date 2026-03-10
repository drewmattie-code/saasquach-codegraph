import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'

type ChangeType = 'commit' | 'pr' | 'review'

type Change = {
  id: string
  type: ChangeType
  hash: string
  message: string
  author: string
  initials: string
  time: string
  file: string
  stats: string
  diff: Array<{ kind: 'add' | 'remove' | 'context'; oldNo?: number; newNo?: number; text: string }>
}

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

const changes: Change[] = [
  ['a3f2b1c', 'commit', 'Refactor dependency graph hit-testing', 'Alex Kim', 'AK', '5m ago', 'ui/src/pages/GraphExplorerPage.tsx', '+42 -12'],
  ['be72f9a', 'pr', 'Merge PR #184 optimize complexity analyzer', 'Morgan Lee', 'ML', '14m ago', 'api/analysis/complexity.py', '+88 -31'],
  ['09d2afe', 'review', 'Review comments resolved in pipelines board', 'Taylor Fox', 'TF', '19m ago', 'ui/src/pages/PipelinesPage.tsx', '+16 -4'],
  ['f8ab210', 'commit', 'Add dead-code endpoint caching', 'Jordan Park', 'JP', '32m ago', 'api/analysis/dead_code.py', '+37 -6'],
  ['31cb7de', 'commit', 'Tune health score formula for repos', 'Dana Cole', 'DC', '47m ago', 'api/stats.py', '+21 -8'],
  ['77bb1fe', 'pr', 'Merge PR #183 settings panel sections', 'Riley Hart', 'RH', '1h ago', 'ui/src/pages/SettingsPage.tsx', '+54 -19'],
  ['ac09e7a', 'review', 'Requested changes on SQL sanitization', 'Sam Noor', 'SN', '1h ago', 'api/routes/search.py', '+12 -3'],
  ['73fdd20', 'commit', 'Normalize repo path display utility', 'Nia Grant', 'NG', '2h ago', 'ui/src/utils/path.ts', '+18 -2'],
  ['0df82aa', 'pr', 'Merge PR #182 card motion polish', 'Chris Bolt', 'CB', '3h ago', 'ui/src/pages/InsightsPage.tsx', '+43 -13'],
  ['445de10', 'commit', 'Add flow badges for running jobs', 'Ira Moss', 'IM', '4h ago', 'ui/src/pages/PipelinesPage.tsx', '+26 -7'],
  ['8ab90ff', 'review', 'Approve risk scoring thresholds', 'Pat Wong', 'PW', '5h ago', 'ui/src/pages/RisksPage.tsx', '+11 -5'],
  ['f18ca4d', 'commit', 'Refine skeleton shimmer timings', 'Ari Gray', 'AG', '6h ago', 'ui/src/styles/index.css', '+9 -1'],
].map((r) => ({
  id: r[0] as string,
  hash: r[0] as string,
  type: r[1] as ChangeType,
  message: r[2] as string,
  author: r[3] as string,
  initials: r[4] as string,
  time: r[5] as string,
  file: r[6] as string,
  stats: r[7] as string,
  diff: [
    { kind: 'context', oldNo: 28, newNo: 28, text: 'const sim = d3.forceSimulation(nodes)' },
    { kind: 'remove', oldNo: 29, text: "  .force('charge', d3.forceManyBody().strength(-90))" },
    { kind: 'add', newNo: 29, text: "  .force('charge', d3.forceManyBody().strength(-130))" },
    { kind: 'add', newNo: 30, text: "  .force('collision', d3.forceCollide().radius(d => d.r + 5))" },
    { kind: 'context', oldNo: 31, newNo: 31, text: '  .force(\'link\', forceLink)' },
    { kind: 'remove', oldNo: 48, text: 'ctx.lineWidth = 0.5' },
    { kind: 'add', newNo: 49, text: 'ctx.lineWidth = 0.9' },
  ],
}))

const filterMap = { All: null, Commits: 'commit', 'Pull Requests': 'pr', Reviews: 'review' } as const

export default function ChangesPage() {
  const [filter, setFilter] = useState<keyof typeof filterMap>('All')
  const [selected, setSelected] = useState(changes[0])

  const list = useMemo(() => {
    const t = filterMap[filter]
    return t ? changes.filter((c) => c.type === t) : changes
  }, [filter])

  const colorFor = (type: ChangeType) => (type === 'commit' ? 'var(--accent-change)' : type === 'pr' ? 'var(--accent-graph)' : 'var(--accent-insight)')

  return (
    <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.06 }} className="space-y-4 p-5">
      <motion.header variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4">
        <h1 className="text-3xl font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Changes</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Live engineering activity across commits, pull requests, and code reviews.</p>
      </motion.header>

      <motion.section variants={card} className="inline-flex rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-1">
        {(Object.keys(filterMap) as Array<keyof typeof filterMap>).map((key) => (
          <button key={key} onClick={() => setFilter(key)} className={`rounded-lg px-4 py-1.5 text-sm transition ${filter === key ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>
            {key}
          </button>
        ))}
      </motion.section>

      <motion.section variants={card} className="flex gap-4">
        <div className="w-[380px] space-y-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-3">
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`w-full rounded-xl border px-3 py-2 text-left transition hover:bg-[var(--bg-hover)] ${selected.id === c.id ? 'border-[var(--border-strong)] bg-[var(--bg-elevated)]' : 'border-[var(--border-subtle)] bg-[var(--bg-base)]'}`}
              style={{ borderLeftWidth: 3, borderLeftColor: colorFor(c.type) }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold" style={numberStyle}>{c.hash.slice(0, 7)}</span>
                <span className="text-[10px] text-[var(--text-tertiary)]">{c.time}</span>
              </div>
              <div className="truncate text-sm text-[var(--text-primary)]">{c.message}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span className="grid h-5 w-5 place-items-center rounded-full text-[10px] text-[var(--text-inverse)]" style={{ background: colorFor(c.type) }}>{c.initials}</span>
                <span>{c.author}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm" style={{ fontFamily: 'var(--font-display)' }}>{selected.file}</div>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs" style={numberStyle}>{selected.stats}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]">
            {selected.diff.map((line, i) => (
              <div
                key={i}
                className="grid grid-cols-[72px_1fr] border-b border-[var(--border-subtle)] px-3 py-1.5 text-sm"
                style={{
                  fontFamily: 'var(--font-display)',
                  background:
                    line.kind === 'add' ? 'rgba(0,214,143,0.08)' : line.kind === 'remove' ? 'rgba(255,107,107,0.08)' : 'transparent',
                  color: line.kind === 'add' ? 'var(--accent-health)' : line.kind === 'remove' ? 'var(--accent-risk)' : 'var(--text-primary)',
                  borderLeft: line.kind === 'add' ? '2px solid rgba(0,214,143,0.4)' : line.kind === 'remove' ? '2px solid rgba(255,107,107,0.4)' : '2px solid transparent',
                }}
              >
                <div className="pr-3 text-xs text-[var(--text-tertiary)]" style={numberStyle}>
                  {(line.oldNo ?? '').toString().padStart(2, ' ')} {(line.newNo ?? '').toString().padStart(2, ' ')}
                </div>
                <div>{line.text}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>
    </motion.div>
  )
}
