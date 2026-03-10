import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import { CaretDown, MagnifyingGlass, Minus, Plus } from '@phosphor-icons/react'

type ApiNode = { id: number; name: string; type: string; path?: string; line_number?: number }
type ApiEdge = { source: number; target: number }
type ApiResponse = { nodes: ApiNode[]; edges: ApiEdge[] }

type Node = d3.SimulationNodeDatum & { id: string; name: string; type: string; r: number; path?: string; line_number?: number; connections?: number }
type Link = d3.SimulationLinkDatum<Node>

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

// CodeGraph/GitNexus color palette
const KIND_COLORS: Record<string, string> = {
  function: '#3b82f6', class: '#a855f7', method: '#14b8a6',
  file: '#64748b', module: '#f59e0b', variable: '#f59e0b',
  import: '#64748b', export: '#64748b',
}
function kindColor(type: string): string {
  return KIND_COLORS[type.toLowerCase()] ?? '#3b82f6'
}
function truncLabel(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

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

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const positionsRef = useRef<Node[]>([])
  const lastPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const hoveredRef = useRef<Node | null>(null)

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
    const canvas = canvasRef.current
    if (!canvas) return

    const W = canvas.offsetWidth || 900
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
      connections: conn.get(n.id) ?? 0,
      r: 6 + Math.min((conn.get(n.id) ?? 0) * 1.4, 20),
    }))
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const links: Link[] = filteredEdges
      .filter((e) => nodeById.has(String(e.source)) && nodeById.has(String(e.target)))
      .map((e) => ({ source: nodeById.get(String(e.source))!, target: nodeById.get(String(e.target))! }))

    // Build adjacency for hover highlighting
    const adjacency = new Map<string, Set<string>>()
    nodes.forEach((n) => adjacency.set(n.id, new Set()))
    links.forEach((l) => {
      const sId = typeof l.source === 'object' ? (l.source as Node).id : String(l.source)
      const tId = typeof l.target === 'object' ? (l.target as Node).id : String(l.target)
      adjacency.get(sId)?.add(tId)
      adjacency.get(tId)?.add(sId)
    })

    // Hover detection on canvas
    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const rawX = e.clientX - rect.left
      const rawY = e.clientY - rect.top
      const mx = (rawX - W / 2) / zoom + W / 2
      const my = (rawY - H / 2) / zoom + H / 2
      let found: Node | null = null
      for (const n of nodes) {
        if (n.x == null || n.y == null) continue
        const dx = n.x - mx, dy = n.y! - my
        if (Math.sqrt(dx * dx + dy * dy) <= n.r + 4) { found = n; break }
      }
      hoveredRef.current = found
      canvas.style.cursor = found ? 'pointer' : 'default'
    }
    canvas.addEventListener('mousemove', handleMove)

    // Read previous positions from the persistent ref for smooth transitions
    const prevPositions = new Map(lastPositionsRef.current)

    // ---- Helper: build a tree hierarchy from the graph ----
    function buildHierarchy() {
      // Find root: node with most connections
      let rootId = nodes[0]?.id
      let maxConn = 0
      nodes.forEach((n) => {
        const c = conn.get(Number(n.id)) ?? 0
        if (c > maxConn) { maxConn = c; rootId = n.id }
      })

      // Build adjacency list
      const adj = new Map<string, Set<string>>()
      nodes.forEach((n) => adj.set(n.id, new Set()))
      links.forEach((l) => {
        const sId = typeof l.source === 'object' ? (l.source as Node).id : String(l.source)
        const tId = typeof l.target === 'object' ? (l.target as Node).id : String(l.target)
        adj.get(sId)?.add(tId)
        adj.get(tId)?.add(sId)
      })

      // BFS to build tree structure (handles cycles and disconnected components)
      const visited = new Set<string>()
      type HierNode = { id: string; children: HierNode[] }
      const rootHier: HierNode = { id: rootId, children: [] }
      const queue: HierNode[] = [rootHier]
      visited.add(rootId)

      while (queue.length > 0) {
        const current = queue.shift()!
        const neighbors = adj.get(current.id)
        if (neighbors) {
          neighbors.forEach((nId) => {
            if (!visited.has(nId)) {
              visited.add(nId)
              const child: HierNode = { id: nId, children: [] }
              current.children.push(child)
              queue.push(child)
            }
          })
        }
      }

      // Attach disconnected components as children of root
      nodes.forEach((n) => {
        if (!visited.has(n.id)) {
          visited.add(n.id)
          const orphan: HierNode = { id: n.id, children: [] }
          rootHier.children.push(orphan)
          // BFS from this orphan too
          const oQueue: HierNode[] = [orphan]
          while (oQueue.length > 0) {
            const cur = oQueue.shift()!
            const nbrs = adj.get(cur.id)
            if (nbrs) {
              nbrs.forEach((nId) => {
                if (!visited.has(nId)) {
                  visited.add(nId)
                  const child: HierNode = { id: nId, children: [] }
                  cur.children.push(child)
                  oQueue.push(child)
                }
              })
            }
          }
        }
      })

      return rootHier
    }

    // ---- Helper: compute target positions for Tree and Radial layouts ----
    function computeStaticPositions(): Map<string, { x: number; y: number }> {
      const hierData = buildHierarchy()
      const root = d3.hierarchy(hierData, (d) => d.children)
      const positions = new Map<string, { x: number; y: number }>()

      if (layout === 'Tree') {
        const treeLayout = d3.tree<typeof hierData>().size([W - 80, H - 80])
        treeLayout(root)
        root.each((d) => {
          positions.set(d.data.id, { x: (d.x ?? 0) + 40, y: (d.y ?? 0) + 40 })
        })
      } else {
        // Radial layout
        const radius = Math.min(W, H) / 2 - 60
        const treeLayout = d3.tree<typeof hierData>().size([2 * Math.PI, radius])
        treeLayout(root)
        root.each((d) => {
          const angle = d.x ?? 0
          const r = d.y ?? 0
          positions.set(d.data.id, {
            x: W / 2 + r * Math.cos(angle - Math.PI / 2),
            y: H / 2 + r * Math.sin(angle - Math.PI / 2),
          })
        })
      }

      return positions
    }

    // ---- Rendering function shared across all layouts ----
    let tick = 0
    function draw() {
      tick += 0.014
      positionsRef.current = nodes
      nodes.forEach((n) => {
        if (n.x != null && n.y != null) lastPositionsRef.current.set(n.id, { x: n.x, y: n.y })
      })
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.translate(W / 2, H / 2)
      ctx.scale(zoom, zoom)
      ctx.translate(-W / 2, -H / 2)

      // Dot grid
      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      for (let x = 0; x < W; x += 24) for (let y = 0; y < H; y += 24) ctx.fillRect(x, y, 1, 1)

      const hovered = hoveredRef.current
      const hoveredNeighbors = hovered ? adjacency.get(hovered.id) : null

      // ---- Edges with arrows and hover highlighting ----
      links.forEach((l, i) => {
        const s = l.source as Node
        const t = l.target as Node
        if (s.x == null || t.x == null) return

        const isConnected = hovered && (s.id === hovered.id || t.id === hovered.id)
        const dimmed = hovered && !isConnected
        const alpha = dimmed ? 0.06 : 1

        ctx.save()
        ctx.globalAlpha = alpha
        const color = isConnected ? kindColor(hovered!.type) : 'rgba(108,92,231,0.35)'
        ctx.strokeStyle = color
        ctx.lineWidth = isConnected ? 1.5 : 0.7
        ctx.setLineDash([4, 7])
        ctx.lineDashOffset = -(tick * 28 + i * 0.6)

        const mx = (s.x + t.x) / 2
        const my = (s.y! + t.y!) / 2 - 18
        ctx.beginPath()
        ctx.moveTo(s.x, s.y!)
        ctx.quadraticCurveTo(mx, my, t.x, t.y!)
        ctx.stroke()

        // Arrow head
        const angle = Math.atan2(t.y! - my, t.x - mx)
        const arrowLen = isConnected ? 8 : 5
        const ax = t.x - Math.cos(angle) * (t.r + 2)
        const ay = t.y! - Math.sin(angle) * (t.r + 2)
        ctx.setLineDash([])
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax - arrowLen * Math.cos(angle - 0.4), ay - arrowLen * Math.sin(angle - 0.4))
        ctx.lineTo(ax - arrowLen * Math.cos(angle + 0.4), ay - arrowLen * Math.sin(angle + 0.4))
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      })

      // ---- Nodes with glow, labels, and hover effects ----
      ctx.setLineDash([])
      nodes.forEach((n) => {
        if (n.x == null || n.y == null) return

        const color = kindColor(n.type)
        const isHovered = hovered?.id === n.id
        const isSelected = selected?.id === n.id
        const isNeighbor = hoveredNeighbors?.has(n.id)
        const dimmed = hovered && !isHovered && !isNeighbor
        const alpha = dimmed ? 0.15 : 1

        ctx.save()
        ctx.globalAlpha = alpha

        // Glow
        if (isHovered || isSelected || ((n.connections ?? 0) > 4 && !dimmed)) {
          ctx.shadowColor = color
          ctx.shadowBlur = isHovered ? 18 : isSelected ? 14 : 8
        }

        // Fill
        ctx.fillStyle = '#0d1117'
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()

        // Border
        ctx.shadowBlur = 0
        ctx.strokeStyle = color
        ctx.lineWidth = isHovered || isSelected ? 3 : 2
        ctx.stroke()

        // Inner ring on hover/select
        if (isHovered || isSelected) {
          ctx.strokeStyle = 'rgba(255,255,255,0.15)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r - 3, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Label with dark background pill
        const label = truncLabel(n.name, 16)
        const fontSize = Math.max(8, Math.min(n.r * 0.5, 11))
        ctx.font = `500 ${fontSize}px JetBrains Mono, monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const textWidth = ctx.measureText(label).width
        const labelY = n.y + n.r + 4
        const px = 4, py = 2

        ctx.fillStyle = 'rgba(13,17,23,0.85)'
        ctx.beginPath()
        ctx.roundRect(n.x - (textWidth + px * 2) / 2, labelY - py, textWidth + px * 2, fontSize + py * 2, 3)
        ctx.fill()

        ctx.fillStyle = dimmed ? 'rgba(226,232,240,0.3)' : 'rgba(226,232,240,0.9)'
        ctx.fillText(label, n.x, labelY)

        ctx.restore()
      })
      ctx.restore()
    }

    let cleanupFn: () => void = () => {}

    if (layout === 'Force') {
      // ---- Force layout (original) ----
      const sim = d3
        .forceSimulation(nodes)
        .force('charge', d3.forceManyBody().strength(-130))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('link', d3.forceLink<Node, Link>(links).id((d) => d.id).distance(65))
        .force('collision', d3.forceCollide<Node>().radius((d) => d.r + 5))

      sim.on('tick', draw)
      cleanupFn = () => { sim.stop() }
    } else {
      // ---- Tree / Radial layout (static positioning with animated transition) ----
      const targetPositions = computeStaticPositions()

      // Set starting positions for animation
      nodes.forEach((n) => {
        const prev = prevPositions.get(n.id)
        if (prev) {
          n.x = prev.x
          n.y = prev.y
        } else {
          // Default: center of canvas
          n.x = n.x ?? W / 2
          n.y = n.y ?? H / 2
        }
      })

      // Animate transition over ~500ms (30 frames at ~60fps)
      const TRANSITION_FRAMES = 30
      let frame = 0
      let rafId: number
      let postTransitionRafId: number

      function animateTransition() {
        frame++
        const t = Math.min(frame / TRANSITION_FRAMES, 1)
        // Ease-in-out cubic
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

        nodes.forEach((n) => {
          const target = targetPositions.get(n.id)
          const start = prevPositions.get(n.id) ?? { x: W / 2, y: H / 2 }
          if (target) {
            n.x = start.x + (target.x - start.x) * ease
            n.y = start.y + (target.y - start.y) * ease
          }
        })

        draw()

        if (t < 1) {
          rafId = requestAnimationFrame(animateTransition)
        } else {
          // Snap to final positions
          nodes.forEach((n) => {
            const target = targetPositions.get(n.id)
            if (target) { n.x = target.x; n.y = target.y }
          })
          // Continue drawing for animated dashes
          function postDraw() {
            draw()
            postTransitionRafId = requestAnimationFrame(postDraw)
          }
          postTransitionRafId = requestAnimationFrame(postDraw)
        }
      }

      rafId = requestAnimationFrame(animateTransition)
      cleanupFn = () => {
        cancelAnimationFrame(rafId)
        cancelAnimationFrame(postTransitionRafId)
      }
    }

    return () => { cleanupFn(); canvas.removeEventListener('mousemove', handleMove) }
  }, [filteredEdges, filteredNodes, loading, selected?.id, zoom, layout])

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
                      <input type="checkbox" checked={filters[k]} onChange={() => setFilters((prev) => ({ ...prev, [k]: !prev[k] }))} className="accent-[var(--accent-graph)]" />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: kindColor(k) }} />
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
            <div className="h-full w-full">
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
