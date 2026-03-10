import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

type NodeKind = 'function' | 'class' | 'method' | 'file' | 'module' | 'variable' | 'import' | 'export'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string; name: string; kind: NodeKind; r: number; connections: number
}
interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  weight: number; edgeKind: string
}
interface ApiResponse {
  nodes: Array<{ id: number; name: string; type: string }>
  edges: Array<{ id: number; source: number; target: number; type?: string; kind?: string }>
}

// CodeGraph/GitNexus color palette — type-specific
const KIND_COLORS: Record<string, string> = {
  function: '#3b82f6',
  class:    '#a855f7',
  method:   '#14b8a6',
  file:     '#64748b',
  module:   '#f59e0b',
  variable: '#f59e0b',
  import:   '#64748b',
  export:   '#64748b',
}

const EDGE_STYLES: Record<string, { color: string; dash: number[] }> = {
  calls:   { color: 'rgba(59,130,246,0.45)', dash: [] },
  defines: { color: 'rgba(71,85,105,0.35)',  dash: [] },
  imports: { color: 'rgba(148,163,184,0.3)', dash: [5, 6] },
}
const DEFAULT_EDGE = { color: 'rgba(108,92,231,0.3)', dash: [4, 7] }

function nodeColor(kind: string): string {
  return KIND_COLORS[kind.toLowerCase()] ?? '#3b82f6'
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export function DependencyGraphCanvas() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoveredRef = useRef<GraphNode | null>(null)
  const [ready, setReady] = useState(false)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [links, setLinks] = useState<GraphLink[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/graph?limit=300')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data: ApiResponse) => {
        if (cancelled) return
        const conn = new Map<string, number>()
        data.edges.forEach(e => {
          const s = String(e.source), t = String(e.target)
          conn.set(s, (conn.get(s) ?? 0) + 1)
          conn.set(t, (conn.get(t) ?? 0) + 1)
        })
        const ns: GraphNode[] = data.nodes.map(n => {
          const kind = (n.type || 'function').toLowerCase() as NodeKind
          const c = conn.get(String(n.id)) ?? 0
          return { id: String(n.id), name: n.name, kind, connections: c, r: 8 + Math.min(c * 2, 22) }
        })
        const nodeIdSet = new Set(ns.map(n => n.id))
        const ls: GraphLink[] = data.edges
          .filter(e => nodeIdSet.has(String(e.source)) && nodeIdSet.has(String(e.target)))
          .map(e => ({ source: String(e.source), target: String(e.target), weight: 1, edgeKind: e.kind ?? e.type ?? 'calls' }))
        setNodes(ns); setLinks(ls); setReady(true)
      })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!ready || nodes.length === 0) return
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return

    const W = wrapper.clientWidth || wrapper.offsetWidth || 800
    const H = 410
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    const simNodes: GraphNode[] = nodes.map(n => ({ ...n }))
    const nodeById = new Map(simNodes.map(n => [n.id, n]))
    const simLinks: GraphLink[] = links.map(l => ({
      source: nodeById.get(l.source as string) ?? (l.source as string),
      target: nodeById.get(l.target as string) ?? (l.target as string),
      weight: l.weight,
      edgeKind: l.edgeKind,
    }))

    // Build adjacency for hover highlighting
    const adjacency = new Map<string, Set<string>>()
    simNodes.forEach(n => adjacency.set(n.id, new Set()))
    simLinks.forEach(l => {
      const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : String(l.source)
      const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : String(l.target)
      adjacency.get(sId)?.add(tId)
      adjacency.get(tId)?.add(sId)
    })

    const sim = d3.forceSimulation(simNodes)
      .force('charge', d3.forceManyBody().strength(-140))
      .force('link', d3.forceLink<GraphNode, GraphLink>(simLinks).id(d => d.id).distance(70))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => d.r + 8))

    // Hover detection
    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      let found: GraphNode | null = null
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue
        const dx = n.x - mx, dy = n.y! - my
        if (Math.sqrt(dx * dx + dy * dy) <= n.r + 4) { found = n; break }
      }
      hoveredRef.current = found
      canvas.style.cursor = found ? 'pointer' : 'default'
    }
    canvas.addEventListener('mousemove', handleMove)

    let t = 0
    sim.on('tick', () => {
      t += 0.012
      ctx.clearRect(0, 0, W, H)

      // Dot grid background
      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      for (let x = 0; x < W; x += 24) for (let y = 0; y < H; y += 24) ctx.fillRect(x, y, 1, 1)

      const hovered = hoveredRef.current
      const hoveredNeighbors = hovered ? adjacency.get(hovered.id) : null

      // ---- Edges ----
      simLinks.forEach((l, i) => {
        const s = l.source as GraphNode, tgt = l.target as GraphNode
        if (s.x == null || tgt.x == null) return

        const style = EDGE_STYLES[l.edgeKind] ?? DEFAULT_EDGE
        const isConnected = hovered && (s.id === hovered.id || tgt.id === hovered.id)
        const alpha = hovered ? (isConnected ? 1 : 0.08) : 1

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.strokeStyle = isConnected ? nodeColor(hovered!.kind) : style.color
        ctx.lineWidth = isConnected ? 1.5 : 0.7
        ctx.setLineDash(style.dash)
        if (style.dash.length > 0) ctx.lineDashOffset = -(t * 25 + i * 0.5)

        // Draw curved edge
        const mx = (s.x + tgt.x) / 2
        const my = (s.y! + tgt.y!) / 2 - 18
        ctx.beginPath()
        ctx.moveTo(s.x, s.y!)
        ctx.quadraticCurveTo(mx, my, tgt.x, tgt.y!)
        ctx.stroke()

        // Arrow head at target
        const angle = Math.atan2(tgt.y! - my, tgt.x - mx)
        const arrowLen = isConnected ? 8 : 6
        const ax = tgt.x - Math.cos(angle) * (tgt.r + 2)
        const ay = tgt.y! - Math.sin(angle) * (tgt.r + 2)
        ctx.fillStyle = isConnected ? nodeColor(hovered!.kind) : style.color
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax - arrowLen * Math.cos(angle - 0.4), ay - arrowLen * Math.sin(angle - 0.4))
        ctx.lineTo(ax - arrowLen * Math.cos(angle + 0.4), ay - arrowLen * Math.sin(angle + 0.4))
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      })

      // ---- Nodes ----
      ctx.setLineDash([])
      simNodes.forEach(n => {
        if (n.x == null || n.y == null) return

        const color = nodeColor(n.kind)
        const isHovered = hovered?.id === n.id
        const isNeighbor = hoveredNeighbors?.has(n.id)
        const dimmed = hovered && !isHovered && !isNeighbor
        const alpha = dimmed ? 0.15 : 1

        ctx.save()
        ctx.globalAlpha = alpha

        // Glow effect for hovered/high-connection nodes
        if (isHovered || (n.connections > 4 && !dimmed)) {
          ctx.shadowColor = color
          ctx.shadowBlur = isHovered ? 18 : 8
        }

        // Fill
        ctx.fillStyle = '#0d1117'
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()

        // Border
        ctx.shadowBlur = 0
        ctx.strokeStyle = color
        ctx.lineWidth = isHovered ? 3 : 2
        ctx.stroke()

        // Inner highlight ring
        if (isHovered) {
          ctx.strokeStyle = 'rgba(255,255,255,0.15)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(n.x, n.y, n.r - 3, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Label — always visible, with dark background pill
        const label = truncate(n.name, 14)
        const fontSize = Math.max(8, Math.min(n.r * 0.5, 11))
        ctx.font = `500 ${fontSize}px JetBrains Mono, monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const textWidth = ctx.measureText(label).width
        const labelY = n.y + n.r + 4

        // Background pill
        const px = 4, py = 2
        ctx.fillStyle = 'rgba(13,17,23,0.85)'
        const pillW = textWidth + px * 2
        const pillH = fontSize + py * 2
        const pillR = 3
        ctx.beginPath()
        ctx.roundRect(n.x - pillW / 2, labelY - py, pillW, pillH, pillR)
        ctx.fill()

        // Text
        ctx.fillStyle = dimmed ? 'rgba(226,232,240,0.3)' : 'rgba(226,232,240,0.9)'
        ctx.fillText(label, n.x, labelY)

        ctx.restore()
      })
    })

    return () => { sim.stop(); canvas.removeEventListener('mousemove', handleMove) }
  }, [ready, nodes, links])

  if (error) return (
    <div className="flex h-[410px] w-full items-center justify-center rounded-xl bg-[var(--bg-base)]">
      <span className="text-xs text-[var(--accent-risk)]">Graph error: {error}</span>
    </div>
  )

  if (!ready) return (
    <div className="flex h-[410px] w-full items-center justify-center rounded-xl bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-graph)] border-t-transparent" />
        <span className="font-mono text-xs text-[var(--text-tertiary)]">Loading {nodes.length > 0 ? nodes.length : '…'} nodes</span>
      </div>
    </div>
  )

  return (
    <div ref={wrapperRef} className="w-full">
      <canvas ref={canvasRef} className="rounded-xl bg-[var(--bg-base)]" />
    </div>
  )
}
