import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition, type NodeSingular } from 'cytoscape'
import { Download, Search, ZoomIn, ZoomOut } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useGraph } from '../hooks/useData'
import { api } from '../api/client'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'

type NodeFilter = 'all' | 'function' | 'class' | 'file'
type LayoutMode = 'cose' | 'grid' | 'breadthfirst'

export function GraphExplorerPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<NodeFilter>('all')
  const [layout, setLayout] = useState<LayoutMode>('cose')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(500)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: number } | null>(null)
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const { data, isLoading, refetch } = useGraph(limit)

  const detail = useQuery<Record<string, any>>({
    queryKey: ['node-detail', selectedId],
    queryFn: () => api.node(selectedId!),
    enabled: !!selectedId,
  })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)

  const elements = useMemo(() => {
    if (!data) return []
    const degreeMap = new Map<number, number>()
    data.nodes.forEach((n) => degreeMap.set(n.id, 0))
    data.edges.forEach((e) => {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1)
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1)
    })
    return [
      ...data.nodes.map(
        (n): ElementDefinition => ({
          data: {
            id: String(n.id),
            label: n.name,
            type: String(n.type || '').toLowerCase(),
            path: n.path || '',
            line: n.line || '',
            size: Math.min(20 + (degreeMap.get(n.id) ?? 0) * 0.5, 60),
          },
        }),
      ),
      ...data.edges.map(
        (e): ElementDefinition => ({
          data: { id: String(e.id), source: String(e.source), target: String(e.target), kind: String(e.kind || '').toUpperCase() },
        }),
      ),
    ]
  }, [data])

  useEffect(() => {
    if (!containerRef.current || !elements.length) return
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      textureOnViewport: true,
      hideEdgesOnViewport: false,
      wheelSensitivity: 0.2,
      layout: { name: layout, animate: true, fit: true, padding: 25 },
      style: ([
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#f0f0f5',
            'font-size': 9,
            width: 'mapData(size, 20, 60, 20, 60)',
            height: 'mapData(size, 20, 60, 20, 60)',
            'background-color': '#3a3a52',
            shape: 'round-rectangle',
            'text-max-width': 70,
            'text-wrap': 'wrap',
          },
        },
        { selector: 'node[type *= "function"]', style: { 'background-color': '#00B4D8', shape: 'ellipse' } },
        { selector: 'node[type *= "class"]', style: { 'background-color': '#7B5EA7', shape: 'diamond' } },
        { selector: 'node[type *= "file"], node[type *= "module"]', style: { 'background-color': '#3a3a52', shape: 'round-rectangle' } },
        {
          selector: 'node:selected, node.focused',
          style: {
            'border-width': 3,
            'border-color': '#ffffff',
            'shadow-blur': 14,
            'shadow-color': '#ffffff',
            'shadow-opacity': 0.8,
          },
        },
        { selector: 'edge', style: { width: 1.4, 'curve-style': 'bezier', 'line-color': '#555570', 'target-arrow-shape': 'none', opacity: 0.9 } },
        { selector: 'edge[kind = "CALLS"]', style: { 'line-color': '#00B4D8', 'target-arrow-color': '#00B4D8', 'target-arrow-shape': 'triangle' } },
        { selector: 'edge[kind = "INHERITS"]', style: { 'line-color': '#7B5EA7', 'line-style': 'dashed' } },
        { selector: 'edge[kind = "IMPORTS"]', style: { 'line-color': '#555570' } },
        { selector: 'edge.hovered', style: { 'line-color': '#ffffff', 'target-arrow-color': '#ffffff', width: 2.2 } },
        { selector: '.muted', style: { opacity: 0.08 } },
      ] as any),
    })

    cy.on('tap', 'node', (evt) => {
      const id = Number(evt.target.id())
      if (evt.originalEvent.shiftKey) {
        setMultiSelected((prev) => new Set([...prev, String(id)]))
      } else {
        setSelectedId(id)
      }
      setCtxMenu(null)
    })

    cy.on('dbltap', 'node', (evt) => {
      const node = evt.target
      const neighborhood = node.closedNeighborhood()
      cy.elements().addClass('muted')
      neighborhood.removeClass('muted')
      cy.animate({ fit: { eles: neighborhood, padding: 40 }, duration: 300 })
    })

    cy.on('cxttap', 'node', (evt) => {
      setCtxMenu({ x: evt.originalEvent.clientX, y: evt.originalEvent.clientY, nodeId: Number(evt.target.id()) })
    })

    cy.on('mouseover', 'node', (evt) => {
      const n = evt.target
      setHoverTip({ x: evt.originalEvent.clientX + 8, y: evt.originalEvent.clientY + 8, text: `${n.data('label')} • ${n.data('type')} • ${n.data('path')}` })
    })
    cy.on('mouseout', 'node', () => setHoverTip(null))
    cy.on('mouseover', 'edge', (evt) => evt.target.addClass('hovered'))
    cy.on('mouseout', 'edge', (evt) => evt.target.removeClass('hovered'))

    cyRef.current = cy
    return () => cy.destroy()
  }, [elements, layout])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const query = search.trim().toLowerCase()
    cy.nodes().forEach((n) => {
      const matchesSearch = !query || String(n.data('label')).toLowerCase().includes(query)
      const matchesFilter = filter === 'all' || String(n.data('type')).includes(filter)
      n.style('display', matchesSearch && matchesFilter ? 'element' : 'none')
    })
  }, [search, filter])

  useEffect(() => {
    if (!multiSelected.size || !cyRef.current) return
    cyRef.current.elements().removeClass('focused')
    multiSelected.forEach((id) => cyRef.current?.getElementById(id).addClass('focused'))
  }, [multiSelected])

  const runCtxAction = (action: string) => {
    if (!ctxMenu || !cyRef.current) return
    const node = cyRef.current.getElementById(String(ctxMenu.nodeId)) as NodeSingular
    if (action === 'Find callers') {
      const incoming = node.incomers('node')
      cyRef.current.elements().addClass('muted')
      node.removeClass('muted')
      incoming.removeClass('muted')
    } else if (action === 'Find callees') {
      const outgoing = node.outgoers('node')
      cyRef.current.elements().addClass('muted')
      node.removeClass('muted')
      outgoing.removeClass('muted')
    } else {
      setSelectedId(Number(node.id()))
    }
    setCtxMenu(null)
  }

  const exportPng = () => {
    const cy = cyRef.current
    if (!cy) return
    const png = cy.png({ bg: '#0a0a0f', full: true, scale: 2 })
    const a = document.createElement('a')
    a.href = png
    a.download = 'codegraph.png'
    a.click()
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[72vh] w-full" />
      </div>
    )
  }

  if (!data?.nodes?.length) {
    return <EmptyState title="No graph loaded yet" hint="Index a repository to light up the code graph and start exploring node relationships." cta="Go to Repositories" />
  }

  return (
    <div className="space-y-3" onClick={() => setCtxMenu(null)}>
      <h2 className="text-2xl font-semibold">Graph Explorer</h2>
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="flex min-w-72 flex-1 items-center gap-2 rounded-lg border border-[#2a2a3a] bg-[#0f0f17] px-2">
          <Search size={16} className="text-[#8888aa]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search node name..." className="w-full bg-transparent p-2 outline-none" />
        </div>
        <select className="rounded-lg border border-[#2a2a3a] bg-[#12121a] p-2" value={filter} onChange={(e) => setFilter(e.target.value as NodeFilter)}>
          <option value="all">All</option>
          <option value="function">Functions</option>
          <option value="class">Classes</option>
          <option value="file">Modules</option>
        </select>
        <select className="rounded-lg border border-[#2a2a3a] bg-[#12121a] p-2" value={layout} onChange={(e) => setLayout(e.target.value as LayoutMode)}>
          <option value="cose">Force</option>
          <option value="grid">Grid</option>
          <option value="breadthfirst">Hierarchical</option>
        </select>
        <Button variant="ghost" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() + 0.1)}><ZoomIn size={16} /></Button>
        <Button variant="ghost" onClick={() => cyRef.current?.zoom(Math.max(0.1, cyRef.current.zoom() - 0.1))}><ZoomOut size={16} /></Button>
        <Button variant="ghost" onClick={() => cyRef.current?.fit()}>Fit</Button>
        <Button onClick={exportPng}><Download size={16} className="mr-1 inline" />Export PNG</Button>
      </div>
      {data.truncated && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <span>Graph is truncated to {limit} nodes for performance.</span>
          <Button variant="ghost" onClick={() => { setLimit(2000); refetch() }}>Show all ({data.total ?? 'N'} total)</Button>
        </div>
      )}
      <div className="grid grid-cols-4 gap-3">
        <div className="card col-span-3 h-[74vh] overflow-hidden">
          <div ref={containerRef} className="h-full w-full" />
        </div>
        <div className={`card h-[74vh] overflow-auto p-4 transition ${selectedId ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-70'}`}>
          {!selectedId ? (
            <p className="text-sm text-[#8888aa]">Click a node to inspect details, callers, callees, and source preview.</p>
          ) : detail.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="space-y-3">
              <p className="mono text-lg">{String(detail.data?.name || 'Unknown')}</p>
              <span className="rounded-full border border-cyan-500/40 px-2 py-1 text-xs text-cyan-200">{String(detail.data?.type || 'node')}</span>
              <div className="text-sm text-[#b7b7cf]">
                <p className="mono truncate">{String(detail.data?.path || '-')}</p>
                <p>Line: {String(detail.data?.line || '-')}</p>
                <p>Complexity: {String(detail.data?.complexity || '-')}</p>
              </div>
              <div>
                <h4 className="mb-1 text-xs uppercase tracking-wide text-[#8888aa]">Callers</h4>
                <div className="space-y-1">{(detail.data?.callers || []).map((c: string) => <button key={c} className="block text-left text-cyan-300 hover:underline">{c}</button>)}</div>
              </div>
              <div>
                <h4 className="mb-1 text-xs uppercase tracking-wide text-[#8888aa]">Callees</h4>
                <div className="space-y-1">{(detail.data?.callees || []).map((c: string) => <button key={c} className="block text-left text-cyan-300 hover:underline">{c}</button>)}</div>
              </div>
              <div className="rounded-lg bg-[#0a0a0f] p-2">
                <p className="mb-1 text-xs text-[#8888aa]">Source preview</p>
                <pre className="mono overflow-auto text-xs text-[#d3d3e6]">{String(detail.data?.source || '').split('\n').slice(0, 10).join('\n')}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
      {ctxMenu && (
        <div className="fixed z-50 min-w-40 rounded-lg border border-[#2a2a3a] bg-[#131320] p-1" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          {['Find callers', 'Find callees', 'Show call chain', 'Analyze complexity'].map((item) => (
            <button key={item} className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-[#1e1e2e]" onClick={() => runCtxAction(item)}>{item}</button>
          ))}
        </div>
      )}
      {hoverTip && <div className="fixed z-40 rounded bg-black/80 px-2 py-1 text-xs" style={{ top: hoverTip.y, left: hoverTip.x }}>{hoverTip.text}</div>}
    </div>
  )
}
