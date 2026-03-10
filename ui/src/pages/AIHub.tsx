import { useMcpStatus } from '../hooks/useData'
import { Card } from '../components/ui/Card'

export function AIHubPage() {
  const { data } = useMcpStatus()
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">AI Hub</h2><Card><p>MCP Server</p><p className="text-[#8888aa]">{data?.running ? `Running on ${data.port}` : 'Stopped'}</p></Card></div>
}
