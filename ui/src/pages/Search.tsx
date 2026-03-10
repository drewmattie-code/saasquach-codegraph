import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileCode2 } from 'lucide-react'
import { api } from '../api/client'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

const types = ['all', 'functions', 'classes', 'modules', 'content'] as const

export function SearchPage() {
  const [q, setQ] = useState('')
  const [type, setType] = useState<(typeof types)[number]>('all')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 300)
    return () => clearTimeout(id)
  }, [q])

  const { data, isLoading } = useQuery({
    queryKey: ['search', debounced, type],
    queryFn: () => api.search(debounced, type),
    enabled: debounced.length > 0,
  })

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!data?.length) return
    if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, data.length - 1))
    if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
    if (e.key === 'Enter') setSelected(active)
    if (e.key === 'Escape') {
      setQ('')
      setSelected(null)
    }
  }

  const selectedResult = useMemo(() => (selected !== null ? data?.[selected] : null), [selected, data])

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold">Code Search</h2>
      <div className="grid grid-cols-[200px,1fr,300px] gap-3">
        <Card>
          <h3 className="mb-2 text-sm text-[#8888aa]">Filters</h3>
          <div className="space-y-2 text-sm">
            <p className="text-[#8888aa]">Type</p>
            {['Functions', 'Classes', 'Modules', 'Files'].map((t) => <label key={t} className="flex gap-2"><input type="checkbox" defaultChecked />{t}</label>)}
            <p className="pt-2 text-[#8888aa]">Repo</p>
            <label className="flex gap-2"><input type="checkbox" defaultChecked />All repos</label>
            <p className="pt-2 text-[#8888aa]">Complexity range</p>
            <input type="range" min={0} max={20} defaultValue={10} className="w-full" />
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as (typeof types)[number])} className="rounded border border-[#2a2a3a] bg-[#12121a] p-3">
              <option value="all">All</option><option value="functions">Functions</option><option value="classes">Classes</option><option value="modules">Modules</option><option value="content">Content</option>
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search across code graph..." className="w-full rounded-xl border border-[#2a2a3a] bg-[#12121a] p-3" />
          </div>

          {!q && <EmptyState title="Search across 2,946 functions, 315 classes, and 421 modules" hint="Try searching for a function name, class, or keyword." cta={'Start with "database"'} onCta={() => setQ('database')} />}
          {isLoading && <Skeleton className="h-48 w-full" />}
          <div className="space-y-2">
            {data?.map((r, i) => (
              <Card key={`${r.name}-${i}`}>
                <button onClick={() => setSelected(i)} className={`w-full text-left ${i === active ? 'text-cyan-200' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><FileCode2 size={14} className="text-cyan-300" /><p className="font-semibold">{r.name}</p></div>
                    <span className="rounded border border-[#2a2a3a] px-2 text-xs">L{r.line_number ?? '-'}</span>
                  </div>
                  <p className="mono truncate text-xs text-[#8888aa]">{r.path}</p>
                  <pre className="mt-2 overflow-auto rounded bg-[#0a0a0f] p-2 text-xs text-[#bfc1db]">{(r.source || '').split('\n').slice(0, 3).join('\n')}</pre>
                </button>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <h3 className="mb-2 text-sm text-[#8888aa]">Detail</h3>
          {!selectedResult ? <p className="text-sm text-[#8888aa]">Select a result to inspect source and metadata.</p> : (
            <div className="space-y-2 text-sm">
              <p className="mono text-base">{selectedResult.name}</p>
              <p className="mono truncate text-xs text-[#8888aa]">{selectedResult.path}</p>
              <p>Line: {selectedResult.line_number ?? '-'}</p>
              <pre className="mono max-h-80 overflow-auto rounded bg-[#0a0a0f] p-2 text-xs">{selectedResult.source}</pre>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
