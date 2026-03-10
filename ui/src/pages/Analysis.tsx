import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Card } from '../components/ui/Card'

export function AnalysisPage() {
  const dead = useQuery({ queryKey: ['dead'], queryFn: api.deadCode })
  const complex = useQuery({ queryKey: ['complex'], queryFn: api.complexity })
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Analysis</h2><div className="grid grid-cols-2 gap-4"><Card><p>Dead Code</p><p>{dead.data?.potentially_unused_functions.length ?? 0}</p></Card><Card><p>Complexity</p><p>{complex.data?.length ?? 0}</p></Card></div></div>
}
