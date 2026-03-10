import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import { useGraph } from '../hooks/useData'

export function GraphExplorerPage() {
  const { data, isLoading } = useGraph()
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!data || !ref.current) return
    const cy = cytoscape({ container: ref.current, elements: [...data.nodes.map((n) => ({ data: { id: String(n.id), label: n.name } })), ...data.edges.map((e) => ({ data: { id: String(e.id), source: String(e.source), target: String(e.target) } }))], layout: { name: 'cose' }, style: [{ selector: 'node', style: { label: 'data(label)', 'font-size': '8px', color: '#f0f0f5', 'background-color': '#00B4D8' } }, { selector: 'edge', style: { width: 1, 'line-color': '#2a2a3a' } }] })
    return () => cy.destroy()
  }, [data])
  if (isLoading) return <div className="animate-pulse">Loading graph...</div>
  return <div><h2 className="mb-3 text-2xl font-semibold">Graph Explorer</h2><div ref={ref} className="h-[75vh] rounded-xl border border-[#2a2a3a] bg-[#12121a]" /></div>
}
