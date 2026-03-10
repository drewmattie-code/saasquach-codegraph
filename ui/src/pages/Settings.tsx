import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useUIStore } from '../store/uiStore'

export function SettingsPage() {
  const [backend, setBackend] = useState('falkordb')
  const [ignoreDirs, setIgnoreDirs] = useState(['node_modules', '.git', 'dist'])
  const [newTag, setNewTag] = useState('')
  const { pushToast } = useUIStore()

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Settings</h2>

      <Card>
        <h3 className="mb-3 text-lg">Database</h3>
        <p className="mb-2 text-sm text-[#8888aa]">Current backend: <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">FalkorDB Lite ●</span></p>
        <div className="space-y-2 text-sm">
          <label className="block"><input type="radio" checked={backend === 'falkordb'} onChange={() => setBackend('falkordb')} /> FalkorDB Lite</label>
          <label className="block"><input type="radio" checked={backend === 'kuzu'} onChange={() => setBackend('kuzu')} /> KuzuDB</label>
          <label className="block"><input type="radio" checked={backend === 'neo4j'} onChange={() => setBackend('neo4j')} /> Neo4j</label>
        </div>
        {backend === 'neo4j' && <div className="mt-3 grid grid-cols-3 gap-2"><input placeholder="bolt://localhost:7687" className="rounded border border-[#2a2a3a] bg-[#11111a] p-2" /><input placeholder="username" className="rounded border border-[#2a2a3a] bg-[#11111a] p-2" /><input placeholder="password" type="password" className="rounded border border-[#2a2a3a] bg-[#11111a] p-2" /></div>}
        <Button className="mt-3">Test Connection</Button>
      </Card>

      <Card>
        <h3 className="mb-3 text-lg">Indexing Defaults</h3>
        <div className="mb-2 flex flex-wrap gap-2">{ignoreDirs.map((tag) => <span key={tag} className="rounded-full border border-[#2a2a3a] px-2 py-1 text-xs">{tag}</span>)}</div>
        <div className="mb-2 flex gap-2"><input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add ignore pattern" className="rounded border border-[#2a2a3a] bg-[#11111a] p-2" /><Button variant="ghost" onClick={() => { if (!newTag) return; setIgnoreDirs((s) => [...s, newTag]); setNewTag('') }}>Add</Button></div>
        <label className="block text-sm">Max file size: <input type="range" min={1} max={50} defaultValue={10} className="w-full" /></label>
        <label className="block text-sm">Max depth: <input type="number" min={1} defaultValue={6} className="ml-2 w-20 rounded border border-[#2a2a3a] bg-[#11111a] p-1" /></label>
        <label className="my-2 block text-sm"><input type="checkbox" defaultChecked /> Index source code</label>
        <label className="block text-sm">Parallel workers: <input type="range" min={1} max={8} defaultValue={4} className="w-full" /></label>
        <Button className="mt-3" onClick={() => pushToast('Indexing defaults saved')}>Save Defaults</Button>
      </Card>

      <Card>
        <h3 className="mb-3 text-lg">Appearance</h3>
        <div className="space-y-2 text-sm"><label className="block"><input type="radio" name="layout" defaultChecked /> Force</label><label className="block"><input type="radio" name="layout" /> Grid</label><label className="block"><input type="radio" name="layout" /> Hierarchical</label></div>
        <div className="mt-3 cursor-not-allowed rounded border border-[#2a2a3a] bg-[#0f0f17] p-2 text-sm text-[#666688]">Theme toggle: coming soon</div>
      </Card>
    </div>
  )
}
