import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import { CaretDown, MagnifyingGlass, Minus, Plus } from '@phosphor-icons/react'

type ApiNode = { id: number; name: string; type: string; path?: string; line_number?: number }
type ApiEdge = { source: number; target: number }
type ApiResponse = { nodes: ApiNode[]; edges: ApiEdge[] }

type Node = d3.SimulationNodeDatum & { id: string; name: string; type: string; r: number; path?: string; line_number?: number }
type Link = d3.SimulationLinkDatum<Node>

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

export default function GraphExplorerPage() {
  const [apiNodes, setApiNodes] = useState<ApiNode[]>([])
  const [apiEdges, setApiEdges] = useState<ApiEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useState<'Force' | 'Tree' | 'Radial'>('Force')
  const [filters, setFilters] = useState<Record<string, boolean>>({ function: true, class: true, file: true })
  const [selected, setSelected] = useState<Node | null>(null)
  const [zoom, setZoom] = useState(1)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const positionsRef = useRef<Node[]>([])

  useEffect(() => {
    fetch('/api/graph?limit=500')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ApiResponse) => {
        setApiNodes(data.nodes)
        setApiEdges(data.edges)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apiNodes.filter((n) => {
      const t = (n.type || 'function').toLowerCase()
      const inFilter = filters[t] ?? true
      if (!inFilter) return false
      if (!q) return true
      return n.name.toLowerCase().includes(q)
    })
  }, [apiNodes, filters, query])

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes])
  const filteredEdges = useMemo(
    () => apiEdges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)),
    [apiEdges, filteredNodeIds],
  )

  const typeCounts = useMemo(() => {
    const base = { function: 0, class: 0, file: 0 }
    apiNodes.forEach((n) => {
      const t = (n.type || 'function').toLowerCase() as keyof typeof base
      if (t in base) base[t] += 1
    })
    return base
  }, [apiNodes])

  useEffect(() => {
    if (loading) return
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return

    const W = wrapper.clientWidth || 900
    const H = Math.max(420, window.innerHeight - 120)
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    const conn = new Map<number, number>()
    filteredEdges.forEach((e) => {
      conn.set(e.source, (conn.get(e.source) ?? 0) + 1)
      conn.set(e.target, (conn.get(e.target) ?? 0) + 1)
    })

    const nodes: Node[] = filteredNodes.map((n) => ({
      id: String(n.id),
      name: n.name,
      type: n.type,
      path: n.path,
      line_number: n.line_number,
      r: 6 + Math.min((conn.get(n.id) ?? 0) * 1.4, 20),
    }))
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const links: Link[] = filteredEdges.map((e) => ({ source: nodeById.get(String(e.source))!, target: nodeById.get(String(e.target))! }))

    const sim = d3
      .forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-130))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('link', d3.forceLink<Node, Link>(links).id((d) => d.id).distance(65))
      .force('collision', d3.forceCollide<Node>().radius((d) => d.r + 5))

    let tick = 0
    sim.on('tick', () => {
      tick += 0.014
      positionsRef.current = nodes
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.translate(W / 2, H / 2)
      ctx.scale(zoom, zoom)
      ctx.translate(-W / 2, -H / 2)

      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      for (let x = 0; x < W; x += 24) for (let y = 0; y < H; y += 24) ctx.fillRect(x, y, 1, 1)

      links.forEach((l, i) => {
        const s = l.source as Node
        const t = l.target as Node
        if (s.x == null || t.x == null) return
        ctx.strokeStyle = 'rgba(108,92,231,0.35)'
        ctx.lineWidth = 0.9
        ctx.setLineDash([4, 7])
        ctx.lineDashOffset = -(tick * 28 + i * 0.6)
        ctx.beginPath()
        ctx.moveTo(s.x, s.y!)
        ctx.quadraticCurveTo((s.x + t.x) / 2, (s.y! + t.y!) / 2 - 22, t.x, t.y!)
        ctx.stroke()
      })

      ctx.setLineDash([])
      nodes.forEach((n) => {
        if (n.x == null || n.y == null) return
        const c = n.type.toLowerCase() === 'class' ? 'var(--accent-insight)' : n.type.toLowerCase() === 'file' ? 'var(--accent-flow)' : 'var(--accent-health)'
        ctx.fillStyle = 'rgba(12,12,20,0.95)'
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = c
        ctx.lineWidth = selected?.id === n.id ? 3 : 2
        ctx.stroke()
      })
      ctx.restore()
    })

    return () => { sim.stop() }
  }, [filteredEdges, filteredNodes, loading, selected?.id, zoom])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const W = rect.width
    const H = rect.height
    const mx = (e.clientX - rect.left - W / 2) / zoom + W / 2
    const my = (e.clientY - rect.top - H / 2) / zoom + H / 2

    const hit = positionsRef.current.find((n) => {
      if (n.x == null || n.y == null) return false
      const dx = n.x - mx
      const dy = n.y - my
      return Math.sqrt(dx * dx + dy * dy) <= n.r + 4
    })
    if (hit) setSelected(hit)
  }

  const resetView = () => setZoom(1)

  return (
    <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.06 }} className="space-y-4 p-5">
      <motion.header variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4">
        <h1 className="text-3xl font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Graph Explorer</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Inspect node topology, trace dependencies, and isolate coupling hotspots.</p>
      </motion.header>

      <motion.section variants={card} className="flex gap-4">
        <aside className={`${sidebarOpen ? 'w-[280px]' : 'w-[56px]'} shrink-0 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-3 transition-all`}>
          <button type="button" onClick={() => setSidebarOpen((v) => !v)} className="mb-3 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">
            {sidebarOpen ? 'Collapse' : '>'}
          </button>
          {sidebarOpen && (
            <>
              <div className="relative mb-4">
                <MagnifyingGlass size={14} className="absolute left-3 top-2.5 text-[var(--text-tertiary)]" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search nodes..." className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--accent-graph)]" />
              </div>
              <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 text-sm">
                {(['function', 'class', 'file'] as const).map((k) => (
                  <label key={k} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 capitalize">
                      <input type="checkbox" checked={filters[k]} onChange={() => setFilters((prev) => ({ ...prev, [k]: !prev[k] }))} />
                      {k}
                    </span>
                    <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-xs" style={numberStyle}>{typeCounts[k]}</span>
                  </label>
                ))}
              </div>

              {selected && (
                <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                  <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{selected.name}</div>
                  <div className="mt-1 inline-block rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">{selected.type}</div>
                  <div className="mt-2 truncate text-xs text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>{selected.path ?? 'Path unavailable'}</div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]" style={numberStyle}>Line: {selected.line_number ?? '—'}</div>
                  <button type="button" className="mt-3 w-full rounded-lg border border-[var(--border-default)] bg-transparent px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">View in context</button>
                </div>
              )}
            </>
          )}
        </aside>

        <div className="relative flex-1 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)]" style={{ height: 'calc(100vh - 180px)' }}>
          {loading ? (
            <div className="h-full w-full animate-pulse bg-[linear-gradient(90deg,var(--bg-raised)_25%,var(--bg-hover)_50%,var(--bg-raised)_75%)] [background-size:200%_100%]" />
          ) : (
            <div ref={wrapperRef} className="h-full w-full">
              <canvas ref={canvasRef} onClick={handleCanvasClick} className="h-full w-full" />
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[rgba(19,19,31,0.78)] px-3 py-2 backdrop-blur-xl">
            <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-1 hover:bg-[var(--bg-hover)]"><Minus size={14} /></button>
            <button onClick={() => setZoom((z) => Math.min(2.2, z + 0.1))} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-1 hover:bg-[var(--bg-hover)]"><Plus size={14} /></button>
            <button onClick={resetView} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">Reset view</button>
            <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-xs" style={numberStyle}>{filteredNodes.length} nodes</span>
            <button className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]" onClick={() => setLayout((v) => (v === 'Force' ? 'Tree' : v === 'Tree' ? 'Radial' : 'Force'))}>
              {layout} <CaretDown size={12} />
            </button>
          </div>
        </div>
      </motion.section>
    </motion.div>
  )
}
