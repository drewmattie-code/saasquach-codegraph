import { useStats } from '../hooks/useData'
import { Card } from '../components/ui/Card'

export function DashboardPage() {
  const { data, isLoading } = useStats()
  if (isLoading) return <div className="animate-pulse">Loading dashboard...</div>
  const stats = [['Total Files', data?.files ?? 0], ['Total Functions', data?.functions ?? 0], ['Total Classes', data?.classes ?? 0], ['Repositories', data?.repositories ?? 0]]
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Dashboard</h2><div className="grid grid-cols-4 gap-4">{stats.map(([l, v]) => <Card key={String(l)}><p className="text-[#8888aa]">{l}</p><p className="text-3xl font-semibold">{v}</p></Card>)}</div></div>
}
