import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

type NodeHealth = 'good' | 'warn' | 'risk'
type NodeType = 'function' | 'class' | 'module' | string

type Node = {
  id: string
  name: string
  type: NodeType
  health: NodeHealth
  r: number
  x?: number
  y?: number
  vx?: number
  vy?: number
}

type Link = {
  source: string
  target: string
  weight: number
  type: string
}

type GraphApiResponse = {
  nodes: Array<{ id: number; name: string; type: string; file?: string; path?: string }>
  edges: Array<{ id: number; source: number; target: number; type?: string; kind?: string }>
}

export function DependencyGraphCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] } | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchGraph = async () => {
      setLoading(true)
      try {
        const res = await fetch('http://localhost:7478/api/graph?limit=300')
        if (!res.ok) throw new Error(`Graph fetch failed: ${res.status}`)
        const data: GraphApiResponse = await res.json()

        const connectionCounts = new Map<string, number>()
        data.edges.forEach((e) => {
          const s = String(e.source)
          const t = String(e.target)
          connectionCounts.set(s, (connectionCounts.get(s) ?? 0) + 1)
          connectionCounts.set(t, (connectionCounts.get(t) ?? 0) + 1)
        })

        const nodes: Node[] = data.nodes.map((n) => {
          const id = String(n.id)
          const normalizedType = (n.type ?? '').toLowerCase()
          const connections = connectionCounts.get(id) ?? 0
          const health: NodeHealth = normalizedType === 'class' ? 'warn' : normalizedType === 'module' || normalizedType === 'file' ? 'risk' : 'good'
          return {
            id,
            name: n.name,
            type: normalizedType,
            health,
            r: 8 + Math.min(connections * 2, 24),
          }
        })

        const links: Link[] = data.edges.map((e) => ({
          source: String(e.source),
          target: String(e.target),
          weight: 1,
          type: e.type ?? e.kind ?? 'calls',
        }))

        if (!cancelled) setGraphData({ nodes, links })
      } catch {
        if (!cancelled) setGraphData({ nodes: [], links: [] })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchGraph()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!graphData || loading) return

    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * devicePixelRatio
    canvas.height = height * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)

    const nodes = graphData.nodes
    const links = graphData.links

    const nodeById = new Map(nodes.map((n) => [n.id, n]))

    const sim = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('charge', d3.forceManyBody().strength(-80))
      .force('link', d3.forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[]).id((d: any) => d.id).distance(80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => d.r + 8))

    let t = 0
    sim.on('tick', () => {
      t += 0.02
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(255,255,255,0.02)'
      for (let gx = 0; gx < width; gx += 24) for (let gy = 0; gy < height; gy += 24) ctx.fillRect(gx, gy, 1, 1)

      links.forEach((l, i) => {
        const s = nodeById.get(typeof l.source === 'string' ? l.source : String((l.source as any)?.id))
        const d = nodeById.get(typeof l.target === 'string' ? l.target : String((l.target as any)?.id))
        if (!s || !d) return
        ctx.strokeStyle = 'rgba(108,92,231,0.35)'
        ctx.lineWidth = 0.5 + l.weight * 0.25
        ctx.setLineDash([4, 6])
        ctx.lineDashOffset = -((t * 30) + i)
        ctx.beginPath()
        ctx.moveTo(s.x ?? 0, s.y ?? 0)
        ctx.quadraticCurveTo((s.x! + d.x!) / 2, (s.y! + d.y!) / 2 - 22, d.x ?? 0, d.y ?? 0)
        ctx.stroke()
      })

      nodes.forEach((n) => {
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(12,12,20,0.95)'
        ctx.beginPath()
        ctx.arc(n.x ?? 0, n.y ?? 0, n.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = n.health === 'good' ? '#00D68F' : n.health === 'warn' ? '#FFB84D' : '#45B7D1'
        ctx.lineWidth = 2
        ctx.stroke()
      })
    })

    return () => {
      sim.stop()
    }
  }, [graphData, loading])

  if (loading) {
    return <div className='h-[410px] w-full rounded-xl bg-[var(--bg-base)] grid place-items-center text-sm text-white/60'>Loading graph…</div>
  }

  return <canvas ref={ref} className='h-[410px] w-full rounded-xl bg-[var(--bg-base)]' />
}
