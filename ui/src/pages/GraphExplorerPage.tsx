import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import { CaretDown, CaretRight, MagnifyingGlass, Minus, Plus, ArrowsClockwise, Download, Copy, EyeSlash, ArrowsOutSimple, PushPin } from '@phosphor-icons/react'
import { FileTree } from '@/components/graph/FileTree'
import { generateMockGraph } from '@/data/generateGraph'

cytoscape.use(fcose as Parameters<typeof cytoscape.use>[0])

type ApiNode = { id: number; name: string; type: string; path?: string; line_number?: number }
type ApiEdge = { source: number; target: number; kind?: string; type?: string }
type ApiResponse = { nodes: ApiNode[]; edges: ApiEdge[] }
type CallerCallee = { function_name: string; path: string; line_number: number }
type ContextMenu = { x: number; y: number; nodeId: string; nodeName: string; nodePath: string } | null

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

// Type-based coloring — matches spec
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

const MAX_RENDER_NODES = 500
const ROTATION_SPEED = 0.0003
const IDLE_RESUME_MS = 2500

// ---- Semantic Clustering Hull colors ----
const HULL_COLORS = [
  'rgba(108, 92, 231, ',  // purple
  'rgba(6, 214, 160, ',   // green
  'rgba(255, 0, 110, ',   // pink
  'rgba(255, 210, 63, ',  // yellow
  'rgba(72, 191, 227, ',  // cyan
  'rgba(131, 56, 236, ',  // violet
  'rgba(58, 134, 255, ',  // blue
  'rgba(255, 107, 107, ', // red
]

// ---- Convex hull (Graham scan) ----
function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 3) return points
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (O: typeof sorted[0], A: typeof sorted[0], B: typeof sorted[0]) =>
    (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x)
  const lower: typeof sorted = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: typeof sorted = []
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

// ---- Expand hull outward from centroid ----
function expandHull(hull: { x: number; y: number }[], padding: number): { x: number; y: number }[] {
  if (hull.length === 0) return hull
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length
  return hull.map(p => {
    const dx = p.x - cx
    const dy = p.y - cy
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    return { x: p.x + (dx / dist) * padding, y: p.y + (dy / dist) * padding }
  })
}

// ---- Draw minimap ----
function drawMinimap(cy: cytoscape.Core, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)

  // Background
  ctx.fillStyle = 'rgba(13, 17, 23, 0.8)'
  ctx.fillRect(0, 0, w, h)

  const elems = cy.elements()
  if (elems.length === 0) return
  const bb = elems.boundingBox()
  if (bb.w === 0 && bb.h === 0) return

  const padBB = 40
  const scaleX = w / (bb.w + padBB)
  const scaleY = h / (bb.h + padBB)
  const scale = Math.min(scaleX, scaleY)
  const offsetX = (w - bb.w * scale) / 2
  const offsetY = (h - bb.h * scale) / 2

  // Draw edges
  ctx.strokeStyle = 'rgba(100, 100, 140, 0.15)'
  ctx.lineWidth = 0.5
  cy.edges().forEach(edge => {
    const sp = edge.source().position()
    const tp = edge.target().position()
    ctx.beginPath()
    ctx.moveTo((sp.x - bb.x1) * scale + offsetX, (sp.y - bb.y1) * scale + offsetY)
    ctx.lineTo((tp.x - bb.x1) * scale + offsetX, (tp.y - bb.y1) * scale + offsetY)
    ctx.stroke()
  })

  // Draw nodes
  cy.nodes().forEach(node => {
    const pos = node.position()
    const x = (pos.x - bb.x1) * scale + offsetX
    const y = (pos.y - bb.y1) * scale + offsetY
    ctx.fillStyle = (node.data('nodeColor') as string) ?? '#06d6a0'
    ctx.beginPath()
    ctx.arc(x, y, 1.5, 0, Math.PI * 2)
    ctx.fill()
  })

  // Draw viewport rectangle
  const ext = cy.extent()
  const vx = (ext.x1 - bb.x1) * scale + offsetX
  const vy = (ext.y1 - bb.y1) * scale + offsetY
  const vw = (ext.x2 - ext.x1) * scale
  const vh = (ext.y2 - ext.y1) * scale
  ctx.strokeStyle = 'rgba(108, 92, 231, 0.8)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(vx, vy, vw, vh)
  ctx.fillStyle = 'rgba(108, 92, 231, 0.08)'
  ctx.fillRect(vx, vy, vw, vh)
}

// ---- Draw clustering hulls ----
function drawHulls(cy: cytoscape.Core, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  // Clear using full device-pixel dimensions
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()

  // Build cluster map from file paths
  const clusterMap = new Map<string, cytoscape.NodeSingular[]>()
  cy.nodes().forEach(node => {
    const path = (node.data('filePath') as string) ?? ''
    const parts = path.split('/')
    const cluster = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0] || 'other'
    if (!clusterMap.has(cluster)) clusterMap.set(cluster, [])
    clusterMap.get(cluster)!.push(node)
  })

  const zoom = cy.zoom()
  const pan = cy.pan()
  let colorIdx = 0

  clusterMap.forEach((nodes, clusterName) => {
    if (nodes.length < 3) { colorIdx++; return }
    const color = HULL_COLORS[colorIdx % HULL_COLORS.length]
    colorIdx++

    // Get rendered positions
    const points = nodes.map(n => {
      const p = n.position()
      return { x: p.x * zoom + pan.x, y: p.y * zoom + pan.y }
    })

    const hull = convexHull(points)
    if (hull.length < 3) return
    const expanded = expandHull(hull, 25)

    // Draw with smooth bezier curves
    ctx.beginPath()
    const len = expanded.length
    // Start at midpoint of first edge
    const startX = (expanded[len - 1].x + expanded[0].x) / 2
    const startY = (expanded[len - 1].y + expanded[0].y) / 2
    ctx.moveTo(startX, startY)
    for (let i = 0; i < len; i++) {
      const curr = expanded[i]
      const next = expanded[(i + 1) % len]
      const midX = (curr.x + next.x) / 2
      const midY = (curr.y + next.y) / 2
      ctx.quadraticCurveTo(curr.x, curr.y, midX, midY)
    }
    ctx.closePath()

    // Fill
    ctx.fillStyle = color + '0.05)'
    ctx.fill()
    // Stroke
    ctx.strokeStyle = color + '0.15)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Label at centroid
    const centX = points.reduce((s, p) => s + p.x, 0) / points.length
    const centY = points.reduce((s, p) => s + p.y, 0) / points.length
    ctx.font = '9px "JetBrains Mono", monospace'
    ctx.fillStyle = color + '0.35)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Use short cluster label
    const label = clusterName.length > 20 ? clusterName.slice(0, 20) + '...' : clusterName
    ctx.fillText(label, centX, centY)
  })
}

// ---- Minimap click → pan ----
function handleMinimapClick(e: React.MouseEvent<HTMLCanvasElement>, cy: cytoscape.Core | null) {
  if (!cy) return
  const canvas = e.currentTarget
  const rect = canvas.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const clickY = e.clientY - rect.top
  const w = canvas.width
  const h = canvas.height

  const elems = cy.elements()
  if (elems.length === 0) return
  const bb = elems.boundingBox()
  if (bb.w === 0 && bb.h === 0) return

  const padBB = 40
  const scaleX = w / (bb.w + padBB)
  const scaleY = h / (bb.h + padBB)
  const scale = Math.min(scaleX, scaleY)
  const offsetX = (w - bb.w * scale) / 2
  const offsetY = (h - bb.h * scale) / 2

  // Convert minimap coords to model coords
  const modelX = (clickX - offsetX) / scale + bb.x1
  const modelY = (clickY - offsetY) / scale + bb.y1

  cy.animate({
    center: { eles: cy.collection() },
    duration: 200,
  })
  // Pan so the clicked model point is at center of viewport
  const vpW = cy.width()
  const vpH = cy.height()
  const zoom = cy.zoom()
  cy.pan({ x: vpW / 2 - modelX * zoom, y: vpH / 2 - modelY * zoom })
}

export default function GraphExplorerPage() {
  const [apiNodes, setApiNodes] = useState<ApiNode[]>([])
  const [apiEdges, setApiEdges] = useState<ApiEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useState<'Force' | 'Tree' | 'Radial' | 'Cluster'>('Force')
  const [layoutRunning, setLayoutRunning] = useState(false)
  const [filters, setFilters] = useState<Record<string, boolean>>({ function: true, class: true, module: true })
  const [selected, setSelected] = useState<{ name: string; type: string; path?: string; line_number?: number; connections?: number; callers?: CallerCallee[]; callees?: CallerCallee[] } | null>(null)
  const [rotating, setRotating] = useState(true)
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>(undefined)
  const [demoMode, setDemoMode] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null)
  const [callersOpen, setCallersOpen] = useState(true)
  const [calleesOpen, setCalleesOpen] = useState(true)
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pulseIntervalRef = useRef<number | null>(null)
  const rotationRef = useRef<number | null>(null)
  const interactingRef = useRef(false)
  const idleTimerRef = useRef<number | null>(null)
  const rotatingRef = useRef(true)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const minimapRef = useRef<HTMLCanvasElement>(null)
  const hullCanvasRef = useRef<HTMLCanvasElement>(null)
  const minimapRafRef = useRef<number | null>(null)
  const hullRafRef = useRef<number | null>(null)

  // Fetch data — fallback to procedural generation
  useEffect(() => {
    fetch('/api/graph?limit=500')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ApiResponse) => {
        setApiNodes(data.nodes)
        setApiEdges(data.edges)
      })
      .catch(() => {
        // Fallback to procedurally generated demo data
        const mock = generateMockGraph(500)
        setApiNodes(mock.nodes)
        setApiEdges(mock.edges)
        setDemoMode(true)
      })
      .finally(() => setLoading(false))
  }, [])

  // Fetch callers/callees for a selected node
  const fetchCallersCallees = useCallback((nodeName: string, nodeId: string) => {
    const cy = cyRef.current

    // Build mock data from graph edges as fallback
    const buildMockFromEdges = (): { callers: CallerCallee[]; callees: CallerCallee[] } => {
      if (!cy) return { callers: [], callees: [] }
      const node = cy.getElementById(nodeId)
      if (!node.length) return { callers: [], callees: [] }
      const callersList: CallerCallee[] = []
      const calleesList: CallerCallee[] = []
      node.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => {
        const src = edge.source()
        const tgt = edge.target()
        if (tgt.id() === nodeId) {
          callersList.push({ function_name: src.data('label'), path: src.data('filePath') ?? '', line_number: src.data('lineNumber') ?? 0 })
        }
        if (src.id() === nodeId) {
          calleesList.push({ function_name: tgt.data('label'), path: tgt.data('filePath') ?? '', line_number: tgt.data('lineNumber') ?? 0 })
        }
      })
      return { callers: callersList.slice(0, 8), callees: calleesList.slice(0, 8) }
    }

    const callersP = fetch(`/api/analysis/callers/${encodeURIComponent(nodeName)}`)
      .then(r => r.ok ? r.json() as Promise<CallerCallee[]> : Promise.reject(new Error('not found')))
      .catch(() => null)

    const calleesP = fetch(`/api/analysis/calls/${encodeURIComponent(nodeName)}`)
      .then(r => r.ok ? r.json() as Promise<CallerCallee[]> : Promise.reject(new Error('not found')))
      .catch(() => null)

    Promise.all([callersP, calleesP]).then(([callers, callees]) => {
      if (!callers || !callees) {
        const mock = buildMockFromEdges()
        setSelected(prev => prev?.name === nodeName ? { ...prev, callers: callers ?? mock.callers, callees: callees ?? mock.callees } : prev)
      } else {
        setSelected(prev => prev?.name === nodeName ? { ...prev, callers: callers.slice(0, 8), callees: callees.slice(0, 8) } : prev)
      }
    })
  }, [])

  // Filtered data — search highlights rather than removes
  const filteredNodes = useMemo(() => {
    return apiNodes.filter((n) => {
      const t = (n.type || 'function').toLowerCase()
      return filters[t] ?? true
    })
  }, [apiNodes, filters])

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes])
  const filteredEdges = useMemo(
    () => apiEdges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)),
    [apiEdges, filteredNodeIds],
  )

  // Search match IDs for highlighting
  const searchMatchIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return new Set(
      filteredNodes.filter(n => n.name.toLowerCase().includes(q)).map(n => String(n.id))
    )
  }, [filteredNodes, query])

  const typeCounts = useMemo(() => {
    const base = { function: 0, class: 0, module: 0 }
    apiNodes.forEach((n) => {
      const t = (n.type || 'function').toLowerCase() as keyof typeof base
      if (t in base) base[t] += 1
    })
    return base
  }, [apiNodes])

  useEffect(() => { rotatingRef.current = rotating }, [rotating])

  // Apply search highlight to existing graph (without rebuilding)
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !cy.elements().length) return

    if (!searchMatchIds) {
      // No search — restore full opacity
      cy.nodes().animate({ style: { opacity: 1 } } as any, { duration: 200 })
      cy.edges().animate({ style: { opacity: 0.25 } } as any, { duration: 200 })
    } else {
      cy.nodes().animate({
        style: { opacity: (ele: cytoscape.NodeSingular) => searchMatchIds.has(ele.id()) ? 1 : 0.08 }
      } as any, { duration: 200 })
      cy.edges().animate({
        style: {
          opacity: (ele: cytoscape.EdgeSingular) =>
            (searchMatchIds.has(ele.data('source')) || searchMatchIds.has(ele.data('target'))) ? 0.6 : 0.03
        }
      } as any, { duration: 200 })
    }
  }, [searchMatchIds])

  // Build Cytoscape graph
  useEffect(() => {
    if (loading || !containerRef.current) return

    // Clean up previous
    if (pulseIntervalRef.current !== null) { window.clearInterval(pulseIntervalRef.current); pulseIntervalRef.current = null }
    if (rotationRef.current !== null) { cancelAnimationFrame(rotationRef.current); rotationRef.current = null }
    if (idleTimerRef.current !== null) { window.clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null }

    const edgeCount: Record<string, number> = {}
    for (const e of filteredEdges) {
      const s = String(e.source), t = String(e.target)
      edgeCount[s] = (edgeCount[s] ?? 0) + 1
      edgeCount[t] = (edgeCount[t] ?? 0) + 1
    }

    // Only connected nodes
    const connectedNodeIds = new Set<string>()
    for (const e of filteredEdges) {
      connectedNodeIds.add(String(e.source))
      connectedNodeIds.add(String(e.target))
    }
    const connectedNodes = filteredNodes.filter(n => connectedNodeIds.has(String(n.id)))

    const sortedNodes = [...connectedNodes]
      .sort((a, b) => (edgeCount[String(b.id)] ?? 0) - (edgeCount[String(a.id)] ?? 0))
      .slice(0, MAX_RENDER_NODES)
    const visibleIds = new Set(sortedNodes.map(n => String(n.id)))
    const visibleEdges = filteredEdges.filter(e => visibleIds.has(String(e.source)) && visibleIds.has(String(e.target)))

    let layoutConfig: cytoscape.LayoutOptions
    if (layout === 'Tree') {
      layoutConfig = {
        name: 'breadthfirst',
        directed: true,
        spacingFactor: 0.6,
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 20,
      } as cytoscape.LayoutOptions
    } else if (layout === 'Radial') {
      layoutConfig = {
        name: 'concentric',
        concentric: (node: cytoscape.NodeSingular) => Number(node.data('connectionCount') ?? 0),
        levelWidth: () => 5,
        animate: true,
        animationDuration: 500,
        minNodeSpacing: 8,
        fit: true,
        padding: 20,
      } as cytoscape.LayoutOptions
    } else if (layout === 'Cluster') {
      layoutConfig = {
        name: 'cose',
        animate: true,
        randomize: false,
        componentSpacing: 10,
        nodeRepulsion: () => 4000,
        gravity: 0.6,
        idealEdgeLength: () => 40,
        numIter: 2000,
        fit: true,
        padding: 20,
        nestingFactor: 1.5,
        gravityRange: 2.5,
      } as cytoscape.LayoutOptions
    } else {
      layoutConfig = {
        name: 'cose',
        animate: true,
        randomize: false,
        componentSpacing: 20,
        nodeRepulsion: () => 2000,
        gravity: 1.2,
        idealEdgeLength: () => 30,
        numIter: 1500,
        fit: true,
        padding: 30,
        nestingFactor: 1.2,
        gravityRange: 3.8,
      } as cytoscape.LayoutOptions
    }

    const cy = cytoscape({
      container: containerRef.current,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      autoungrabify: false,
      textureOnViewport: true,
      hideEdgesOnViewport: true,
      hideLabelsOnViewport: true,
      elements: [
        ...sortedNodes.map(n => {
          const kind = (n.type || 'function').toLowerCase()
          return {
            data: {
              id: String(n.id),
              label: n.name,
              kind,
              filePath: n.path,
              lineNumber: n.line_number,
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
            'font-size': 10,
            'font-family': 'JetBrains Mono, monospace',
            color: '#e2e8f0',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            'background-color': 'data(nodeColor)',
            'border-width': 0,
            'border-color': '#ffffff',
            // Size 8-24px based on degree centrality
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
            'outline-opacity': 1,
            'text-wrap': 'ellipsis',
            'text-max-width': '100px',
            'text-outline-color': '#0d1117',
            'text-outline-width': 2,
            'min-zoomed-font-size': 10,
            'text-background-color': '#0d1117',
            'text-background-opacity': 0.7,
            'text-background-padding': '2px',
            'shadow-color': 'data(nodeColor)',
            'shadow-opacity': 0.35,
            'shadow-blur': 6,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0,
            'transition-property': 'opacity',
            'transition-duration': 300,
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
          selector: 'node:grabbed',
          style: {
            'border-width': 2,
            'border-color': '#ffd23f',
            'shadow-opacity': 1,
            'shadow-blur': 16,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.pinned',
          style: {
            'border-width': 1.5,
            'border-color': '#ffd23f',
            'border-style': 'dashed',
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
            'transition-property': 'opacity',
            'transition-duration': 300,
          } as cytoscape.Css.Edge,
        },
      ],
      layout: layoutConfig,
    })

    // ---- Node click → select + highlight neighbors ----
    cy.on('tap', 'node', (e) => {
      cy.nodes().removeClass('selected-node selected-pulse')
      e.target.addClass('selected-node')
      const nodeId = e.target.id()

      // Highlight this node + direct neighbors, dim everything else
      const neighbors = new Set<string>([nodeId])
      e.target.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => {
        neighbors.add(edge.data('source'))
        neighbors.add(edge.data('target'))
      })
      cy.nodes().style('opacity', (ele: cytoscape.NodeSingular) =>
        neighbors.has(ele.id()) ? 1 : 0.08)
      cy.edges().style('opacity', (ele: cytoscape.EdgeSingular) =>
        (ele.data('source') === nodeId || ele.data('target') === nodeId) ? 0.8 : 0.03)

      const nodeName = e.target.data('label')
      setSelected({
        name: nodeName,
        type: e.target.data('kind'),
        path: e.target.data('filePath'),
        line_number: e.target.data('lineNumber'),
        connections: Number(e.target.data('connectionCount') ?? 0),
      })
      setContextMenu(null)
      fetchCallersCallees(nodeName, nodeId)
    })

    // ---- Right-click context menu ----
    cy.on('cxttap', 'node', (e) => {
      const renderedPos = e.renderedPosition
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return
      setContextMenu({
        x: containerRect.left + renderedPos.x,
        y: containerRect.top + renderedPos.y,
        nodeId: e.target.id(),
        nodeName: e.target.data('label'),
        nodePath: e.target.data('filePath') ?? '',
      })
    })

    // ---- Hover → glow + tooltip ----
    cy.on('mouseover', 'node', (e) => {
      e.target.addClass('hover-node')
      // Show tooltip
      const tooltip = tooltipRef.current
      if (tooltip) {
        const kind = e.target.data('kind')
        const conns = e.target.data('connectionCount') ?? 0
        tooltip.innerHTML = `
          <div style="font-weight:600;margin-bottom:2px">${e.target.data('label')}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${nodeColor(kind)}"></span>
            <span style="text-transform:uppercase;font-size:9px;letter-spacing:0.06em;opacity:0.7">${kind}</span>
          </div>
          <div style="opacity:0.6;font-size:10px">${conns} connection${conns !== 1 ? 's' : ''}</div>
        `
        tooltip.style.opacity = '1'
      }
    })
    cy.on('mouseout', 'node', (e) => {
      e.target.removeClass('hover-node')
      const tooltip = tooltipRef.current
      if (tooltip) tooltip.style.opacity = '0'
    })
    // Track mouse for tooltip positioning
    const handleMouseMove = (evt: MouseEvent) => {
      const tooltip = tooltipRef.current
      if (!tooltip) return
      tooltip.style.left = `${evt.clientX + 14}px`
      tooltip.style.top = `${evt.clientY - 10}px`
    }
    document.addEventListener('mousemove', handleMouseMove)

    // ---- Background click → deselect, restore opacity ----
    cy.on('tap', (e) => {
      if (e.target === cy) {
        cy.nodes().removeClass('selected-node selected-pulse')
        cy.nodes().style('opacity', 1)
        cy.edges().style('opacity', 0.25)
        setSelected(null)
        setContextMenu(null)
      }
    })

    // ---- Drag → pin node position ----
    cy.on('free', 'node', (e) => {
      e.target.lock()
      e.target.addClass('pinned')
    })
    // Double-click → unpin
    cy.on('dbltap', 'node', (e) => {
      e.target.unlock()
      e.target.removeClass('pinned')
    })

    // ---- Pause rotation during interaction ----
    const pauseRotation = () => {
      interactingRef.current = true
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(() => {
        interactingRef.current = false
      }, IDLE_RESUME_MS)
    }
    cy.on('pan zoom drag tapstart', pauseRotation)

    // ---- Pulse animation ----
    pulseIntervalRef.current = window.setInterval(() => {
      const sel = cy.$('node.selected-node')
      if (sel.length === 0) return
      if (sel.hasClass('selected-pulse')) sel.removeClass('selected-pulse')
      else sel.addClass('selected-pulse')
    }, 700)

    // ---- Ambient rotation ----
    function rotateGraph() {
      if (rotatingRef.current && !interactingRef.current && cy && !cy.destroyed()) {
        const bb = cy.elements().boundingBox()
        const cx = (bb.x1 + bb.x2) / 2
        const cyCenter = (bb.y1 + bb.y2) / 2
        const cos = Math.cos(ROTATION_SPEED)
        const sin = Math.sin(ROTATION_SPEED)

        cy.nodes().positions((node) => {
          if (node.locked()) return node.position() // Don't rotate pinned nodes
          const pos = node.position()
          const dx = pos.x - cx
          const dy = pos.y - cyCenter
          return {
            x: cx + dx * cos - dy * sin,
            y: cyCenter + dx * sin + dy * cos,
          }
        })
      }
      rotationRef.current = requestAnimationFrame(rotateGraph)
    }

    cy.on('layoutstart', () => setLayoutRunning(true))
    cy.one('layoutstop', () => {
      setLayoutRunning(false)
      rotationRef.current = requestAnimationFrame(rotateGraph)
    })

    // ---- Minimap + Hull overlay drawing ----
    const scheduleMinimapDraw = () => {
      if (minimapRafRef.current !== null) cancelAnimationFrame(minimapRafRef.current)
      minimapRafRef.current = requestAnimationFrame(() => {
        if (minimapRef.current && !cy.destroyed()) drawMinimap(cy, minimapRef.current)
      })
    }
    const scheduleHullDraw = () => {
      if (hullRafRef.current !== null) cancelAnimationFrame(hullRafRef.current)
      hullRafRef.current = requestAnimationFrame(() => {
        if (hullCanvasRef.current && !cy.destroyed()) {
          // Resize hull canvas to match container
          const container = containerRef.current
          if (container) {
            const dpr = window.devicePixelRatio || 1
            const cw = container.clientWidth
            const ch = container.clientHeight
            if (hullCanvasRef.current.width !== cw * dpr || hullCanvasRef.current.height !== ch * dpr) {
              hullCanvasRef.current.width = cw * dpr
              hullCanvasRef.current.height = ch * dpr
              hullCanvasRef.current.style.width = cw + 'px'
              hullCanvasRef.current.style.height = ch + 'px'
              hullCanvasRef.current.getContext('2d')?.scale(dpr, dpr)
            }
            // Override w/h for drawing in CSS pixels
            const ctx = hullCanvasRef.current.getContext('2d')
            if (ctx) {
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            }
          }
          drawHulls(cy, hullCanvasRef.current)
        }
      })
    }
    const scheduleOverlaysDraw = () => {
      scheduleMinimapDraw()
      scheduleHullDraw()
    }

    cy.on('viewport', scheduleOverlaysDraw)
    cy.on('layoutstop', scheduleOverlaysDraw)
    cy.on('position', scheduleOverlaysDraw)
    // Also draw overlays during rotation via a recurring check
    const overlayInterval = window.setInterval(scheduleOverlaysDraw, 100)

    cyRef.current = cy

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (pulseIntervalRef.current !== null) { window.clearInterval(pulseIntervalRef.current); pulseIntervalRef.current = null }
      if (rotationRef.current !== null) { cancelAnimationFrame(rotationRef.current); rotationRef.current = null }
      if (idleTimerRef.current !== null) { window.clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
      if (minimapRafRef.current !== null) { cancelAnimationFrame(minimapRafRef.current); minimapRafRef.current = null }
      if (hullRafRef.current !== null) { cancelAnimationFrame(hullRafRef.current); hullRafRef.current = null }
      window.clearInterval(overlayInterval)
      cy.destroy()
      cyRef.current = null
    }
  }, [filteredEdges, filteredNodes, loading, layout])

  // File tree → highlight matching nodes
  const handleSelectFile = useCallback((filePath: string) => {
    setSelectedFilePath(filePath)
    setQuery('')
    const cy = cyRef.current
    if (!cy) return
    const matchingIds = new Set(
      apiNodes.filter(n => n.path === filePath).map(n => String(n.id))
    )
    if (matchingIds.size > 0) {
      cy.nodes().style('opacity', (ele: cytoscape.NodeSingular) =>
        matchingIds.has(ele.id()) ? 1 : 0.08)
      cy.edges().style('opacity', (ele: cytoscape.EdgeSingular) =>
        (matchingIds.has(ele.data('source')) || matchingIds.has(ele.data('target'))) ? 0.8 : 0.03)
    }
  }, [apiNodes])

  const clearHighlight = useCallback(() => {
    setSelectedFilePath(undefined)
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().style('opacity', 1)
    cy.edges().style('opacity', 0.25)
  }, [])

  const handleZoomIn = () => {
    const cy = cyRef.current
    if (!cy) return
    cy.zoom({ level: cy.zoom() * 1.2, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
  }
  const handleZoomOut = () => {
    const cy = cyRef.current
    if (!cy) return
    cy.zoom({ level: cy.zoom() / 1.2, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
  }
  const handleFit = () => {
    cyRef.current?.fit(undefined, 40)
  }

  // ---- Context menu actions ----
  const handleContextAction = useCallback((action: string) => {
    const cy = cyRef.current
    if (!cy || !contextMenu) return
    const nodeId = contextMenu.nodeId
    const node = cy.getElementById(nodeId)

    switch (action) {
      case 'show-callers': {
        const callerIds = new Set<string>([nodeId])
        node.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => {
          if (edge.data('target') === nodeId) callerIds.add(edge.data('source'))
        })
        cy.nodes().style('opacity', (ele: cytoscape.NodeSingular) => callerIds.has(ele.id()) ? 1 : 0.08)
        cy.edges().style('opacity', (ele: cytoscape.EdgeSingular) => callerIds.has(ele.data('source')) && ele.data('target') === nodeId ? 0.8 : 0.03)
        break
      }
      case 'show-callees': {
        const calleeIds = new Set<string>([nodeId])
        node.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => {
          if (edge.data('source') === nodeId) calleeIds.add(edge.data('target'))
        })
        cy.nodes().style('opacity', (ele: cytoscape.NodeSingular) => calleeIds.has(ele.id()) ? 1 : 0.08)
        cy.edges().style('opacity', (ele: cytoscape.EdgeSingular) => ele.data('source') === nodeId && calleeIds.has(ele.data('target')) ? 0.8 : 0.03)
        break
      }
      case 'expand-neighborhood': {
        const neighborIds = new Set<string>([nodeId])
        node.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => {
          neighborIds.add(edge.data('source'))
          neighborIds.add(edge.data('target'))
        })
        cy.nodes().style('opacity', (ele: cytoscape.NodeSingular) => neighborIds.has(ele.id()) ? 1 : 0.08)
        cy.edges().style('opacity', (ele: cytoscape.EdgeSingular) =>
          (ele.data('source') === nodeId || ele.data('target') === nodeId) ? 0.8 : 0.03)
        break
      }
      case 'pin-unpin': {
        if (node.locked()) {
          node.unlock()
          node.removeClass('pinned')
        } else {
          node.lock()
          node.addClass('pinned')
        }
        break
      }
      case 'copy-path': {
        const path = contextMenu.nodePath || contextMenu.nodeName
        navigator.clipboard.writeText(path).catch(() => { /* clipboard not available */ })
        break
      }
      case 'hide-node': {
        node.style('display', 'none')
        node.connectedEdges().style('display', 'none')
        setHiddenNodes(prev => new Set(prev).add(nodeId))
        break
      }
    }
    setContextMenu(null)
  }, [contextMenu])

  // ---- Export graph as PNG ----
  const handleExport = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    const blob = cy.png({ output: 'blob', bg: '#0d1117', scale: 2 } as cytoscape.ExportBlobOptions) as unknown as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'codegraph-export.png'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // ---- Close context menu on outside click ----
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  // ---- Keyboard navigation ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const cy = cyRef.current
      // Don't handle keys when typing in an input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur()
        }
        return
      }

      switch (e.key) {
        case 'Escape': {
          if (contextMenu) {
            setContextMenu(null)
            return
          }
          if (!cy) return
          cy.nodes().removeClass('selected-node selected-pulse')
          cy.nodes().style('opacity', 1)
          cy.edges().style('opacity', 0.25)
          setSelected(null)
          break
        }
        case '/': {
          e.preventDefault()
          searchInputRef.current?.focus()
          break
        }
        case 'f': {
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            cy?.fit(undefined, 40)
          }
          break
        }
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (!cy || !selected) return
          e.preventDefault()
          const selectedNode = cy.$('node.selected-node')
          if (!selectedNode.length) return
          const neighbors: cytoscape.NodeSingular[] = []
          selectedNode.connectedEdges().forEach((edge: cytoscape.EdgeSingular) => {
            const src = edge.source()
            const tgt = edge.target()
            if (src.id() !== selectedNode.id()) neighbors.push(src)
            if (tgt.id() !== selectedNode.id()) neighbors.push(tgt)
          })
          if (neighbors.length === 0) return
          // Pick based on direction
          const pos = selectedNode.position()
          let best = neighbors[0]
          let bestScore = -Infinity
          for (const n of neighbors) {
            const np = n.position()
            const dx = np.x - pos.x
            const dy = np.y - pos.y
            let score = 0
            switch (e.key) {
              case 'ArrowRight': score = dx - Math.abs(dy); break
              case 'ArrowLeft': score = -dx - Math.abs(dy); break
              case 'ArrowDown': score = dy - Math.abs(dx); break
              case 'ArrowUp': score = -dy - Math.abs(dx); break
            }
            if (score > bestScore) { bestScore = score; best = n }
          }
          // Simulate tap
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

  return (
    <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.06 }} className="space-y-4 p-5">
      <motion.header variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Graph Explorer</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Inspect node topology, trace dependencies, and isolate coupling hotspots.</p>
          </div>
          {demoMode && (
            <span className="rounded-full border border-[var(--accent-insight)]/30 bg-[var(--accent-insight)]/10 px-3 py-1 text-xs text-[var(--accent-insight)]">
              Demo Mode — procedurally generated
            </span>
          )}
        </div>
      </motion.header>

      <motion.section variants={card} className="flex gap-4">
        {/* ---- LEFT SIDEBAR ---- */}
        <aside className={`${sidebarOpen ? 'w-[280px]' : 'w-[56px]'} shrink-0 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-3 transition-all`}>
          <button type="button" onClick={() => setSidebarOpen((v) => !v)} className="mb-3 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">
            {sidebarOpen ? 'Collapse' : '>'}
          </button>
          {sidebarOpen && (
            <div className="flex flex-col gap-3 overflow-hidden" style={{ height: 'calc(100vh - 260px)' }}>
              {/* Search */}
              <div className="relative shrink-0">
                <MagnifyingGlass size={14} className="absolute left-3 top-2.5 text-[var(--text-tertiary)]" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedFilePath(undefined) }}
                  placeholder="Search nodes..."
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--accent-graph)]"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-3 top-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">&times;</button>
                )}
              </div>

              {/* Legend + Filters */}
              <div className="shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2.5 text-xs">
                <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Legend</div>
                {(['function', 'class', 'module'] as const).map((k) => (
                  <label key={k} className="flex items-center justify-between gap-2 py-1">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters[k]}
                        onChange={() => setFilters((prev) => ({ ...prev, [k]: !prev[k] }))}
                        className="accent-[var(--accent-graph)] h-3.5 w-3.5"
                      />
                      <span className="h-3 w-3 rounded-full" style={{ background: TYPE_COLORS[k], boxShadow: `0 0 6px ${TYPE_COLORS[k]}60` }} />
                      <span className="capitalize text-[var(--text-secondary)]">{k}</span>
                    </span>
                    <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]" style={numberStyle}>{typeCounts[k]}</span>
                  </label>
                ))}
              </div>

              {/* File Tree */}
              <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Files</span>
                  {selectedFilePath && (
                    <button onClick={clearHighlight} className="text-[10px] text-[var(--accent-graph)] hover:underline">Clear</button>
                  )}
                </div>
                <FileTree nodes={apiNodes} selectedFilePath={selectedFilePath} onSelectFile={handleSelectFile} />
              </div>

              {/* Selected node detail */}
              {selected && (
                <div className="shrink-0 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3" style={{ maxHeight: '50vh' }}>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: nodeColor(selected.type), boxShadow: `0 0 8px ${nodeColor(selected.type)}80` }} />
                    <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{selected.name}</div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">{selected.type}</span>
                    {selected.connections != null && (
                      <span className="text-[10px] text-[var(--text-tertiary)]" style={numberStyle}>{selected.connections} connections</span>
                    )}
                  </div>
                  <div className="mt-2 truncate text-xs text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>{selected.path ?? 'Path unavailable'}</div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]" style={numberStyle}>Line: {selected.line_number ?? '—'}</div>
                  <button type="button" className="mt-3 w-full rounded-lg border border-[var(--border-default)] bg-transparent px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">View in context</button>

                  {/* Callers section */}
                  {selected.callers && selected.callers.length > 0 && (
                    <div className="mt-3 border-t border-[var(--border-subtle)] pt-2">
                      <button
                        type="button"
                        onClick={() => setCallersOpen(v => !v)}
                        className="flex w-full items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      >
                        <CaretRight size={10} className={`transition-transform ${callersOpen ? 'rotate-90' : ''}`} />
                        Callers ({selected.callers.length})
                      </button>
                      {callersOpen && (
                        <div className="mt-1.5 flex flex-col gap-1">
                          {selected.callers.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] hover:bg-[var(--bg-hover)]">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: nodeColor('function') }} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{c.function_name}</div>
                                <div className="truncate text-[9px] text-[var(--text-tertiary)]">{c.path}{c.line_number ? `:${c.line_number}` : ''}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Callees section */}
                  {selected.callees && selected.callees.length > 0 && (
                    <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
                      <button
                        type="button"
                        onClick={() => setCalleesOpen(v => !v)}
                        className="flex w-full items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      >
                        <CaretRight size={10} className={`transition-transform ${calleesOpen ? 'rotate-90' : ''}`} />
                        Callees ({selected.callees.length})
                      </button>
                      {calleesOpen && (
                        <div className="mt-1.5 flex flex-col gap-1">
                          {selected.callees.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] hover:bg-[var(--bg-hover)]">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: nodeColor('function') }} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{c.function_name}</div>
                                <div className="truncate text-[9px] text-[var(--text-tertiary)]">{c.path}{c.line_number ? `:${c.line_number}` : ''}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ---- MAIN CANVAS ---- */}
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-[var(--border-default)]" style={{ height: 'calc(100vh - 180px)', background: 'linear-gradient(160deg, #161b22 0%, #0d1117 60%, #0b1118 100%)' }}>
          {loading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--accent-graph)] border-t-transparent" />
                <span className="font-mono text-xs text-[var(--text-tertiary)]">Loading graph…</span>
              </div>
            </div>
          ) : (
            <div className="relative h-full w-full">
              {/* Hull overlay canvas — behind graph interactions */}
              <canvas
                ref={hullCanvasRef}
                className="pointer-events-none absolute inset-0 z-[1]"
                style={{ width: '100%', height: '100%' }}
              />
              <div ref={containerRef} className="absolute inset-0 z-[2]" />
            </div>
          )}

          {/* Tooltip */}
          <div
            ref={tooltipRef}
            className="pointer-events-none fixed z-50 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] shadow-lg"
            style={{ opacity: 0, transition: 'opacity 150ms', fontFamily: 'var(--font-display)' }}
          />

          {/* Bottom Toolbar */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[rgba(19,19,31,0.85)] px-3 py-2 backdrop-blur-xl">
            <button onClick={handleZoomOut} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-1 hover:bg-[var(--bg-hover)]" title="Zoom out"><Minus size={14} /></button>
            <button onClick={handleZoomIn} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-1 hover:bg-[var(--bg-hover)]" title="Zoom in"><Plus size={14} /></button>
            <button onClick={handleFit} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">Fit</button>
            <button
              onClick={() => setRotating(v => !v)}
              className={`rounded-md border border-[var(--border-subtle)] p-1 transition ${rotating ? 'bg-[var(--accent-graph)] text-white' : 'bg-[var(--bg-base)] hover:bg-[var(--bg-hover)]'}`}
              title={rotating ? 'Pause rotation' : 'Resume rotation'}
            >
              <ArrowsClockwise size={14} className={rotating ? 'animate-spin' : ''} style={rotating ? { animationDuration: '3s' } : {}} />
            </button>
            <div className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
            {layoutRunning && (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border border-[var(--accent-graph)] border-t-transparent" />
            )}
            <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1 text-xs" style={numberStyle}>{visibleNodeCount} nodes</span>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]"
              onClick={() => setLayout((v) => (v === 'Force' ? 'Tree' : v === 'Tree' ? 'Radial' : v === 'Radial' ? 'Cluster' : 'Force'))}
            >
              {layout} <CaretDown size={12} />
            </button>
            <div className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]"
              title="Export as PNG"
            >
              <Download size={12} /> Export
            </button>
          </div>

          {/* Mini-map */}
          <div className="absolute right-3 top-3 z-[10] overflow-hidden rounded-lg border border-[var(--border-default)] shadow-lg" style={{ width: 160, height: 120 }}>
            <canvas
              ref={minimapRef}
              width={160}
              height={120}
              className="block cursor-pointer"
              style={{ width: 160, height: 120 }}
              onClick={(e) => handleMinimapClick(e, cyRef.current)}
            />
            <span className="pointer-events-none absolute left-1.5 top-1 text-[8px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]" style={{ opacity: 0.6 }}>Map</span>
          </div>

          {/* Drag hint + keyboard shortcuts */}
          <div className="absolute right-3 top-[140px] z-[10] rounded-lg bg-[rgba(19,19,31,0.7)] px-2 py-1 text-[10px] text-[var(--text-tertiary)] backdrop-blur">
            Drag to pin · Dbl-click unpin · <span className="opacity-60">Esc</span> deselect · <span className="opacity-60">/</span> search · <span className="opacity-60">f</span> fit
          </div>

          {/* Hidden nodes indicator */}
          {hiddenNodes.size > 0 && (
            <button
              onClick={() => {
                const cy = cyRef.current
                if (!cy) return
                hiddenNodes.forEach(id => {
                  const n = cy.getElementById(id)
                  n.style('display', 'element')
                  n.connectedEdges().style('display', 'element')
                })
                setHiddenNodes(new Set())
              }}
              className="absolute left-3 top-3 rounded-lg border border-[var(--border-default)] bg-[rgba(19,19,31,0.85)] px-2 py-1 text-[10px] text-[var(--text-tertiary)] backdrop-blur hover:text-[var(--text-primary)]"
            >
              {hiddenNodes.size} hidden — click to restore
            </button>
          )}
        </div>
      </motion.section>

      {/* ---- Right-click context menu ---- */}
      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[180px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] py-1.5 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y, fontFamily: 'var(--font-display)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {contextMenu.nodeName}
          </div>
          {([
            { key: 'show-callers', label: 'Show Callers', icon: <CaretRight size={12} className="rotate-180" /> },
            { key: 'show-callees', label: 'Show Callees', icon: <CaretRight size={12} /> },
            { key: 'expand-neighborhood', label: 'Expand Neighborhood', icon: <ArrowsOutSimple size={12} /> },
            { key: 'pin-unpin', label: 'Pin / Unpin', icon: <PushPin size={12} /> },
            { key: 'copy-path', label: 'Copy Path', icon: <Copy size={12} /> },
            { key: 'hide-node', label: 'Hide Node', icon: <EyeSlash size={12} /> },
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => handleContextAction(item.key)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            >
              <span className="text-[var(--text-tertiary)]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}
