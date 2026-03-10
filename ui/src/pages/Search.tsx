import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Card } from '../components/ui/Card'

export function SearchPage() {
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), enabled: q.length > 1 })
  return <div className="space-y-3"><h2 className="text-2xl font-semibold">Code Search</h2><input value={q} onChange={(e) => setQ(e.target.value)} className="w-full rounded-xl border border-[#2a2a3a] bg-[#12121a] p-3" />{!isLoading && q.length > 1 && !data?.length && <Card><p>No results yet</p></Card>}<div className="space-y-2">{data?.map((r, i) => <Card key={`${r.name}-${i}`}><p>{r.name}</p><p className="mono text-xs text-[#8888aa]">{r.path}</p></Card>)}</div></div>
}
