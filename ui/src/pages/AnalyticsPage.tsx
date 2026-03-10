import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import {
  ChartLine,
  Code,
  ShieldCheck,
  Warning,
  CaretUp,
  CaretDown,
  ArrowsDownUp,
  SortAscending,
  SortDescending,
} from '@phosphor-icons/react'

const card = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }
const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const sparkSymbols = [
  { v: 460 }, { v: 468 }, { v: 472 }, { v: 478 }, { v: 481 }, { v: 486 }, { v: 488 }, { v: 494 }, { v: 500 },
]
const sparkComplexity = [
  { v: 4.8 }, { v: 4.7 }, { v: 4.6 }, { v: 4.5 }, { v: 4.4 }, { v: 4.3 }, { v: 4.3 }, { v: 4.2 }, { v: 4.2 },
]
const sparkCoverage = [
  { v: 68 }, { v: 69.1 }, { v: 69.8 }, { v: 70.5 }, { v: 71.0 }, { v: 71.3 }, { v: 72.0 }, { v: 73.0 }, { v: 73.4 },
]
const sparkDebt = [
  { v: 15 }, { v: 16 }, { v: 17 }, { v: 18 }, { v: 18 }, { v: 19 }, { v: 20 }, { v: 21 }, { v: 23 },
]

const commitActivity = [
  { month: 'Jan', commits: 210 },
  { month: 'Feb', commits: 185 },
  { month: 'Mar', commits: 260 },
  { month: 'Apr', commits: 240 },
  { month: 'May', commits: 310 },
  { month: 'Jun', commits: 290 },
  { month: 'Jul', commits: 195 },
  { month: 'Aug', commits: 340 },
  { month: 'Sep', commits: 275 },
  { month: 'Oct', commits: 320 },
  { month: 'Nov', commits: 255 },
  { month: 'Dec', commits: 120 },
]

const languageData = [
  { name: 'Python', value: 62, color: '#6c5ce7' },
  { name: 'TypeScript', value: 18, color: '#00d68f' },
  { name: 'Go', value: 12, color: '#ffb84d' },
  { name: 'SQL', value: 5, color: '#45b7d1' },
  { name: 'Other', value: 3, color: '#5e5e78' },
]

const complexityTrend = [
  { month: 'Aug', avg: 3.8, max: 14 },
  { month: 'Sep', avg: 4.0, max: 16 },
  { month: 'Oct', avg: 4.2, max: 18 },
  { month: 'Nov', avg: 4.1, max: 15 },
  { month: 'Dec', avg: 4.3, max: 13 },
  { month: 'Jan', avg: 4.2, max: 12 },
]

const contributors = [
  { name: 'drewmattie', commits: 248 },
  { name: 'ai-bot', commits: 156 },
  { name: 'sarah-chen', commits: 89 },
  { name: 'mike-r', commits: 67 },
  { name: 'jlee', commits: 54 },
  { name: 'alex-k', commits: 41 },
  { name: 'nina-p', commits: 33 },
  { name: 'omar-f', commits: 22 },
]

type HotSpot = {
  file: string
  complexity: number
  changes: number
  lines: number
  coupling: number
  risk: 'Low' | 'Medium' | 'High'
}

const hotSpots: HotSpot[] = [
  { file: 'src/services/auth/session_manager.py', complexity: 32, changes: 18, lines: 480, coupling: 0.87, risk: 'High' },
  { file: 'src/api/routes/payments.py', complexity: 28, changes: 22, lines: 620, coupling: 0.81, risk: 'High' },
  { file: 'src/core/engine/pipeline.py', complexity: 25, changes: 15, lines: 390, coupling: 0.73, risk: 'High' },
  { file: 'src/models/user.py', complexity: 22, changes: 12, lines: 310, coupling: 0.69, risk: 'Medium' },
  { file: 'src/services/billing/invoice.py', complexity: 20, changes: 19, lines: 540, coupling: 0.65, risk: 'High' },
  { file: 'src/api/middleware/rate_limiter.py', complexity: 18, changes: 8, lines: 220, coupling: 0.52, risk: 'Medium' },
  { file: 'src/core/config/settings.py', complexity: 15, changes: 25, lines: 180, coupling: 0.48, risk: 'Medium' },
  { file: 'src/workers/notification_sender.py', complexity: 14, changes: 6, lines: 290, coupling: 0.44, risk: 'Low' },
  { file: 'src/services/analytics/tracker.py', complexity: 13, changes: 9, lines: 340, coupling: 0.41, risk: 'Medium' },
  { file: 'src/api/serializers/order.py', complexity: 12, changes: 5, lines: 260, coupling: 0.38, risk: 'Low' },
  { file: 'src/utils/crypto.py', complexity: 11, changes: 3, lines: 150, coupling: 0.35, risk: 'Low' },
  { file: 'src/services/search/indexer.py', complexity: 10, changes: 7, lines: 410, coupling: 0.56, risk: 'Medium' },
  { file: 'src/core/cache/redis_adapter.py', complexity: 9, changes: 4, lines: 190, coupling: 0.31, risk: 'Low' },
  { file: 'src/api/routes/webhooks.py', complexity: 8, changes: 11, lines: 275, coupling: 0.62, risk: 'Medium' },
  { file: 'src/models/subscription.py', complexity: 7, changes: 3, lines: 130, coupling: 0.28, risk: 'Low' },
]

type SortKey = keyof Pick<HotSpot, 'file' | 'complexity' | 'changes' | 'lines' | 'coupling' | 'risk'>
type SortDir = 'asc' | 'desc'

const riskWeight = { Low: 0, Medium: 1, High: 2 } as const
const riskColor = { Low: 'var(--accent-health)', Medium: 'var(--accent-insight)', High: 'var(--accent-risk)' } as const

// ---------------------------------------------------------------------------
// Custom Recharts tooltip
// ---------------------------------------------------------------------------

function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-xl"
      style={{
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border-default)',
        fontFamily: 'var(--font-display)',
      }}
    >
      {label && <div className="mb-1 text-[var(--text-secondary)]">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--text-tertiary)]">{p.name}:</span>
          <span className="font-semibold text-[var(--text-primary)]" style={numberStyle}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// Pie chart label renderer
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number
}) {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  if (percent < 0.05) return null
  return (
    <text x={x} y={y} fill="var(--text-primary)" textAnchor="middle" dominantBaseline="central" fontSize={12} fontFamily="var(--font-display)">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [sortKey, setSortKey] = useState<SortKey>('complexity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedHotSpots = useMemo(() => {
    const copy = [...hotSpots]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'risk') {
        cmp = riskWeight[a.risk] - riskWeight[b.risk]
      } else if (sortKey === 'file') {
        cmp = a.file.localeCompare(b.file)
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [sortKey, sortDir])

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowsDownUp size={12} className="ml-1 inline opacity-40" />
    return sortDir === 'asc'
      ? <SortAscending size={12} className="ml-1 inline text-[var(--accent-graph)]" />
      : <SortDescending size={12} className="ml-1 inline text-[var(--accent-graph)]" />
  }

  const stats = [
    {
      label: 'Total Symbols',
      value: '500',
      trend: '+12 this week',
      trendUp: true,
      icon: <Code size={18} weight="bold" />,
      spark: sparkSymbols,
      color: 'var(--accent-health)',
    },
    {
      label: 'Avg Complexity',
      value: '4.2',
      trend: '-0.3 this month',
      trendUp: false,
      icon: <ChartLine size={18} weight="bold" />,
      spark: sparkComplexity,
      color: 'var(--accent-health)',
      trendGood: true,
    },
    {
      label: 'Code Coverage',
      value: '73.4%',
      trend: '+2.1%',
      trendUp: true,
      icon: <ShieldCheck size={18} weight="bold" />,
      spark: sparkCoverage,
      color: 'var(--accent-health)',
    },
    {
      label: 'Tech Debt Score',
      value: '23',
      trend: '+5',
      trendUp: true,
      icon: <Warning size={18} weight="bold" />,
      spark: sparkDebt,
      color: 'var(--accent-risk)',
      trendGood: false,
    },
  ]

  return (
    <motion.div
      initial="initial"
      animate="animate"
      transition={{ staggerChildren: 0.07 }}
      className="space-y-5 p-5"
    >
      {/* Header */}
      <motion.header variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4">
        <h1 className="text-3xl font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>
          Analytics
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Codebase health metrics, activity trends, and complexity analysis.
        </p>
      </motion.header>

      {/* Top Stats Row */}
      <motion.div variants={card} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, _i) => {
          const isGoodTrend = s.trendGood !== undefined ? s.trendGood : s.trendUp
          const trendColor = isGoodTrend ? 'var(--accent-health)' : 'var(--accent-risk)'
          return (
            <motion.div
              key={s.label}
              variants={card}
              whileHover={{ y: -2 }}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">{s.label}</span>
                <span className="text-[var(--text-tertiary)]">{s.icon}</span>
              </div>
              <div className="mt-2 text-3xl font-bold text-[var(--text-primary)]" style={numberStyle}>
                {s.value}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: trendColor }}>
                {s.trendUp ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
                {s.trend}
              </div>
              <div className="mt-2 h-[50px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.spark}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Commit Activity */}
        <motion.div variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Commit Activity
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={commitActivity}>
                <defs>
                  <linearGradient id="commitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6c5ce7" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#6c5ce7" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-display)' }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-display)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<DarkTooltip />} />
                <Area
                  type="monotone"
                  dataKey="commits"
                  stroke="#6c5ce7"
                  strokeWidth={2}
                  fill="url(#commitGrad)"
                  dot={false}
                  activeDot={{ r: 4, stroke: '#6c5ce7', strokeWidth: 2, fill: 'var(--bg-elevated)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Language Distribution */}
        <motion.div variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Language Distribution
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={languageData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  labelLine={false}
                  label={renderPieLabel as unknown as boolean}
                  stroke="var(--bg-raised)"
                  strokeWidth={2}
                >
                  {languageData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => {
                    const item = languageData.find((d) => d.name === value)
                    return (
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 11 }}>
                        {value} {item ? `${item.value}%` : ''}
                      </span>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Complexity Trend */}
        <motion.div variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Complexity Trend
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={complexityTrend}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-display)' }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-display)' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 20]}
                />
                <Tooltip content={<DarkTooltip />} />
                <ReferenceLine
                  y={10}
                  stroke="#ffb84d"
                  strokeDasharray="6 4"
                  label={{
                    value: 'Warning threshold',
                    position: 'insideTopRight',
                    fill: '#ffb84d',
                    fontSize: 11,
                    fontFamily: 'var(--font-display)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  name="Avg Complexity"
                  stroke="#45b7d1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#45b7d1', stroke: '#45b7d1' }}
                  activeDot={{ r: 5, stroke: '#45b7d1', strokeWidth: 2, fill: 'var(--bg-elevated)' }}
                />
                <Line
                  type="monotone"
                  dataKey="max"
                  name="Max Complexity"
                  stroke="#ff6b6b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#ff6b6b', stroke: '#ff6b6b' }}
                  activeDot={{ r: 5, stroke: '#ff6b6b', strokeWidth: 2, fill: 'var(--bg-elevated)' }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="line"
                  iconSize={12}
                  formatter={(value: string) => (
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 11 }}>
                      {value}
                    </span>
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top Contributors */}
        <motion.div variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Top Contributors
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contributors} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-display)' }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-display)' }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="commits" fill="#6c5ce7" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Hot Spots Table */}
      <motion.div variants={card} className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)]">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Hot Spots
          </h3>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Most complex and most-changed files. Click column headers to sort.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-y border-[var(--border-subtle)] bg-[var(--bg-base)]">
                {([
                  ['file', 'File'],
                  ['complexity', 'Complexity'],
                  ['changes', 'Changes (30d)'],
                  ['lines', 'Lines'],
                  ['coupling', 'Coupling Score'],
                  ['risk', 'Risk'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="cursor-pointer select-none whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] transition hover:text-[var(--text-primary)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {label}
                    <SortIcon col={key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedHotSpots.map((row) => (
                <tr
                  key={row.file}
                  className="border-b border-[var(--border-subtle)] transition hover:bg-[var(--bg-hover)]"
                >
                  <td className="px-5 py-3 font-mono text-xs text-[var(--text-primary)]">{row.file}</td>
                  <td className="px-5 py-3 text-xs" style={numberStyle}>{row.complexity}</td>
                  <td className="px-5 py-3 text-xs" style={numberStyle}>{row.changes}</td>
                  <td className="px-5 py-3 text-xs" style={numberStyle}>{row.lines}</td>
                  <td className="px-5 py-3 text-xs" style={numberStyle}>{row.coupling.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                      style={{
                        color: riskColor[row.risk],
                        background: `color-mix(in srgb, ${riskColor[row.risk]} 14%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${riskColor[row.risk]} 30%, transparent)`,
                      }}
                    >
                      {row.risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}
