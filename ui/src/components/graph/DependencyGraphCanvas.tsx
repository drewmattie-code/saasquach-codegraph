import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { generateMockGraph } from '@/data/generateGraph'

cytoscape.use(fcose as Parameters<typeof cytoscape.use>[0])

interface ApiResponse {
  nodes: Array<{ id: number; name: string; type: string; path?: string; color?: string }>
  edges: Array<{ id: number; source: number; target: number; type?: string; kind?: string; edgeColor?: string }>
}

// GitNexus 6-color nebula palette
const TYPE_COLORS: Record<string, string> = {
  function: '#00d4aa', class: '#e040fb', module: '#ff9100',
  interface: '#a371f7', variable: '#76ff03', import: '#2979ff',
  method: '#00d4aa', export: '#2979ff', file: '#ff9100',
}

function nodeColor(kind: string): string {
  return TYPE_COLORS[kind.toLowerCase()] ?? '#00d4aa'
}

const MAX_RENDER_NODES = 600

export function DependencyGraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [error] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    function buildGraph(data: { nodes: ApiResponse['nodes']; edges: ApiResponse['edges'] }) {
      if (cancelled || !containerRef.current) return

      const edgeCount: Record<string, number> = {}
      for (const e of data.edges) {
        const s = String(e.source), t = String(e.target)
        edgeCount[s] = (edgeCount[s] ?? 0) + 1
        edgeCount[t] = (edgeCount[t] ?? 0) + 1
      }

      const connIds = new Set<string>()
      for (const e of data.edges) { connIds.add(String(e.source)); connIds.add(String(e.target)) }
      const connectedNodes = data.nodes.filter(n => connIds.has(String(n.id)))

      const sortedNodes = [...connectedNodes]
        .sort((a, b) => (edgeCount[String(b.id)] ?? 0) - (edgeCount[String(a.id)] ?? 0))
        .slice(0, MAX_RENDER_NODES)
      const visibleIds = new Set(sortedNodes.map(n => String(n.id)))
      const visibleEdges = data.edges.filter(e => visibleIds.has(String(e.source)) && visibleIds.has(String(e.target)))

      const cy = cytoscape({
        container: containerRef.current,
        userZoomingEnabled: false,
        userPanningEnabled: false,
        boxSelectionEnabled: false,
        autoungrabify: true,
        textureOnViewport: true,
        hideEdgesOnViewport: true,
        hideLabelsOnViewport: true,
        pixelRatio: 1,
        elements: [
          ...sortedNodes.map(n => {
            const kind = (n.type || 'function').toLowerCase()
            const color = n.color ?? nodeColor(kind)
            return {
              data: {
                id: String(n.id), label: n.name, kind,
                connectionCount: edgeCount[String(n.id)] ?? 0,
                nodeColor: color,
              },
            }
          }),
          ...visibleEdges.map((e, i) => ({
            data: {
              id: `e${i}`,
              source: String(e.source),
              target: String(e.target),
              edgeColor: e.edgeColor ?? nodeColor((sortedNodes.find(n => n.id === e.source)?.type || 'function').toLowerCase()),
            },
          })),
        ],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'data(nodeColor)',
              'background-opacity': 0.9,
              width: (ele: cytoscape.NodeSingular) => Math.max(3, Math.min(24, 3 + Number(ele.data('connectionCount') ?? 0) * 0.4)),
              height: (ele: cytoscape.NodeSingular) => Math.max(3, Math.min(24, 3 + Number(ele.data('connectionCount') ?? 0) * 0.4)),
              'border-width': (ele: cytoscape.NodeSingular) => Math.max(0.5, Math.min(4, Number(ele.data('connectionCount') ?? 0) * 0.1)),
              'border-color': 'data(nodeColor)',
              'border-opacity': 0.3,
              label: '',
              'shadow-color': 'data(nodeColor)',
              'shadow-opacity': 0.2,
              'shadow-blur': 3,
              'shadow-offset-x': 0,
              'shadow-offset-y': 0,
            } as cytoscape.Css.Node,
          },
          {
            selector: 'node.hover-node',
            style: {
              'background-opacity': 1,
              'border-width': 4,
              'border-opacity': 0.6,
              'shadow-opacity': 0.8,
              'shadow-blur': 12,
              label: 'data(label)',
              'font-size': 8,
              'font-family': 'JetBrains Mono, monospace',
              color: '#e0e0e8',
              'text-valign': 'bottom',
              'text-margin-y': 3,
              'text-outline-color': '#0a0a0f',
              'text-outline-width': 2,
              'z-index': 999,
            } as cytoscape.Css.Node,
          },
          {
            selector: 'edge',
            style: {
              'line-color': 'data(edgeColor)',
              'line-opacity': 0.04,
              width: 0.4,
              'curve-style': 'haystack',
              'haystack-radius': 0.5,
            } as cytoscape.Css.Edge,
          },
        ],
        layout: {
          name: 'cose',
          animate: false,
          randomize: true,
          componentSpacing: 15,
          nodeRepulsion: () => 3000,
          gravity: 0.5,
          idealEdgeLength: () => 25,
          numIter: 1000,
          fit: true,
          padding: 10,
        } as cytoscape.LayoutOptions,
      })

      // Hover tooltip
      cy.on('mouseover', 'node', (e) => {
        e.target.addClass('hover-node')
        const tooltip = tooltipRef.current
        if (tooltip) {
          const kind = e.target.data('kind')
          const conns = e.target.data('connectionCount') ?? 0
          tooltip.innerHTML = `
            <div style="font-weight:600;margin-bottom:2px;font-size:11px">${e.target.data('label')}</div>
            <div style="display:flex;align-items:center;gap:4px">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${nodeColor(kind)}"></span>
              <span style="text-transform:uppercase;font-size:8px;opacity:0.6">${kind}</span>
              <span style="opacity:0.4;font-size:8px">· ${conns} conn</span>
            </div>
          `
          tooltip.style.opacity = '1'
        }
      })
      cy.on('mouseout', 'node', (e) => {
        e.target.removeClass('hover-node')
        const tooltip = tooltipRef.current
        if (tooltip) tooltip.style.opacity = '0'
      })

      const handleMouseMove = (evt: MouseEvent) => {
        const tooltip = tooltipRef.current
        if (!tooltip) return
        tooltip.style.left = `${evt.clientX + 12}px`
        tooltip.style.top = `${evt.clientY - 8}px`
      }
      document.addEventListener('mousemove', handleMouseMove)

      cy.one('layoutstop', () => { cy.resize(); cy.fit(undefined, 10) })

      cyRef.current = cy
      setReady(true)

      return () => document.removeEventListener('mousemove', handleMouseMove)
    }

    let mouseCleanup: (() => void) | undefined

    fetch('/api/graph?limit=600')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data: ApiResponse) => { mouseCleanup = buildGraph(data) })
      .catch(() => {
        const mock = generateMockGraph(800)
        mouseCleanup = buildGraph({ nodes: mock.nodes, edges: mock.edges as any })
      })

    return () => {
      cancelled = true
      mouseCleanup?.()
      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }
    }
  }, [])

  if (error) return (
    <div className="flex h-[410px] w-full items-center justify-center rounded-xl bg-[var(--bg-base)]">
      <span className="text-xs text-[var(--accent-risk)]">Graph error: {error}</span>
    </div>
  )

  return (
    <div className="relative h-[410px] w-full overflow-hidden rounded-xl" style={{ background: '#0a0a0f' }}>
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00d4aa] border-t-transparent" />
            <span className="font-mono text-xs text-[#555568]">Loading graph…</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-50 max-w-[220px] rounded-lg border border-[#3a3a4f] bg-[#1c1c28] px-2.5 py-1.5 text-xs text-[#e0e0e8] shadow-lg"
        style={{ opacity: 0, transition: 'opacity 120ms', fontFamily: 'var(--font-display)' }}
      />
    </div>
  )
}
