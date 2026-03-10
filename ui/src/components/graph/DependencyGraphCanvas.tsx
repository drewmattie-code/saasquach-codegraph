import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { generateMockGraph } from '@/data/generateGraph'

cytoscape.use(fcose as Parameters<typeof cytoscape.use>[0])

interface ApiResponse {
  nodes: Array<{ id: number; name: string; type: string; path?: string }>
  edges: Array<{ id: number; source: number; target: number; type?: string; kind?: string }>
}

// Type-based coloring
const TYPE_COLORS: Record<string, string> = {
  function: '#06d6a0',
  class:    '#ff006e',
  module:   '#ffd23f',
  method:   '#06d6a0',
  variable: '#48bfe3',
  import:   '#8338ec',
  export:   '#8338ec',
  file:     '#48bfe3',
}

function nodeColor(kind: string): string {
  return TYPE_COLORS[kind.toLowerCase()] ?? '#06d6a0'
}

function edgeColor(kind: string): string {
  if (kind === 'calls') return '#3a86ff'
  if (kind === 'imports') return '#8338ec'
  return '#48bfe3'
}

const MAX_RENDER_NODES = 300
const ROTATION_SPEED = 0.0003
const IDLE_RESUME_MS = 2000

export function DependencyGraphCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const pulseIntervalRef = useRef<number | null>(null)
  const rotationRef = useRef<number | null>(null)
  const interactingRef = useRef(false)
  const idleTimerRef = useRef<number | null>(null)
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

      // Only connected nodes
      const connectedIds = new Set<string>()
      for (const e of data.edges) { connectedIds.add(String(e.source)); connectedIds.add(String(e.target)) }
      const connectedNodes = data.nodes.filter(n => connectedIds.has(String(n.id)))

      const sortedNodes = [...connectedNodes]
        .sort((a, b) => (edgeCount[String(b.id)] ?? 0) - (edgeCount[String(a.id)] ?? 0))
        .slice(0, MAX_RENDER_NODES)
      const visibleIds = new Set(sortedNodes.map(n => String(n.id)))
      const visibleEdges = data.edges.filter(e => visibleIds.has(String(e.source)) && visibleIds.has(String(e.target)))

      const cy = cytoscape({
        container: containerRef.current,
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false,
        autoungrabify: false,
        elements: [
          ...sortedNodes.map(n => {
            const kind = (n.type || 'function').toLowerCase()
            return {
              data: {
                id: String(n.id),
                label: n.name,
                kind,
                connectionCount: edgeCount[String(n.id)] ?? 0,
                nodeColor: nodeColor(kind),
              },
            }
          }),
          ...visibleEdges.map((e, i) => ({
            data: {
              id: `e${i}`,
              source: String(e.source),
              target: String(e.target),
              kind: e.kind ?? e.type ?? 'calls',
            },
          })),
        ],
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              'font-size': 9,
              'font-family': 'JetBrains Mono, monospace',
              color: '#e2e8f0',
              'text-valign': 'bottom',
              'text-margin-y': 4,
              'background-color': 'data(nodeColor)',
              'border-width': 0,
              width: (ele: cytoscape.NodeSingular) => {
                const c = Number(ele.data('connectionCount') ?? 0)
                return Math.max(8, Math.min(24, 8 + c * 1.6))
              },
              height: (ele: cytoscape.NodeSingular) => {
                const c = Number(ele.data('connectionCount') ?? 0)
                return Math.max(8, Math.min(24, 8 + c * 1.6))
              },
              'outline-width': 0,
              'outline-color': 'data(nodeColor)',
              'text-wrap': 'ellipsis',
              'text-max-width': '90px',
              'text-background-color': '#0d1117',
              'text-background-opacity': 0.7,
              'text-background-padding': '2px',
              'shadow-color': 'data(nodeColor)',
              'shadow-opacity': 0.35,
              'shadow-blur': 6,
              'shadow-offset-x': 0,
              'shadow-offset-y': 0,
            } as cytoscape.Css.Node,
          },
          {
            selector: 'node.hover-node',
            style: {
              'outline-width': 3,
              'shadow-opacity': 1,
              'shadow-blur': 22,
              'z-index': 999,
            } as cytoscape.Css.Node,
          },
          {
            selector: 'node.selected-node',
            style: {
              'border-width': 2,
              'border-color': '#f8fafc',
              'shadow-opacity': 0.95,
              'shadow-blur': 18,
            } as cytoscape.Css.Node,
          },
          {
            selector: 'node.selected-pulse',
            style: {
              'shadow-opacity': 1,
              'shadow-blur': 28,
            } as cytoscape.Css.Node,
          },
          {
            selector: 'edge',
            style: {
              width: 0.5,
              'line-color': (ele: cytoscape.EdgeSingular) => edgeColor(String(ele.data('kind') ?? '')),
              'target-arrow-shape': 'triangle',
              'target-arrow-color': (ele: cytoscape.EdgeSingular) => edgeColor(String(ele.data('kind') ?? '')),
              'arrow-scale': 0.6,
              'curve-style': 'bezier',
              opacity: 0.25,
            } as cytoscape.Css.Edge,
          },
        ],
        layout: {
          name: 'cose',
          animate: true,
          randomize: false,
          componentSpacing: 20,
          nodeRepulsion: () => 2000,
          gravity: 1.2,
          idealEdgeLength: () => 30,
          numIter: 1500,
          fit: true,
          padding: 20,
          nestingFactor: 1.2,
          gravityRange: 3.8,
        } as cytoscape.LayoutOptions,
      })

      // Interactions
      cy.on('tap', 'node', (e) => {
        cy.nodes().removeClass('selected-node selected-pulse')
        e.target.addClass('selected-node')
        const nodeId = e.target.id()
        const neighbors = new Set<string>([nodeId])
        e.target.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => {
          neighbors.add(edge.data('source'))
          neighbors.add(edge.data('target'))
        })
        cy.nodes().style('opacity', (ele: cytoscape.NodeSingular) =>
          neighbors.has(ele.id()) ? 1 : 0.08)
        cy.edges().style('opacity', (ele: cytoscape.EdgeSingular) =>
          (ele.data('source') === nodeId || ele.data('target') === nodeId) ? 0.8 : 0.03)
      })
      cy.on('tap', (e) => {
        if (e.target === cy) {
          cy.nodes().removeClass('selected-node selected-pulse')
          cy.nodes().style('opacity', 1)
          cy.edges().style('opacity', 0.25)
        }
      })

      // Hover tooltip
      cy.on('mouseover', 'node', (e) => {
        e.target.addClass('hover-node')
        const tooltip = tooltipRef.current
        if (tooltip) {
          const kind = e.target.data('kind')
          const conns = e.target.data('connectionCount') ?? 0
          tooltip.innerHTML = `
            <div style="font-weight:600;margin-bottom:2px">${e.target.data('label')}</div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${nodeColor(kind)}"></span>
              <span style="text-transform:uppercase;font-size:9px;opacity:0.6">${kind}</span>
              <span style="opacity:0.5;font-size:9px">·</span>
              <span style="opacity:0.5;font-size:9px">${conns} conn</span>
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

      // Tooltip follows mouse
      const handleMouseMove = (evt: MouseEvent) => {
        const tooltip = tooltipRef.current
        if (!tooltip) return
        tooltip.style.left = `${evt.clientX + 12}px`
        tooltip.style.top = `${evt.clientY - 8}px`
      }
      document.addEventListener('mousemove', handleMouseMove)

      // Drag pin/unpin
      cy.on('free', 'node', (e) => { e.target.lock() })
      cy.on('dbltap', 'node', (e) => { e.target.unlock() })

      // Pause rotation on interaction
      const pauseRotation = () => {
        interactingRef.current = true
        if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = window.setTimeout(() => {
          interactingRef.current = false
        }, IDLE_RESUME_MS)
      }
      cy.on('pan zoom drag tapstart', pauseRotation)

      // Pulse
      if (pulseIntervalRef.current !== null) window.clearInterval(pulseIntervalRef.current)
      pulseIntervalRef.current = window.setInterval(() => {
        const sel = cy.$('node.selected-node')
        if (sel.length === 0) return
        if (sel.hasClass('selected-pulse')) sel.removeClass('selected-pulse')
        else sel.addClass('selected-pulse')
      }, 700)

      // Ambient rotation
      function rotateNodes() {
        if (!interactingRef.current && cy && !cy.destroyed()) {
          const bb = cy.elements().boundingBox()
          const cx = (bb.x1 + bb.x2) / 2
          const cy2 = (bb.y1 + bb.y2) / 2
          const cos = Math.cos(ROTATION_SPEED)
          const sin = Math.sin(ROTATION_SPEED)
          cy.nodes().positions((node) => {
            if (node.locked()) return node.position()
            const pos = node.position()
            const dx = pos.x - cx
            const dy = pos.y - cy2
            return { x: cx + dx * cos - dy * sin, y: cy2 + dx * sin + dy * cos }
          })
        }
        rotationRef.current = requestAnimationFrame(rotateNodes)
      }
      cy.one('layoutstop', () => {
        rotationRef.current = requestAnimationFrame(rotateNodes)
      })

      // Cascade ripple — nodes appear from hub outward
      cy.nodes().style('opacity', 0)
      cy.edges().style('opacity', 0)
      cy.one('layoutstop', () => {
        // Sort by connection count (hubs first), then stagger reveal
        const sorted = cy.nodes().sort((a: cytoscape.NodeSingular, b: cytoscape.NodeSingular) =>
          Number(b.data('connectionCount') ?? 0) - Number(a.data('connectionCount') ?? 0)
        )
        sorted.forEach((node: cytoscape.NodeSingular, i: number) => {
          setTimeout(() => {
            node.animate({ style: { opacity: 1 } } as any, { duration: 300 })
            // Also reveal edges connected to visible nodes
            node.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => {
              const otherOpacity = edge.source().id() === node.id()
                ? Number(edge.target().style('opacity'))
                : Number(edge.source().style('opacity'))
              if (otherOpacity > 0.5) {
                edge.animate({ style: { opacity: 0.25 } } as any, { duration: 200 })
              }
            })
          }, Math.min(i * 8, 1200)) // Cap total cascade at 1.2s
        })
      })

      cyRef.current = cy
      setReady(true)

      // Return cleanup for mousemove
      return () => document.removeEventListener('mousemove', handleMouseMove)
    }

    let mouseCleanup: (() => void) | undefined

    fetch('/api/graph?limit=300')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((data: ApiResponse) => {
        mouseCleanup = buildGraph(data)
      })
      .catch(() => {
        // Fallback to procedural data
        const mock = generateMockGraph(300)
        mouseCleanup = buildGraph({ nodes: mock.nodes, edges: mock.edges as any })
      })

    return () => {
      cancelled = true
      mouseCleanup?.()
      if (pulseIntervalRef.current !== null) { window.clearInterval(pulseIntervalRef.current); pulseIntervalRef.current = null }
      if (rotationRef.current !== null) { cancelAnimationFrame(rotationRef.current); rotationRef.current = null }
      if (idleTimerRef.current !== null) { window.clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
      if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }
    }
  }, [])

  if (error) return (
    <div className="flex h-[410px] w-full items-center justify-center rounded-xl bg-[var(--bg-base)]">
      <span className="text-xs text-[var(--accent-risk)]">Graph error: {error}</span>
    </div>
  )

  return (
    <div className="relative h-[410px] w-full overflow-hidden rounded-xl" style={{ background: 'linear-gradient(160deg, #161b22 0%, #0d1117 60%, #0b1118 100%)' }}>
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-graph)] border-t-transparent" />
            <span className="font-mono text-xs text-[var(--text-tertiary)]">Loading graph…</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-50 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] shadow-lg"
        style={{ opacity: 0, transition: 'opacity 150ms', fontFamily: 'var(--font-display)' }}
      />
    </div>
  )
}
