import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

type Node = { id: string; health: 'good' | 'warn' | 'risk'; r: number; x?: number; y?: number; vx?: number; vy?: number }
type Link = { source: string; target: string; weight: number }

export function DependencyGraphCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * devicePixelRatio
    canvas.height = height * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)

    const nodes: Node[] = Array.from({ length: 42 }, (_, i) => ({ id: `repo-${i}`, health: i % 9 === 0 ? 'risk' : i % 4 === 0 ? 'warn' : 'good', r: 8 + ((i * 3) % 32) }))
    const links: Link[] = Array.from({ length: 68 }, (_, i) => ({ source: `repo-${i % 42}`, target: `repo-${(i * 7) % 42}`, weight: (i % 5) + 1 }))

    const sim = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
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
        const s = nodes.find((n) => n.id === l.source)!; const d = nodes.find((n) => n.id === l.target)!
        ctx.strokeStyle = 'rgba(108,92,231,0.35)'
        ctx.lineWidth = 0.5 + l.weight * 0.25
        ctx.setLineDash([4, 6]); ctx.lineDashOffset = -((t * 30) + i)
        ctx.beginPath(); ctx.moveTo(s.x ?? 0, s.y ?? 0); ctx.quadraticCurveTo((s.x! + d.x!) / 2, (s.y! + d.y!) / 2 - 22, d.x ?? 0, d.y ?? 0); ctx.stroke()
      })

      nodes.forEach((n) => {
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(12,12,20,0.95)'; ctx.beginPath(); ctx.arc(n.x ?? 0, n.y ?? 0, n.r, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = n.health === 'good' ? '#00D68F' : n.health === 'warn' ? '#FFB84D' : '#FF6B6B'
        ctx.lineWidth = 2; ctx.stroke()
      })
    })

    return () => {
      sim.stop()
    }
  }, [])

  return <canvas ref={ref} className='h-[410px] w-full rounded-xl bg-[var(--bg-base)]' />
}
