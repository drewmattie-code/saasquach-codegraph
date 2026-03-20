import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { CaretDown, CaretRight, MagnifyingGlass, Minus, Plus, Download, Copy, EyeSlash, ArrowsOutSimple, PushPin } from '@phosphor-icons/react'
import { FileTree } from '@/components/graph/FileTree'
import { CodeInspector } from '@/components/graph/CodeInspector'
import { generateMockGraph } from '@/data/generateGraph'

cytoscape.use(fcose as Parameters<typeof cytoscape.use>[0])

type ApiNode = { id: number; name: string; type: string; path?: string; line_number?: number; color?: string }
type ApiEdge = { source: number; target: number; kind?: string; type?: string; edgeColor?: string }
type ApiResponse = { nodes: ApiNode[]; edges: ApiEdge[] }
type CallerCallee = { function_name: string; path: string; line_number: number }
type ContextMenu = { x: number; y: number; nodeId: string; nodeName: string; nodePath: string } | null

const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

// GitNexus 6-color nebula palette
const TYPE_COLORS: Record<string, string> = {
  function:  '#00d4aa',
  class:     '#e040fb',
  module:    '#ff9100',
  interface: '#a371f7',
  variable:  '#76ff03',
  import:    '#2979ff',
  method:    '#00d4aa',
  export:    '#2979ff',
  file:      '#ff9100',
}

function nodeColor(kind: string): string {
  return TYPE_COLORS[kind.toLowerCase()] ?? '#00d4aa'
}

const MAX_RENDER_NODES = 2000

// ── Minimap ──────────────────────────────────────────────────────────────────
function drawMinimap(cy: cytoscape.Core, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width, h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(10, 10, 15, 0.85)'
  ctx.fillRect(0, 0, w, h)

  const elems = cy.elements()
  if (elems.length === 0) return
  const bb = elems.boundingBox()
  if (bb.w === 0 && bb.h === 0) return

  const pad = 40
  const scaleX = w / (bb.w + pad), scaleY = h / (bb.h + pad)
  const scale = Math.min(scaleX, scaleY)
  const ox = (w - bb.w * scale) / 2, oy = (h - bb.h * scale) / 2

  ctx.strokeStyle = 'rgba(100, 100, 140, 0.08)'
  ctx.lineWidth = 0.3
  cy.edges().forEach(edge => {
    const sp = edge.source().position(), tp = edge.target().position()
    ctx.beginPath()
    ctx.moveTo((sp.x - bb.x1) * scale + ox, (sp.y - bb.y1) * scale + oy)
    ctx.lineTo((tp.x - bb.x1) * scale + ox, (tp.y - bb.y1) * scale + oy)
    ctx.stroke()
  })

  cy.nodes().forEach(node => {
    const pos = node.position()
    const x = (pos.x - bb.x1) * scale + ox, y = (pos.y - bb.y1) * scale + oy
    ctx.fillStyle = (node.data('nodeColor') as string) ?? '#00d4aa'
    ctx.beginPath()
    ctx.arc(x, y, 1.2, 0, Math.PI * 2)
    ctx.fill()
  })

  const ext = cy.extent()
  const vx = (ext.x1 - bb.x1) * scale + ox, vy = (ext.y1 - bb.y1) * scale + oy
  const vw = (ext.x2 - ext.x1) * scale, vh = (ext.y2 - ext.y1) * scale
  ctx.strokeStyle = 'rgba(0, 212, 170, 0.7)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(vx, vy, vw, vh)
  ctx.fillStyle = 'rgba(0, 212, 170, 0.06)'
  ctx.fillRect(vx, vy, vw, vh)
}

function handleMinimapClick(e: React.MouseEvent<HTMLCanvasElement>, cy: cytoscape.Core | null) {
  if (!cy) return
  const canvas = e.currentTarget
  const rect = canvas.getBoundingClientRect()
  const clickX = e.clientX - rect.left, clickY = e.clientY - rect.top
  const w = canvas.width, h = canvas.height

  const elems = cy.elements()
  if (elems.length === 0) return
  const bb = elems.boundingBox()
  if (bb.w === 0 && bb.h === 0) return

  const pad = 40
  const scaleX = w / (bb.w + pad), scaleY = h / (bb.h + pad)
  const scale = Math.min(scaleX, scaleY)
  const ox = (w - bb.w * scale) / 2, oy = (h - bb.h * scale) / 2

  const modelX = (clickX - ox) / scale + bb.x1
  const modelY = (clickY - oy) / scale + bb.y1
  const vpW = cy.width(), vpH = cy.height(), zoom = cy.zoom()
  cy.pan({ x: vpW / 2 - modelX * zoom, y: vpH / 2 - modelY * zoom })
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function GraphExplorerPage() {
  const [apiNodes, setApiNodes] = useState<ApiNode[]>([])
  const [apiEdges, setApiEdges] = useState<ApiEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useState<'Force' | 'Tree' | 'Radial' | 'Cluster'>('Force')
  const [layoutRunning, setLayoutRunning] = useState(false)
  const [filters, setFilters] = useState<Record<string, boolean>>({
    function: true, class: true, module: true, interface: true, variable: true, import: true,
  })
  const [selected, setSelected] = useState<{
    name: string; type: string; path?: string; line_number?: number
    connections?: number; callers?: CallerCallee[]; callees?: CallerCallee[]
  } | null>(null)
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>()
  const [demoMode, setDemoMode] = useState(false)
  const [repoFilter, setRepoFilter] = useState<string>('all')
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null)
  const [callersOpen, setCallersOpen] = useState(true)
  const [calleesOpen, setCalleesOpen] = useState(true)
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set())
  const [inspectorFile, setInspectorFile] = useState<string | null>(null)
  const [inspectorLine, setInspectorLine] = useState<number | undefined>()

  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pulseIntervalRef = useRef<number | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const minimapRef = useRef<HTMLCanvasElement>(null)
  const minimapRafRef = useRef<number | null>(null)

  // ── Fetch data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const repoParam = repoFilter !== 'all' ? `&repo=${encodeURIComponent(repoFilter)}` : ''
    fetch(`/api/graph?limit=2000${repoParam}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: ApiResponse) => { setApiNodes(data.nodes); setApiEdges(data.edges) })
      .catch(() => {
        const mock = generateMockGraph(2500)
        setApiNodes(mock.nodes)
        setApiEdges(mock.edges)
        setDemoMode(true)
      })
      .finally(() => setLoading(false))
  }, [repoFilter])

  // ── Fetch callers/callees ──────────────────────────────────────────────────
  const fetchCallersCallees = useCallback((nodeName: string, nodeId: string) => {
    const cy = cyRef.current
    const buildMockFromEdges = (): { callers: CallerCallee[]; callees: CallerCallee[] } => {
      if (!cy) return { callers: [], callees: [] }
      const node = cy.getElementById(nodeId)
      if (!node.length) return { callers: [], callees: [] }
      const callersList: CallerCallee[] = [], calleesList: CallerCallee[] = []
      node.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => {
        const src = edge.source(), tgt = edge.target()
        if (tgt.id() === nodeId) callersList.push({ function_name: src.data('label'), path: src.data('filePath') ?? '', line_number: src.data('lineNumber') ?? 0 })
        if (src.id() === nodeId) calleesList.push({ function_name: tgt.data('label'), path: tgt.data('filePath') ?? '', line_number: tgt.data('lineNumber') ?? 0 })
      })
      return { callers: callersList.slice(0, 8), callees: calleesList.slice(0, 8) }
    }

    Promise.all([
      fetch(`/api/analysis/callers/${encodeURIComponent(nodeName)}`).then(r => r.ok ? r.json() as Promise<CallerCallee[]> : null).catch(() => null),
      fetch(`/api/analysis/calls/${encodeURIComponent(nodeName)}`).then(r => r.ok ? r.json() as Promise<CallerCallee[]> : null).catch(() => null),
    ]).then(([callers, callees]) => {
      const mock = (!callers || !callees) ? buildMockFromEdges() : null
      setSelected(prev => prev?.name === nodeName ? {
        ...prev,
        callers: (callers ?? mock?.callers ?? []).slice(0, 8),
        callees: (callees ?? mock?.callees ?? []).slice(0, 8),
      } : prev)
    })
  }, [])

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredNodes = useMemo(() =>
    apiNodes.filter(n => filters[(n.type || 'function').toLowerCase()] ?? true),
    [apiNodes, filters],
  )
  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes])
  const filteredEdges = useMemo(() =>
    apiEdges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)),
    [apiEdges, filteredNodeIds],
  )
  const searchMatchIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return new Set(filteredNodes.filter(n => n.name.toLowerCase().includes(q)).map(n => String(n.id)))
  }, [filteredNodes, query])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    apiNodes.forEach(n => { const t = (n.type || 'function').toLowerCase(); counts[t] = (counts[t] ?? 0) + 1 })
    return counts
  }, [apiNodes])

  // ── Search highlight ───────────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !cy.elements().length) return
    if (!searchMatchIds) {
      cy.nodes().animate({ style: { opacity: 1 } } as any, { duration: 200 })
      cy.edges().animate({ style: { opacity: 0.04 } } as any, { duration: 200 })
    } else {
      cy.nodes().animate({ style: { opacity: (ele: cytoscape.NodeSingular) => searchMatchIds.has(ele.id()) ? 1 : 0.05 } } as any, { duration: 200 })
      cy.edges().animate({ style: { opacity: (ele: cytoscape.EdgeSingular) => (searchMatchIds.has(ele.data('source')) || searchMatchIds.has(ele.data('target'))) ? 0.3 : 0.005 } } as any, { duration: 200 })
    }
  }, [searchMatchIds])

  // ━━ BUILD CYTOSCAPE GRAPH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    if (loading || !containerRef.current) return

    // Cleanup
    if (pulseIntervalRef.current !== null) { window.clearInterval(pulseIntervalRef.current); pulseIntervalRef.current = null }
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }

    const edgeCount: Record<string, number> = {}
    for (const e of filteredEdges) {
      const s = String(e.source), t = String(e.target)
      edgeCount[s] = (edgeCount[s] ?? 0) + 1
      edgeCount[t] = (edgeCount[t] ?? 0) + 1
    }

    // Only connected nodes, sorted by degree, capped
    const connIds = new Set<string>()
    for (const e of filteredEdges) { connIds.add(String(e.source)); connIds.add(String(e.target)) }
    const connectedNodes = filteredNodes.filter(n => connIds.has(String(n.id)))
    const sortedNodes = [...connectedNodes]
      .sort((a, b) => (edgeCount[String(b.id)] ?? 0) - (edgeCount[String(a.id)] ?? 0))
      .slice(0, MAX_RENDER_NODES)
    const visibleIds = new Set(sortedNodes.map(n => String(n.id)))
    const visibleEdges = filteredEdges.filter(e => visibleIds.has(String(e.source)) && visibleIds.has(String(e.target)))

    // Layout config
    let layoutConfig: cytoscape.LayoutOptions
    if (layout === 'Tree') {
      layoutConfig = { name: 'breadthfirst', directed: true, spacingFactor: 0.5, animate: false, fit: true, padding: 40 } as cytoscape.LayoutOptions
    } else if (layout === 'Radial') {
      layoutConfig = { name: 'concentric', concentric: (node: cytoscape.NodeSingular) => Number(node.data('connectionCount') ?? 0), levelWidth: () => 6, animate: false, fit: true, padding: 40 } as cytoscape.LayoutOptions
    } else if (layout === 'Cluster') {
      layoutConfig = { name: 'cose', animate: false, randomize: true, nodeRepulsion: () => 6000, gravity: 0.3, idealEdgeLength: () => 50, numIter: 2000, fit: true, padding: 40 } as cytoscape.LayoutOptions
    } else {
      // Force (default) — tuned for nebula: dense center, organic clusters
      layoutConfig = { name: 'cose', animate: false, randomize: true, componentSpacing: 20, nodeRepulsion: () => 4500, gravity: 0.4, idealEdgeLength: () => 30, numIter: 1500, fit: true, padding: 40, nestingFactor: 0.1, gravityRange: 3.8 } as cytoscape.LayoutOptions
    }

    const cy = cytoscape({
      container: containerRef.current,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      autoungrabify: false,
      // Performance for 2000+ nodes
      textureOnViewport: true,
      hideEdgesOnViewport: true,
      hideLabelsOnViewport: true,
      pixelRatio: 1,
      wheelSensitivity: 0.2,
      minZoom: 0.05,
      maxZoom: 6,
      elements: [
        ...sortedNodes.map(n => {
          const kind = (n.type || 'function').toLowerCase()
          const color = n.color ?? nodeColor(kind)
          return {
            data: {
              id: String(n.id), label: n.name, kind,
              filePath: n.path, lineNumber: n.line_number,
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
            kind: e.kind ?? e.type ?? 'calls',
            // Edge color = source node color (for nebula effect)
            edgeColor: e.edgeColor ?? nodeColor((sortedNodes.find(n => n.id === e.source)?.type || 'function').toLowerCase()),
          },
        })),
      ],
      style: [
        // ── NODE: tiny dust → large star ──
        {
          selector: 'node',
          style: {
            'background-color': 'data(nodeColor)',
            'background-opacity': 0.9,
            // Size 4-36px mapped to degree
            width: (ele: cytoscape.NodeSingular) => {
              const d = Number(ele.data('connectionCount') ?? 0)
              return Math.max(4, Math.min(36, 4 + d * 0.53))
            },
            height: (ele: cytoscape.NodeSingular) => {
              const d = Number(ele.data('connectionCount') ?? 0)
              return Math.max(4, Math.min(36, 4 + d * 0.53))
            },
            // Glow ring via thick semi-transparent border
            'border-width': (ele: cytoscape.NodeSingular) => {
              const d = Number(ele.data('connectionCount') ?? 0)
              return Math.max(1, Math.min(6, d * 0.15))
            },
            'border-color': 'data(nodeColor)',
            'border-opacity': 0.3,
            // Labels HIDDEN at default zoom — appear when zoomed in
            label: 'data(label)',
            'text-opacity': 0,
            'font-size': 9,
            'font-family': 'JetBrains Mono, monospace',
            color: '#e0e0e8',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'text-outline-color': '#0a0a0f',
            'text-outline-width': 2,
            'min-zoomed-font-size': 12,
            'text-wrap': 'ellipsis',
            'text-max-width': '120px',
            // Glow
            'shadow-color': 'data(nodeColor)',
            'shadow-opacity': 0.25,
            'shadow-blur': 4,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0,
            'transition-property': 'background-opacity, border-width, border-opacity, shadow-opacity, shadow-blur, text-opacity, opacity',
            'transition-duration': 200,
          } as cytoscape.Css.Node,
        },
        // ── EDGE: glowing filaments ──
        {
          selector: 'edge',
          style: {
            'line-color': 'data(edgeColor)',
            'line-opacity': 0.04,
            width: 0.5,
            'curve-style': 'haystack',
            'haystack-radius': 0.5,
            'transition-property': 'line-opacity, width',
            'transition-duration': 150,
          } as cytoscape.Css.Edge,
        },
        // ── Type overrides ──
        {
          selector: 'node[kind = "class"]',
          style: {
            'background-opacity': 1,
            width: (ele: cytoscape.NodeSingular) => Math.max(8, Math.min(40, 8 + Number(ele.data('connectionCount') ?? 0) * 0.6)),
            height: (ele: cytoscape.NodeSingular) => Math.max(8, Math.min(40, 8 + Number(ele.data('connectionCount') ?? 0) * 0.6)),
            'border-width': (ele: cytoscape.NodeSingular) => Math.max(2, Math.min(8, Number(ele.data('connectionCount') ?? 0) * 0.2)),
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node[kind = "module"]',
          style: {
            'background-opacity': 0.95,
            width: (ele: cytoscape.NodeSingular) => Math.max(6, Math.min(36, 6 + Number(ele.data('connectionCount') ?? 0) * 0.55)),
            height: (ele: cytoscape.NodeSingular) => Math.max(6, Math.min(36, 6 + Number(ele.data('connectionCount') ?? 0) * 0.55)),
          } as cytoscape.Css.Node,
        },
        // ── Interaction states ──
        {
          selector: 'node.hover-node',
          style: {
            'background-opacity': 1,
            'border-width': 6,
            'border-opacity': 0.6,
            'shadow-opacity': 0.8,
            'shadow-blur': 16,
            'text-opacity': 1,
            'z-index': 999,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.selected-node',
          style: {
            'border-width': 4,
            'border-color': '#ffffff',
            'border-opacity': 0.8,
            'shadow-opacity': 1,
            'shadow-blur': 22,
            'text-opacity': 1,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.selected-pulse',
          style: { 'shadow-opacity': 1, 'shadow-blur': 30 } as cytoscape.Css.Node,
        },
        {
          selector: 'node.neighbor',
          style: {
            'background-opacity': 0.8,
            'border-opacity': 0.4,
            'text-opacity': 0.7,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.dimmed',
          style: { 'background-opacity': 0.04, 'border-opacity': 0, 'text-opacity': 0, 'shadow-opacity': 0 } as cytoscape.Css.Node,
        },
        {
          selector: 'edge.active-edge',
          style: { 'line-opacity': 0.4, width: 1.5 } as cytoscape.Css.Edge,
        },
        {
          selector: 'edge.dimmed',
          style: { 'line-opacity': 0.003 } as cytoscape.Css.Edge,
        },
        {
          selector: 'node:grabbed',
          style: { 'border-width': 3, 'border-color': '#ff9100', 'shadow-opacity': 1, 'shadow-blur': 16 } as cytoscape.Css.Node,
        },
        {
          selector: 'node.pinned',
          style: { 'border-width': 2, 'border-color': '#58a6ff', 'border-opacity': 0.6, 'border-style': 'dashed' } as cytoscape.Css.Node,
        },
        {
          selector: 'node.referenced',
          style: { 'border-width': 3, 'border-color': '#00d4aa', 'border-opacity': 0.5, 'text-opacity': 1 } as cytoscape.Css.Node,
        },
      ],
    })

    // Run layout explicitly
    cy.layout(layoutConfig).run()

    // ── Node tap → select + highlight neighborhood ──
    cy.on('tap', 'node', (e) => {
      cy.elements().removeClass('dimmed neighbor active-edge selected-node selected-pulse')
      const node = e.target
      const nodeId = node.id()
      const hood = node.neighborhood().add(node)

      cy.elements().addClass('dimmed')
      hood.nodes().removeClass('dimmed').addClass('neighbor')
      node.removeClass('dimmed').addClass('selected-node')
      hood.edges().removeClass('dimmed').addClass('active-edge')

      const nodeName = node.data('label')
      setSelected({
        name: nodeName,
        type: node.data('kind'),
        path: node.data('filePath'),
        line_number: node.data('lineNumber'),
        connections: node.degree(),
      })
      setContextMenu(null)
      fetchCallersCallees(nodeName, nodeId)
    })

    // ── Background tap → clear ──
    cy.on('tap', (e) => {
      if (e.target === cy) {
        cy.elements().removeClass('dimmed highlighted neighbor active-edge selected-node selected-pulse')
        setSelected(null)
        setContextMenu(null)
      }
    })

    // ── Right-click context menu ──
    cy.on('cxttap', 'node', (e) => {
      const rp = e.renderedPosition
      const cr = containerRef.current?.getBoundingClientRect()
      if (!cr) return
      setContextMenu({ x: cr.left + rp.x, y: cr.top + rp.y, nodeId: e.target.id(), nodeName: e.target.data('label'), nodePath: e.target.data('filePath') ?? '' })
    })

    // ── Hover → glow + tooltip ──
    cy.on('mouseover', 'node', (e) => {
      e.target.addClass('hover-node')
      const tooltip = tooltipRef.current
      if (tooltip) {
        const kind = e.target.data('kind')
        const conns = e.target.degree()
        tooltip.innerHTML = `
          <div style="font-weight:600;margin-bottom:2px;font-size:12px">${e.target.data('label')}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${nodeColor(kind)}"></span>
            <span style="text-transform:uppercase;font-size:9px;letter-spacing:0.06em;opacity:0.6">${kind}</span>
          </div>
          <div style="opacity:0.5;font-size:10px">${conns} connection${conns !== 1 ? 's' : ''}</div>
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
      tooltip.style.left = `${evt.clientX + 14}px`
      tooltip.style.top = `${evt.clientY - 10}px`
    }
    document.addEventListener('mousemove', handleMouseMove)

    // ── Drag → pin ──
    cy.on('free', 'node', (e) => { e.target.lock(); e.target.addClass('pinned') })
    cy.on('dbltap', 'node', (e) => { e.target.unlock(); e.target.removeClass('pinned') })

    // ── Pulse ──
    pulseIntervalRef.current = window.setInterval(() => {
      const sel = cy.$('node.selected-node')
      if (sel.length === 0) return
      sel.toggleClass('selected-pulse')
    }, 700)

    // ── Layout events ──
    cy.on('layoutstart', () => setLayoutRunning(true))
    cy.one('layoutstop', () => {
      setLayoutRunning(false)
      cy.resize()
      cy.fit(undefined, 40)
    })

    // ── Minimap ──
    const scheduleMinimapDraw = () => {
      if (minimapRafRef.current !== null) cancelAnimationFrame(minimapRafRef.current)
      minimapRafRef.current = requestAnimationFrame(() => {
        if (minimapRef.current && !cy.destroyed()) drawMinimap(cy, minimapRef.current)
      })
    }
    cy.on('viewport layoutstop position', scheduleMinimapDraw)
    const minimapInterval = window.setInterval(scheduleMinimapDraw, 500)

    cyRef.current = cy

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (pulseIntervalRef.current !== null) { window.clearInterval(pulseIntervalRef.current); pulseIntervalRef.current = null }
      if (minimapRafRef.current !== null) { cancelAnimationFrame(minimapRafRef.current); minimapRafRef.current = null }
      window.clearInterval(minimapInterval)
      cy.destroy()
      cyRef.current = null
    }
  }, [filteredEdges, filteredNodes, loading, layout])

  // ── When node selected, open file in inspector ─────────────────────────────
  useEffect(() => {
    if (selected?.path) {
      setInspectorFile(selected.path)
      setInspectorLine(selected.line_number)
    }
  }, [selected])

  // ── File tree selection → highlight in graph + open inspector ───────────────
  const handleSelectFile = useCallback((filePath: string) => {
    setSelectedFilePath(filePath)
    setInspectorFile(filePath)
    setInspectorLine(undefined)
    setQuery('')
    const cy = cyRef.current
    if (!cy) return
    const matchingIds = new Set(apiNodes.filter(n => n.path === filePath).map(n => String(n.id)))
    if (matchingIds.size > 0) {
      cy.elements().removeClass('dimmed neighbor active-edge')
      cy.elements().addClass('dimmed')
      cy.nodes().filter(n => matchingIds.has(n.id())).removeClass('dimmed').addClass('referenced')
      cy.edges().filter(e => matchingIds.has(e.data('source')) || matchingIds.has(e.data('target'))).removeClass('dimmed').addClass('active-edge')
      // Zoom to matching nodes
      const matchNodes = cy.nodes().filter(n => matchingIds.has(n.id()))
      if (matchNodes.length > 0 && matchNodes.length < 30) {
        cy.animate({ fit: { eles: matchNodes, padding: 80 }, duration: 500 } as any)
      }
    }
  }, [apiNodes])

  const clearHighlight = useCallback(() => {
    setSelectedFilePath(undefined)
    const cy = cyRef.current
    if (!cy) return
    cy.elements().removeClass('dimmed highlighted neighbor active-edge referenced')
  }, [])

  // ── Symbol click from Code Inspector → find & select in graph ──────────────
  const handleSymbolClick = useCallback((name: string) => {
    const cy = cyRef.current
    if (!cy) return
    const node = cy.nodes().filter((n: cytoscape.NodeSingular) => n.data('label') === name).first()
    if (node.length) {
      node.emit('tap')
      cy.animate({ center: { eles: node }, zoom: 2.5, duration: 500 } as any)
    }
  }, [])

  // ── Zoom handlers ──────────────────────────────────────────────────────────
  const handleZoomIn = () => { const cy = cyRef.current; if (cy) cy.zoom({ level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }) }
  const handleZoomOut = () => { const cy = cyRef.current; if (cy) cy.zoom({ level: cy.zoom() / 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }) }
  const handleFit = () => { if (cyRef.current) { cyRef.current.resize(); cyRef.current.fit(undefined, 40) } }

  // ── Export PNG ──────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    const blob = cy.png({ output: 'blob', bg: '#0a0a0f', scale: 2 } as cytoscape.ExportBlobOptions) as unknown as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'codegraph-nebula.png'; a.click()
    URL.revokeObjectURL(url)
  }, [])

  // ── Context menu actions ───────────────────────────────────────────────────
  const handleContextAction = useCallback((action: string) => {
    const cy = cyRef.current
    if (!cy || !contextMenu) return
    const nodeId = contextMenu.nodeId
    const node = cy.getElementById(nodeId)

    switch (action) {
      case 'show-callers': {
        const ids = new Set<string>([nodeId])
        node.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => { if (edge.data('target') === nodeId) ids.add(edge.data('source')) })
        cy.elements().addClass('dimmed')
        cy.nodes().filter((n: cytoscape.NodeSingular) => ids.has(n.id())).removeClass('dimmed').addClass('neighbor')
        node.removeClass('dimmed').addClass('selected-node')
        cy.edges().filter((e: cytoscape.EdgeSingular) => ids.has(e.data('source')) && e.data('target') === nodeId).removeClass('dimmed').addClass('active-edge')
        break
      }
      case 'show-callees': {
        const ids = new Set<string>([nodeId])
        node.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => { if (edge.data('source') === nodeId) ids.add(edge.data('target')) })
        cy.elements().addClass('dimmed')
        cy.nodes().filter((n: cytoscape.NodeSingular) => ids.has(n.id())).removeClass('dimmed').addClass('neighbor')
        node.removeClass('dimmed').addClass('selected-node')
        cy.edges().filter((e: cytoscape.EdgeSingular) => e.data('source') === nodeId && ids.has(e.data('target'))).removeClass('dimmed').addClass('active-edge')
        break
      }
      case 'expand-neighborhood': {
        const hood = node.neighborhood().add(node)
        cy.elements().addClass('dimmed')
        hood.nodes().removeClass('dimmed').addClass('neighbor')
        node.removeClass('dimmed').addClass('selected-node')
        hood.edges().removeClass('dimmed').addClass('active-edge')
        break
      }
      case 'pin-unpin': {
        if (node.locked()) { node.unlock(); node.removeClass('pinned') }
        else { node.lock(); node.addClass('pinned') }
        break
      }
      case 'copy-path': {
        navigator.clipboard.writeText(contextMenu.nodePath || contextMenu.nodeName).catch(() => {})
        break
      }
      case 'hide-node': {
        node.style('display', 'none'); node.connectedEdges().style('display', 'none')
        setHiddenNodes(prev => new Set(prev).add(nodeId))
        break
      }
    }
    setContextMenu(null)
  }, [contextMenu])

  // ── Close context menu on outside click ────────────────────────────────────
  useEffect(() => {
    if (!contextMenu) return
    const h = () => setContextMenu(null)
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [contextMenu])

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const cy = cyRef.current
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      switch (e.key) {
        case 'Escape':
          if (contextMenu) { setContextMenu(null); return }
          if (!cy) return
          cy.elements().removeClass('dimmed highlighted neighbor active-edge selected-node selected-pulse referenced')
          setSelected(null)
          break
        case '/': e.preventDefault(); searchInputRef.current?.focus(); break
        case 'f': if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); handleFit() } break
        case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight': {
          if (!cy || !selected) return
          e.preventDefault()
          const sel = cy.$('node.selected-node')
          if (!sel.length) return
          const neighbors: cytoscape.NodeSingular[] = []
          sel.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => {
            if (edge.source().id() !== sel.id()) neighbors.push(edge.source())
            if (edge.target().id() !== sel.id()) neighbors.push(edge.target())
          })
          if (!neighbors.length) return
          const pos = sel.position()
          let best = neighbors[0], bestScore = -Infinity
          for (const n of neighbors) {
            const np = n.position(), dx = np.x - pos.x, dy = np.y - pos.y
            let score = 0
            switch (e.key) {
              case 'ArrowRight': score = dx - Math.abs(dy); break
              case 'ArrowLeft': score = -dx - Math.abs(dy); break
              case 'ArrowDown': score = dy - Math.abs(dx); break
              case 'ArrowUp': score = -dy - Math.abs(dx); break
            }
            if (score > bestScore) { bestScore = score; best = n }
          }
          best.emit('tap')
          break
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, contextMenu])

  const visibleNodeCount = Math.min(
    filteredNodes.filter(n => {
      const id = String(n.id)
      return filteredEdges.some(e => String(e.source) === id || String(e.target) === id)
    }).length,
    MAX_RENDER_NODES,
  )

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER — 4-Panel Layout
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="flex flex-1 overflow-hidden">

        {/* ── Panel 1: File Tree (200px) ────────────────────────────────── */}
        <div className="flex w-[200px] shrink-0 flex-col border-r border-[#2a2a3a] bg-[#111118]">
          {/* Search */}
          <div className="border-b border-[#2a2a3a] p-2">
            <div className="relative">
              <MagnifyingGlass size={13} className="absolute left-2.5 top-2 text-[#555568]" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedFilePath(undefined) }}
                placeholder="Search nodes..."
                className="w-full rounded-md border border-[#2a2a3a] bg-[#0a0a0f] py-1.5 pl-7 pr-2 text-xs text-[#e0e0e8] outline-none placeholder:text-[#555568] focus:border-[#00d4aa]"
              />
            </div>
          </div>

          {/* Type filters */}
          <div className="border-b border-[#2a2a3a] px-2 py-1.5">
            <div className="mb-1 text-[9px] uppercase tracking-[0.1em] text-[#555568]">Node Types</div>
            {(['function', 'class', 'module', 'interface', 'variable', 'import'] as const).map(k => (
              <label key={k} className="flex cursor-pointer items-center justify-between py-0.5">
                <span className="flex items-center gap-1.5">
                  <input
                    type="checkbox" checked={filters[k] ?? true}
                    onChange={() => setFilters(prev => ({ ...prev, [k]: !(prev[k] ?? true) }))}
                    className="h-3 w-3 accent-[#00d4aa]"
                  />
                  <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[k] }} />
                  <span className="text-[10px] capitalize text-[#8888a0]">{k}</span>
                </span>
                <span className="text-[9px] font-mono text-[#555568]">{typeCounts[k] ?? 0}</span>
              </label>
            ))}
          </div>

          {/* File tree */}
          <div className="flex-1 overflow-auto px-2 py-1">
            {selectedFilePath && (
              <button onClick={clearHighlight} className="mb-1 w-full text-left text-[9px] text-[#00d4aa] hover:underline">
                Clear highlight
              </button>
            )}
            <FileTree nodes={apiNodes} selectedFilePath={selectedFilePath} onSelectFile={handleSelectFile} />
          </div>

          {/* Stats footer */}
          <div className="border-t border-[#2a2a3a] px-2 py-1.5 text-center font-mono text-[10px] text-[#555568]">
            {visibleNodeCount} nodes · {Math.min(filteredEdges.length, visibleNodeCount * 3)} edges
          </div>
        </div>

        {/* ── Panel 2: Code Inspector (340px) ──────────────────────────── */}
        <div className="w-[340px] shrink-0 border-r border-[#2a2a3a]">
          <CodeInspector
            filePath={inspectorFile}
            highlightLine={inspectorLine}
            onSymbolClick={handleSymbolClick}
          />
        </div>

        {/* ── Panel 3: Graph Canvas (flex-1) ───────────────────────────── */}
        <div className="relative flex-1 overflow-hidden" style={{ background: '#0a0a0f' }}>
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#00d4aa] border-t-transparent" />
                <span className="font-mono text-xs text-[#555568]">Generating graph…</span>
              </div>
            </div>
          )}

          {/* Cytoscape container */}
          <div ref={containerRef} className="absolute inset-0" />

          {/* Tooltip */}
          <div
            ref={tooltipRef}
            className="pointer-events-none fixed z-50 max-w-[260px] rounded-lg border border-[#3a3a4f] bg-[#1c1c28] px-3 py-2 text-xs text-[#e0e0e8] shadow-lg backdrop-blur-sm"
            style={{ opacity: 0, transition: 'opacity 120ms', fontFamily: 'var(--font-display)' }}
          />

          {/* Right-side zoom controls */}
          <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1.5 rounded-xl border border-[#2a2a3a] bg-[#111118]/90 p-1.5 backdrop-blur-md">
            <button onClick={handleZoomIn} className="rounded-md border border-[#2a2a3a] bg-[#0a0a0f] p-1.5 text-[#8888a0] hover:text-[#e0e0e8]" title="Zoom in"><Plus size={14} /></button>
            <button onClick={handleZoomOut} className="rounded-md border border-[#2a2a3a] bg-[#0a0a0f] p-1.5 text-[#8888a0] hover:text-[#e0e0e8]" title="Zoom out"><Minus size={14} /></button>
            <div className="mx-auto h-px w-5 bg-[#2a2a3a]" />
            <button onClick={handleFit} className="rounded-md border border-[#2a2a3a] bg-[#0a0a0f] p-1.5 text-[#8888a0] hover:text-[#e0e0e8]" title="Fit"><ArrowsOutSimple size={14} /></button>
            <div className="mx-auto h-px w-5 bg-[#2a2a3a]" />
            <button onClick={handleExport} className="rounded-md border border-[#2a2a3a] bg-[#0a0a0f] p-1.5 text-[#8888a0] hover:text-[#e0e0e8]" title="Export PNG"><Download size={14} /></button>
          </div>

          {/* Minimap (bottom-left) */}
          <div className="absolute bottom-12 left-3 z-10 overflow-hidden rounded-lg border border-[#2a2a3a] shadow-lg" style={{ width: 160, height: 100 }}>
            <canvas
              ref={minimapRef} width={160} height={100}
              className="block cursor-pointer" style={{ width: 160, height: 100 }}
              onClick={e => handleMinimapClick(e, cyRef.current)}
            />
            <span className="pointer-events-none absolute left-1.5 top-1 text-[8px] uppercase tracking-[0.1em] text-[#555568]" style={{ opacity: 0.5 }}>Map</span>
          </div>

          {/* Bottom status bar */}
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#2a2a3a] bg-[#111118]/90 px-3 py-1.5 backdrop-blur-md">
            {layoutRunning && <div className="h-3 w-3 animate-spin rounded-full border border-[#00d4aa] border-t-transparent" />}
            <span className="font-mono text-[10px] text-[#555568]">{visibleNodeCount} nodes</span>
            <div className="h-3 w-px bg-[#2a2a3a]" />
            <button
              className="font-mono text-[10px] text-[#8888a0] hover:text-[#e0e0e8]"
              onClick={() => setLayout(v => v === 'Force' ? 'Tree' : v === 'Tree' ? 'Radial' : v === 'Radial' ? 'Cluster' : 'Force')}
            >
              {layout} <CaretDown size={10} className="inline" />
            </button>
            <div className="h-3 w-px bg-[#2a2a3a]" />
            <button
              className={`font-mono text-[10px] ${repoFilter !== 'all' ? 'text-[#00d4aa]' : 'text-[#8888a0] hover:text-[#e0e0e8]'}`}
              onClick={() => { setRepoFilter(r => r === 'all' ? 'enterprise-erp-landscape' : 'all'); setLoading(true) }}
            >
              {repoFilter === 'all' ? 'All Repos' : 'ERP Demo'} <CaretDown size={10} className="inline" />
            </button>
            {demoMode && <span className="rounded-full bg-[#ff9100]/15 px-2 py-0.5 text-[9px] text-[#ff9100]">Demo</span>}
          </div>

          {/* Keyboard hints */}
          <div className="absolute left-3 top-3 z-10 rounded-md bg-[#111118]/70 px-2 py-1 text-[9px] text-[#555568] backdrop-blur">
            <span className="opacity-60">/</span> search · <span className="opacity-60">f</span> fit · <span className="opacity-60">Esc</span> clear · drag pin · dbl-click unpin
          </div>

          {/* Hidden nodes indicator */}
          {hiddenNodes.size > 0 && (
            <button
              onClick={() => {
                const cy = cyRef.current; if (!cy) return
                hiddenNodes.forEach(id => { const n = cy.getElementById(id); n.style('display', 'element'); n.connectedEdges().style('display', 'element') })
                setHiddenNodes(new Set())
              }}
              className="absolute right-3 top-3 z-10 rounded-md border border-[#2a2a3a] bg-[#111118]/90 px-2 py-1 text-[10px] text-[#555568] backdrop-blur hover:text-[#e0e0e8]"
            >
              {hiddenNodes.size} hidden — restore
            </button>
          )}
        </div>
      </div>

      {/* ── Bottom Detail Bar (selected node) ────────────────────────────── */}
      {selected && (
        <div className="shrink-0 border-t border-[#2a2a3a] bg-[#111118] px-4 py-2.5">
          <div className="flex items-center gap-4">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: nodeColor(selected.type), boxShadow: `0 0 8px ${nodeColor(selected.type)}60` }} />
            <span className="truncate text-sm font-semibold text-[#e0e0e8]" style={{ fontFamily: 'var(--font-display)' }}>{selected.name}</span>
            <span className="rounded-full border border-[#2a2a3a] px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-[#8888a0]">{selected.type}</span>
            {/* Risk score */}
            {(() => {
              const c = selected.connections ?? 0
              const risk = Math.min(100, Math.round(c * 3 + (selected.type === 'class' ? 20 : 0)))
              const color = risk >= 70 ? '#f85149' : risk >= 40 ? '#ff9100' : '#3fb950'
              return <span className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>Risk {risk >= 70 ? 'High' : risk >= 40 ? 'Med' : 'Low'}</span>
            })()}
            <span className="font-mono text-[10px] text-[#555568]">{selected.connections ?? 0} conn</span>
            <span className="truncate text-[10px] text-[#555568]" style={{ fontFamily: 'var(--font-display)' }}>{selected.path ?? ''}</span>
            {selected.line_number && <span className="font-mono text-[10px] text-[#555568]">L{selected.line_number}</span>}

            <div className="ml-auto flex items-center gap-2">
              <button className="rounded-md border border-[#2a2a3a] bg-[#0a0a0f] px-2.5 py-1 text-[10px] text-[#8888a0] hover:text-[#e0e0e8]">View Impact</button>
              <button className="rounded-md border border-[#2a2a3a] bg-[#0a0a0f] px-2.5 py-1 text-[10px] text-[#8888a0] hover:text-[#e0e0e8]">Export PDF</button>
            </div>
          </div>

          {/* Callers / Callees */}
          {((selected.callers?.length ?? 0) > 0 || (selected.callees?.length ?? 0) > 0) && (
            <div className="mt-2 flex gap-6">
              {/* Callers */}
              <div className="min-w-0 flex-1">
                <button onClick={() => setCallersOpen(v => !v)} className="flex items-center gap-1 text-[9px] uppercase tracking-[0.08em] text-[#555568] hover:text-[#8888a0]">
                  <CaretRight size={10} className={`transition-transform ${callersOpen ? 'rotate-90' : ''}`} />
                  Callers ({selected.callers?.length ?? 0})
                </button>
                {callersOpen && selected.callers?.map((c, i) => (
                  <div key={i} className="mt-1 flex items-center gap-2 text-[10px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d4aa]" />
                    <span className="truncate text-[#e0e0e8]" style={{ fontFamily: 'var(--font-display)' }}>{c.function_name}</span>
                    <span className="truncate text-[#555568]">{c.path}{c.line_number ? `:${c.line_number}` : ''}</span>
                  </div>
                ))}
              </div>
              {/* Callees */}
              <div className="min-w-0 flex-1">
                <button onClick={() => setCalleesOpen(v => !v)} className="flex items-center gap-1 text-[9px] uppercase tracking-[0.08em] text-[#555568] hover:text-[#8888a0]">
                  <CaretRight size={10} className={`transition-transform ${calleesOpen ? 'rotate-90' : ''}`} />
                  Callees ({selected.callees?.length ?? 0})
                </button>
                {calleesOpen && selected.callees?.map((c, i) => (
                  <div key={i} className="mt-1 flex items-center gap-2 text-[10px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00d4aa]" />
                    <span className="truncate text-[#e0e0e8]" style={{ fontFamily: 'var(--font-display)' }}>{c.function_name}</span>
                    <span className="truncate text-[#555568]">{c.path}{c.line_number ? `:${c.line_number}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Context Menu ──────────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[180px] rounded-lg border border-[#3a3a4f] bg-[#1c1c28] py-1.5 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y, fontFamily: 'var(--font-display)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.08em] text-[#555568]">{contextMenu.nodeName}</div>
          {([
            { key: 'show-callers', label: 'Show Callers', icon: <CaretRight size={12} className="rotate-180" /> },
            { key: 'show-callees', label: 'Show Callees', icon: <CaretRight size={12} /> },
            { key: 'expand-neighborhood', label: 'Expand Neighborhood', icon: <ArrowsOutSimple size={12} /> },
            { key: 'pin-unpin', label: 'Pin / Unpin', icon: <PushPin size={12} /> },
            { key: 'copy-path', label: 'Copy Path', icon: <Copy size={12} /> },
            { key: 'hide-node', label: 'Hide Node', icon: <EyeSlash size={12} /> },
          ] as const).map(item => (
            <button
              key={item.key}
              onClick={() => handleContextAction(item.key)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#e0e0e8] hover:bg-[#2a2a3a]"
            >
              <span className="text-[#555568]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
