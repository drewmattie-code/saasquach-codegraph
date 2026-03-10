import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderOpen } from 'lucide-react'
import { api } from '../api/client'
import { useRepos } from '../hooks/useData'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { useUIStore } from '../store/uiStore'

export function RepositoriesPage() {
  const [open, setOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [path, setPath] = useState('')
  const [watchMap, setWatchMap] = useState<Record<string, boolean>>({})
  const [progress, setProgress] = useState<Record<string, number>>({})
  const { data, isLoading } = useRepos()
  const { pushToast } = useUIStore()
  const qc = useQueryClient()

  const addRepo = useMutation({
    mutationFn: () => api.indexRepo(path),
    onSuccess: () => {
      pushToast('Repository indexing started')
      setOpen(false)
      setPath('')
      qc.invalidateQueries({ queryKey: ['repos'] })
    },
    onError: () => pushToast('Failed to start indexing', 'error'),
  })

  const removeRepo = useMutation({
    mutationFn: (name: string) => api.removeRepo(name),
    onSuccess: () => {
      pushToast('Index removed', 'warning')
      setRemoveTarget(null)
      qc.invalidateQueries({ queryKey: ['repos'] })
    },
  })

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:7477/ws/indexing')
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      const map: Record<string, number> = {}
      for (const job of msg.jobs || []) {
        const repoName = String(job.metadata?.name || job.metadata?.path || job.id)
        map[repoName] = Number(job.progress || 0)
      }
      setProgress(map)
    }
    return () => ws.close()
  }, [])

  if (isLoading) return <Skeleton className="h-[40vh] w-full" />
  if (!data?.length) return <EmptyState title="No repositories indexed yet" hint="Connect your first repository to start building a relationship graph, analysis signals, and AI retrieval context." cta="Add Repository" onCta={() => setOpen(true)} />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Repositories</h2>
        <Button onClick={() => setOpen(true)}>Add Repository</Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {data.map((repo) => {
          const p = progress[repo.name] ?? 0
          const watching = watchMap[repo.name] ?? false
          return (
            <Card key={repo.path}>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><FolderOpen size={18} className="text-cyan-300" /><h3 className="text-lg font-semibold">{repo.name}</h3></div>
                <p className="mono truncate text-xs text-[#8888aa]">{repo.path}</p>
                <p className="text-sm text-[#b6b6cf]">{repo.stats?.files ?? 0} files · {repo.stats?.functions ?? 0} functions · {repo.stats?.classes ?? 0} classes</p>
                <p className="text-xs text-[#8888aa]">Last indexed: 2 hours ago</p>
                <div className="flex gap-2">
                  <Button variant="ghost">Re-index</Button>
                  <Button variant="ghost" onClick={() => setWatchMap((s) => ({ ...s, [repo.name]: !watching }))}>{watching ? 'Watch ●' : 'Watch ○'}</Button>
                  <Button variant="ghost" onClick={() => setRemoveTarget(repo.name)}>Remove</Button>
                </div>
                {p > 0 && p < 100 && (
                  <div>
                    <div className="h-1 w-full overflow-hidden rounded bg-[#2a2a3a]"><div className="h-full bg-[#00B4D8]" style={{ width: `${p}%` }} /></div>
                    <p className="mt-1 text-xs text-cyan-200">Indexing... {p}%</p>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Modal open={open} title="Add Repository" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/absolute/path/to/repo" className="w-full rounded border border-[#2a2a3a] bg-[#11111a] p-2" />
          <div className="flex items-center justify-between text-sm"><span>Watch for changes</span><input type="checkbox" defaultChecked /></div>
          <input defaultValue="node_modules,.git,.next,dist,build" className="w-full rounded border border-[#2a2a3a] bg-[#11111a] p-2 text-sm" />
          <Button className="w-full" onClick={() => addRepo.mutate()} disabled={!path || addRepo.isPending}>{addRepo.isPending ? 'Indexing...' : 'Index Now'}</Button>
        </div>
      </Modal>

      <Modal open={!!removeTarget} title="Remove Repository Index" onClose={() => setRemoveTarget(null)}>
        <p className="mb-4 text-sm text-[#a8a8c0]">Are you sure? This removes the index only, not your files.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button onClick={() => removeTarget && removeRepo.mutate(removeTarget)}>Remove</Button>
        </div>
      </Modal>
    </div>
  )
}
