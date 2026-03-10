import { useRepos } from '../hooks/useData'
import { Card } from '../components/ui/Card'

export function RepositoriesPage() {
  const { data, isLoading } = useRepos()
  if (isLoading) return <div className="animate-pulse">Loading repositories...</div>
  if (!data?.length) return <Card><h3 className="mb-2">No repositories yet</h3><p className="text-[#8888aa]">Add a repository to begin indexing and graph analysis.</p></Card>
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Repositories</h2><div className="grid grid-cols-3 gap-4">{data.map((r) => <Card key={r.path}><h3>{r.name}</h3><p className="mono text-xs text-[#8888aa]">{r.path}</p></Card>)}</div></div>
}
