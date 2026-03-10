import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../api/client'
import { useMcpStatus } from '../hooks/useData'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { useUIStore } from '../store/uiStore'

const providers = [
  ['claude', 'Claude Code', 'Anthropic', '🧠'],
  ['codex', 'OpenAI Codex', 'OpenAI', '🤖'],
  ['perplexity', 'Perplexity', 'Perplexity', '🔎'],
  ['copilot', 'GitHub Copilot', 'GitHub', '🐙'],
  ['cursor', 'Cursor', 'Anysphere', '⌨️'],
  ['ollama', 'Ollama', 'Ollama', '🦙'],
  ['custom', 'Custom', 'Your Team', '⚙️'],
] as const

export function AIHubPage() {
  const { data, refetch } = useMcpStatus()
  const [openProvider, setOpenProvider] = useState<string | null>(null)
  const [logLines, setLogLines] = useState<string[]>([])
  const [testResult, setTestResult] = useState<string>('')
  const logRef = useRef<HTMLDivElement | null>(null)
  const { pushToast } = useUIStore()

  const start = useMutation({
    mutationFn: api.mcpStart,
    onSuccess: () => {
      pushToast('MCP start command sent')
      refetch()
    },
  })
  const stop = useMutation({
    mutationFn: api.mcpStop,
    onSuccess: () => {
      pushToast('MCP stop command sent', 'warning')
      refetch()
    },
  })
  const restart = useMutation({
    mutationFn: api.mcpRestart,
    onSuccess: () => {
      pushToast('MCP restart command sent')
      refetch()
    },
  })

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:7477/ws/mcp-activity')
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      setLogLines((s) => [...s.slice(-199), msg.line || JSON.stringify(msg)])
    }
    return () => ws.close()
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logLines])

  const statusText = data?.running ? `MCP Server · Running on port ${data.port}` : 'MCP Server · Stopped'

  const providerInstruction = useMemo(() => {
    if (openProvider === 'claude') return 'Add to ~/.claude/config.json'
    if (openProvider === 'codex') return 'Add to your .cursor/mcp.json or codex config'
    if (openProvider === 'ollama') return 'Ensure Ollama is running, then add this MCP client config'
    return 'Add this MCP config to your provider integration file'
  }, [openProvider])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">AI Hub</h2>
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg"><span className={`pulse-dot mr-2 inline-block h-3 w-3 rounded-full ${data?.running ? 'bg-emerald-400' : 'bg-gray-500'}`} />{statusText}</p>
            <p className="text-sm text-[#8888aa]">{data?.tools ?? 5} tools active · {data?.clients ?? 2} connected clients</p>
          </div>
          <div className="flex gap-2"><Button onClick={() => start.mutate()}>Start</Button><Button variant="ghost" onClick={() => stop.mutate()}>Stop</Button><Button variant="ghost" onClick={() => restart.mutate()}>Restart</Button></div>
        </div>
        <div className="mt-3 rounded-lg bg-[#0a0a0f] p-3">
          <p className="mb-2 text-sm text-[#8888aa]">Add to your AI tool:</p>
          <pre className="mono overflow-auto text-xs">{`{\n  "mcpServers": {\n    "codegraph": { "command": "npx", "args": ["-y", "@saasquach/mcp-client"] }\n  }\n}`}</pre>
          <div className="mt-2 flex gap-2"><Button variant="ghost">Copy JSON</Button><Button variant="ghost">Download .json</Button></div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {providers.map(([id, name, company, icon]) => (
          <Card key={id}>
            <div className="mb-2 flex items-center justify-between"><p className="text-2xl">{icon}</p><span className="text-xs text-[#8888aa]">○ Not configured</span></div>
            <p className="font-semibold">{name}</p>
            <p className="text-sm text-[#8888aa]">{company}</p>
            <Button className="mt-3" variant="ghost" onClick={() => setOpenProvider(id)}>Configure</Button>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between"><h3>MCP Activity <span className={`pulse-dot ml-2 inline-block h-2 w-2 rounded-full ${data?.running ? 'bg-emerald-400' : 'bg-gray-500'}`} /></h3><Button variant="ghost" onClick={() => setLogLines([])}>Clear</Button></div>
        <div ref={logRef} className="h-56 overflow-auto rounded bg-[#0a0a0f] p-3 font-mono text-xs">
          {!logLines.length ? <p className="text-[#8888aa]">No activity yet. Tool invocations and results will stream here in real time.</p> : logLines.map((line, i) => <div key={`${line}-${i}`}>{line}</div>)}
        </div>
      </Card>

      <Modal open={!!openProvider} title={`Configure ${openProvider || ''}`} onClose={() => setOpenProvider(null)}>
        <div className="space-y-3 text-sm">
          <p>{providerInstruction}</p>
          <pre className="mono rounded bg-[#0a0a0f] p-2 text-xs">{`{\n  "name": "codegraph",\n  "transport": "stdio",\n  "args": ["--provider", "${openProvider}"]\n}`}</pre>
          <div className="flex gap-2"><Button variant="ghost">Copy config</Button><Button onClick={async () => {
            const res = await api.mcpTest(openProvider || 'custom')
            setTestResult(JSON.stringify(res))
          }}>Test Connection</Button></div>
          {!!testResult && <p className="text-xs text-cyan-200">{testResult}</p>}
        </div>
      </Modal>
    </div>
  )
}
