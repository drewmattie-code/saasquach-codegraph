import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Skeleton } from '../components/ui/Skeleton'

const tabs = ['Dead Code', 'Complexity', 'Call Chain', 'Dependencies', 'Inheritance'] as const

export function AnalysisPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Dead Code')
  const [fromFn, setFromFn] = useState('')
  const [toFn, setToFn] = useState('')
  const dead = useQuery({ queryKey: ['dead'], queryFn: api.deadCode })
  const complex = useQuery({ queryKey: ['complex'], queryFn: api.complexity })
  const chain = useQuery({ queryKey: ['chain', fromFn, toFn], queryFn: () => api.chain(fromFn, toFn), enabled: !!fromFn && !!toFn })

  const avg = useMemo(() => {
    if (!complex.data?.length) return 0
    return complex.data.reduce((a, b) => a + b.complexity, 0) / complex.data.length
  }, [complex.data])

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold">Analysis</h2>
      <div className="card flex flex-wrap gap-2 p-2">{tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-2 text-sm ${tab === t ? 'bg-cyan-500/20 text-cyan-200' : 'text-[#9a9abc]'}`}>{t}</button>)}</div>

      {tab === 'Dead Code' && (
        <Card>
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">{dead.data?.potentially_unused_functions.length ?? 0} functions potentially unused across 8 files</p>
          {dead.isLoading ? <Skeleton className="h-28 w-full" /> : (
            <table className="w-full text-left text-sm">
              <thead><tr className="text-[#8888aa]"><th>Function</th><th>File</th><th>Actions</th></tr></thead>
              <tbody>{dead.data?.potentially_unused_functions.slice(0, 30).map((f, i) => <tr key={`${f.name}-${i}`} className="border-t border-[#2a2a3a]"><td>{f.name}</td><td className="mono text-xs">{f.path}</td><td><Button variant="ghost">Highlight in Graph</Button></td></tr>)}</tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'Complexity' && (
        <Card>
          {complex.isLoading ? <Skeleton className="h-56 w-full" /> : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={complex.data?.slice(0, 20)}>
                    <XAxis dataKey="function_name" hide /><YAxis />
                    <Tooltip />
                    <Bar dataKey="complexity" fill="#00B4D8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mb-2 text-sm text-[#8888aa]">Average complexity: {avg.toFixed(1)} across {(complex.data?.length ?? 0).toLocaleString()} functions</p>
              <table className="w-full text-sm"><thead><tr className="text-[#8888aa]"><th>Function</th><th>Score</th><th>File</th><th /></tr></thead><tbody>
                {complex.data?.slice(0, 20).map((c) => <tr key={c.function_name} className="border-t border-[#2a2a3a]"><td>{c.function_name}</td><td><span className={`rounded-full px-2 py-1 text-xs ${c.complexity < 5 ? 'bg-emerald-500/20 text-emerald-200' : c.complexity <= 10 ? 'bg-amber-500/20 text-amber-200' : 'bg-red-500/20 text-red-200'}`}>{c.complexity}</span></td><td className="mono text-xs">{c.path}</td><td><Button variant="ghost">View in Graph</Button></td></tr>)}
              </tbody></table>
            </>
          )}
        </Card>
      )}

      {tab === 'Call Chain' && (
        <Card>
          <div className="mb-3 flex gap-2"><input value={fromFn} onChange={(e) => setFromFn(e.target.value)} placeholder="From function..." className="w-full rounded border border-[#2a2a3a] bg-[#11111a] p-2" /><input value={toFn} onChange={(e) => setToFn(e.target.value)} placeholder="To function..." className="w-full rounded border border-[#2a2a3a] bg-[#11111a] p-2" /><Button>Find Chain</Button></div>
          <div className="rounded-lg bg-[#0d0d15] p-3 text-sm">
            {(chain.data || []).map((s, i) => <span key={`${s.function_name}-${i}`} className="mr-2">{s.function_name} {i < (chain.data?.length ?? 0) - 1 ? '→ calls →' : ''}</span>)}
          </div>
          <div className="mt-3 h-40 rounded border border-[#2a2a3a] p-3 text-[#8888aa]">Mini call chain graph visualization</div>
        </Card>
      )}

      {tab === 'Dependencies' && <Card><p className="mb-2">Dependencies explorer</p><div className="grid grid-cols-2 gap-3"><div className="rounded border border-[#2a2a3a] p-3">Imports FROM</div><div className="rounded border border-[#2a2a3a] p-3">Imported BY</div></div></Card>}
      {tab === 'Inheritance' && <Card><p>Inheritance tree explorer (parent → child → grandchild)</p></Card>}
    </div>
  )
}
