import { Link } from 'react-router-dom'
import cytoscape from 'cytoscape'
import { useEffect, useRef } from 'react'
import { Folder, FunctionSquare, Boxes, GitBranch } from 'lucide-react'
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { useGraph, useRepos, useStats } from '../hooks/useData'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'

const statMeta = [
  { key: 'files', label: 'Files', icon: Folder },
  { key: 'functions', label: 'Functions', icon: FunctionSquare },
  { key: 'classes', label: 'Classes', icon: Boxes },
  { key: 'repositories', label: 'Repos', icon: GitBranch },
] as const

export function DashboardPage() {
  const { data, isLoading } = useStats()
  const repos = useRepos()
  const graph = useGraph(50)
  const miniRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!miniRef.current || !graph.data?.nodes?.length) return
    const cy = cytoscape({
      container: miniRef.current,
      userPanningEnabled: false,
      userZoomingEnabled: false,
      styleEnabled: true,
      elements: [
        ...graph.data.nodes.map((n) => ({ data: { id: String(n.id), label: n.name } })),
        ...graph.data.edges.map((e) => ({ data: { id: String(e.id), source: String(e.source), target: String(e.target) } })),
      ],
      layout: { name: 'cose', animate: false },
      style: [{ selector: 'node', style: { 'background-color': '#00B4D8', width: 8, height: 8 } }, { selector: 'edge', style: { width: 1, 'line-color': '#3a3a52' } }],
    })
    return () => cy.destroy()
  }, [graph.data])

  if (isLoading) return <Skeleton className="h-[40vh] w-full" />

  const deadCodePct = data?.dead_code_pct ?? 12
  const avgComplexityOver10 = Math.max((data?.avg_complexity ?? 4.2) - 10, 0) * 10
  const depthPenalty = data?.depth_penalty ?? 8
  const score = Math.max(0, Math.round(100 - deadCodePct * 0.4 - avgComplexityOver10 * 0.3 - depthPenalty * 0.3))
  const scoreColor = score >= 80 ? '#00d4a0' : score >= 60 ? '#f0a500' : '#ff4466'

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <div className="grid grid-cols-4 gap-3">
        {statMeta.map((m) => {
          const Icon = m.icon
          const value = data?.[m.key] ?? 0
          return (
            <Card key={m.key}>
              <div className="mb-2 flex items-center justify-between text-[#8888aa]"><span>{m.label}</span><Icon size={16} /></div>
              <p className="text-4xl font-semibold">{value.toLocaleString()}</p>
            </Card>
          )
        })}
      </div>
      <div className="grid grid-cols-5 gap-3">
        <Card>
          <div className="grid h-full grid-cols-5 gap-2">
            <div className="col-span-3">
              <h3 className="mb-2 text-sm text-[#8888aa]">Codebase Health Score</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart data={[{ value: score }]} innerRadius="70%" outerRadius="100%" startAngle={210} endAngle={-30}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={16} fill={scoreColor} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <p className="-mt-28 text-center text-3xl font-bold">{score}</p>
              </div>
              <ul className="space-y-1 text-sm text-[#b8b8ce]">
                <li><span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-400" />Dead code: {deadCodePct}%</li>
                <li><span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" />Complexity pressure: {avgComplexityOver10.toFixed(1)}</li>
                <li><span className="mr-2 inline-block h-2 w-2 rounded-full bg-cyan-400" />Depth penalty: {depthPenalty}</li>
              </ul>
            </div>
            <div className="col-span-2 rounded-lg border border-[#2a2a3a] bg-[#0d0d15] p-3">
              <h3 className="mb-2 text-sm text-[#8888aa]">Recent Activity</h3>
              <div className="space-y-2">
                {repos.data?.slice(0, 5).map((repo) => (
                  <div key={repo.path} className="rounded border border-[#2a2a3a] p-2 text-xs">
                    <p className="truncate text-[#e6e6f4]">{repo.name}</p>
                    <p className="text-[#8888aa]">2 hours ago</p>
                    <button className="mt-1 text-cyan-300">Re-index</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
      <Card>
        <h3 className="mb-2 text-sm text-[#8888aa]">Graph Snapshot</h3>
        <div ref={miniRef} className="h-44 pointer-events-none rounded border border-[#2a2a3a]" />
        <Link to="/graph" className="mt-2 inline-block text-cyan-300">Open in Graph Explorer →</Link>
      </Card>
    </div>
  )
}
