import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

type NodeHealth = 'good' | 'warn' | 'risk'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string; name: string; health: NodeHealth; r: number
}
interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  weight: number
}
interface ApiResponse {
  nodes: Array<{ id: number; name: string; type: string }>
  edges: Array<{ id: number; source: number; target: number; type?: string; kind?: string }>
}

export function DependencyGraphCanvas() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
          const type = (n.type ?? '').toLowerCase()
          const health: NodeHealth = type === 'class' ? 'warn' : (type === 'file' || type === 'module') ? 'risk' : 'good'
          return { id: String(n.id), name: n.name, health, r: 8 + Math.min((conn.get(String(n.id)) ?? 0) * 2, 24) }
        })
        const ls: GraphLink[] = data.edges.map(e => ({ source: String(e.source), target: String(e.target), weight: 1 }))
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
    }))

    const sim = d3.forceSimulation(simNodes)
      .force('charge', d3.forceManyBody().strength(-120))
      .force('link', d3.forceLink<GraphNode, GraphLink>(simLinks).id(d => d.id).distance(60))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius(d => d.r + 6))

    const healthColor = (h: NodeHealth) =>
      h === 'good' ? '#00D68F' : h === 'warn' ? '#FFB84D' : '#45B7D1'

    let t = 0
    sim.on('tick', () => {
      t += 0.015
      ctx.clearRect(0, 0, W, H)
      // dot grid
      ctx.fillStyle = 'rgba(255,255,255,0.02)'
      for (let x = 0; x < W; x += 24) for (let y = 0; y < H; y += 24) ctx.fillRect(x, y, 1, 1)
      // edges
      simLinks.forEach((l, i) => {
        const s = l.source as GraphNode, tgt = l.target as GraphNode
        if (s.x == null || tgt.x == null) return
        ctx.strokeStyle = 'rgba(108,92,231,0.4)'
        ctx.lineWidth = 0.75
        ctx.setLineDash([4, 7])
        ctx.lineDashOffset = -(t * 25 + i * 0.5)
        ctx.beginPath()
        ctx.moveTo(s.x, s.y!)
        ctx.quadraticCurveTo((s.x + tgt.x) / 2, (s.y! + tgt.y!) / 2 - 20, tgt.x, tgt.y!)
        ctx.stroke()
      })
      // nodes
      ctx.setLineDash([])
      simNodes.forEach(n => {
        if (n.x == null || n.y == null) return
        ctx.fillStyle = '#0C0C14'
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = healthColor(n.health)
        ctx.lineWidth = 2; ctx.stroke()
        if (n.r > 14) {
          ctx.fillStyle = 'rgba(232,232,240,0.85)'
          ctx.font = `${Math.min(n.r * 0.55, 10)}px JetBrains Mono, monospace`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(n.name.length > 12 ? n.name.slice(0, 11) + '…' : n.name, n.x, n.y)
        }
      })
    })

    ; return () => { sim.stop() }
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
