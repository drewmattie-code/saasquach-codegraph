import { motion, AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Check } from '@phosphor-icons/react'

type Stats = { repositories: number; files: number; functions: number; classes: number }
type Repo = { name: string; path: string }

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

const sections = ['General', 'Indexing', 'Appearance', 'Integrations', 'About'] as const
type Section = (typeof sections)[number]

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={`relative h-6 w-11 rounded-full border transition ${checked ? 'border-[var(--accent-graph)] bg-[var(--accent-graph)]' : 'border-[var(--border-default)] bg-[var(--bg-base)]'}`}>
      <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

type IndexDepth = 'shallow' | 'standard' | 'deep'
type FontSize = 'small' | 'medium' | 'large'
type IndexStatus = 'idle' | 'indexing' | 'complete' | 'error'

const MOCK_STEPS: { message: string; progress: number }[] = [
  { message: 'Scanning directory...', progress: 15 },
  { message: 'Found 247 files', progress: 25 },
  { message: 'Parsing AST...', progress: 35 },
  { message: 'Resolving imports...', progress: 55 },
  { message: 'Building dependency graph...', progress: 75 },
  { message: 'Indexing 1,247 symbols...', progress: 90 },
  { message: 'Complete', progress: 100 },
]

export default function SettingsPage() {
  const [active, setActive] = useState<Section>('General')
  const [stats, setStats] = useState<Stats | null>(null)
  const [repos, setRepos] = useState<Repo[]>([])
  const [settings, setSettings] = useState({ autoReindex: true, includeDependencies: true, deepAnalysis: false })
  const [indexing, setIndexing] = useState(false)
  const [indexDepth, setIndexDepth] = useState<IndexDepth>('standard')
  const [excludePatterns, setExcludePatterns] = useState('node_modules\n.git\n__pycache__\ndist\nbuild')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [fontSize, setFontSize] = useState<FontSize>('medium')
  const [compactMode, setCompactMode] = useState(false)
  const [showLineNumbers, setShowLineNumbers] = useState(true)

  // Add Repository state
  const [addingRepo, setAddingRepo] = useState(false)
  const [repoInput, setRepoInput] = useState('')
  const [indexProgress, setIndexProgress] = useState(0)
  const [indexLogs, setIndexLogs] = useState<string[]>([])
  const [indexStatus, setIndexStatus] = useState<IndexStatus>('idle')
  const [indexElapsed, setIndexElapsed] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const mockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleReindex = () => {
    if (repos.length === 0) return
    setIndexing(true)
    fetch('/api/repos/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repos[0].path }),
    }).finally(() => setIndexing(false))
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/stats').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/repos').then((r) => (r.ok ? r.json() : [])),
    ]).then(([s, r]) => {
      if (s) setStats(s)
      setRepos((r as Repo[]).map((x) => ({ name: x.name, path: x.path })))
    })
  }, [])

  const removeRepo = (idx: number) => setRepos((prev) => prev.filter((_, i) => i !== idx))

  const cleanupIndexing = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (mockTimerRef.current) {
      clearInterval(mockTimerRef.current)
      mockTimerRef.current = null
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
  }, [])

  const startElapsedTimer = useCallback(() => {
    setIndexElapsed(0)
    elapsedTimerRef.current = setInterval(() => {
      setIndexElapsed((prev) => prev + 1)
    }, 1000)
  }, [])

  const runMockIndexing = useCallback(() => {
    let step = 0
    startElapsedTimer()
    mockTimerRef.current = setInterval(() => {
      if (step < MOCK_STEPS.length) {
        const { message, progress } = MOCK_STEPS[step]
        setIndexLogs((prev) => [message, ...prev].slice(0, 8))
        setIndexProgress(progress)
        if (message === 'Complete') {
          setIndexStatus('complete')
          if (elapsedTimerRef.current) {
            clearInterval(elapsedTimerRef.current)
            elapsedTimerRef.current = null
          }
          if (mockTimerRef.current) {
            clearInterval(mockTimerRef.current)
            mockTimerRef.current = null
          }
        }
        step++
      }
    }, 900)
  }, [startElapsedTimer])

  const handleAddRepo = useCallback(() => {
    if (!repoInput.trim()) return

    setIndexStatus('indexing')
    setIndexProgress(0)
    setIndexLogs([])
    setIndexElapsed(0)

    // POST to the indexing endpoint
    fetch('/api/repos/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repoInput.trim() }),
    }).catch(() => {
      // Silently handle - the WebSocket or mock will drive the UI
    })

    // Attempt WebSocket connection for real-time progress
    try {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${location.host}/ws/indexing`)
      wsRef.current = ws

      ws.onopen = () => {
        startElapsedTimer()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.message) {
            setIndexLogs((prev) => [data.message, ...prev].slice(0, 8))
          }
          if (typeof data.progress === 'number') {
            setIndexProgress(data.progress)
          }
          if (data.status === 'complete') {
            setIndexStatus('complete')
            if (elapsedTimerRef.current) {
              clearInterval(elapsedTimerRef.current)
              elapsedTimerRef.current = null
            }
            // Add the repo to the list and refresh
            const repoName = repoInput.trim().split('/').filter(Boolean).pop() || 'repo'
            setRepos((prev) => [...prev, { name: repoName, path: repoInput.trim() }])
            ws.close()
            wsRef.current = null
          }
          if (data.status === 'error') {
            setIndexStatus('error')
            cleanupIndexing()
          }
        } catch {
          // Non-JSON message, treat as log line
          setIndexLogs((prev) => [event.data, ...prev].slice(0, 8))
        }
      }

      ws.onerror = () => {
        // WebSocket failed, fall back to mock indexing
        ws.close()
        wsRef.current = null
        runMockIndexing()
      }

      ws.onclose = () => {
        // If we never got a message, it means connection failed immediately
        if (indexProgress === 0 && wsRef.current === ws) {
          wsRef.current = null
          runMockIndexing()
        }
      }
    } catch {
      // WebSocket construction failed, fall back to mock
      runMockIndexing()
    }
  }, [repoInput, startElapsedTimer, runMockIndexing, cleanupIndexing, indexProgress])

  const handleCancelIndexing = useCallback(() => {
    cleanupIndexing()
    setIndexStatus('idle')
    setIndexProgress(0)
    setIndexLogs([])
    setIndexElapsed(0)
  }, [cleanupIndexing])

  const handleDismissComplete = useCallback(() => {
    // Add mock repo on mock completion
    if (indexStatus === 'complete' && repoInput.trim()) {
      const repoName = repoInput.trim().split('/').filter(Boolean).pop() || 'repo'
      setRepos((prev) => {
        // Avoid duplicates
        if (prev.some((r) => r.path === repoInput.trim())) return prev
        return [...prev, { name: repoName, path: repoInput.trim() }]
      })
    }
    setIndexStatus('idle')
    setIndexProgress(0)
    setIndexLogs([])
    setIndexElapsed(0)
    setRepoInput('')
    setAddingRepo(false)
  }, [indexStatus, repoInput])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupIndexing()
    }
  }, [cleanupIndexing])

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  return (
    <motion.div initial="initial" animate="animate" transition={{ staggerChildren: 0.06 }} className="space-y-4 p-5">
      <motion.header variants={card} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4">
        <h1 className="text-3xl font-bold tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Configure indexing, analysis behavior, integrations, and platform metadata.</p>
      </motion.header>

      <motion.section variants={card} className="flex gap-4">
        <aside className="w-[200px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-2">
          {sections.map((s) => (
            <button key={s} onClick={() => setActive(s)} className={`relative mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition ${active === s ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>
              {active === s && <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 bg-[var(--accent-graph)]" />}
              {s}
            </button>
          ))}
        </aside>

        <div className="flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
          {active === 'General' && (
            <div className="space-y-4">
              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Workspace</div>
                <div className="mt-3 space-y-2">
                  {repos.map((r, i) => (
                    <div key={`${r.name}-${i}`} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-3 py-2">
                      <div>
                        <div className="text-sm" style={{ fontFamily: 'var(--font-display)' }}>{r.name}</div>
                        <div className="text-xs text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>{r.path}</div>
                      </div>
                      <button onClick={() => removeRepo(i)} className="rounded-md border border-[var(--border-default)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">Remove</button>
                    </div>
                  ))}
                </div>

                {/* Add Repository */}
                <div className="mt-3">
                  <AnimatePresence>
                    {!addingRepo && indexStatus === 'idle' && (
                      <motion.button
                        key="add-btn"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        onClick={() => setAddingRepo(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-default)] px-3 py-2.5 text-sm text-[var(--text-secondary)] transition hover:border-[var(--accent-graph)] hover:text-[var(--accent-graph)] hover:bg-[var(--bg-hover)]"
                      >
                        <Plus size={16} weight="bold" />
                        Add Repository
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {(addingRepo || indexStatus !== 'idle') && (
                      <motion.div
                        key="add-form"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3">
                          {/* Input row */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={repoInput}
                              onChange={(e) => setRepoInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && indexStatus === 'idle') handleAddRepo()
                                if (e.key === 'Escape') {
                                  setAddingRepo(false)
                                  setRepoInput('')
                                }
                              }}
                              placeholder="Enter local path (e.g. /Users/dev/myproject) or GitHub URL"
                              disabled={indexStatus === 'indexing'}
                              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] transition focus:border-[var(--accent-graph)] focus:outline-none disabled:opacity-50"
                              style={{ fontFamily: 'var(--font-display)' }}
                              autoFocus
                            />
                            {indexStatus === 'idle' && (
                              <button
                                onClick={handleAddRepo}
                                disabled={!repoInput.trim()}
                                className="rounded-lg border border-[var(--accent-graph)] bg-[var(--accent-graph)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                              >
                                Index
                              </button>
                            )}
                            {indexStatus === 'idle' && (
                              <button
                                onClick={() => { setAddingRepo(false); setRepoInput('') }}
                                className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
                              >
                                Cancel
                              </button>
                            )}
                          </div>

                          {/* Indexing progress section */}
                          <AnimatePresence>
                            {indexStatus !== 'idle' && (
                              <motion.div
                                key="progress"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-3 space-y-3">
                                  {/* Status header */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {indexStatus === 'indexing' && (
                                        <span className="flex items-center gap-1.5 rounded-full border border-[var(--accent-flow)]/30 bg-[var(--accent-flow)]/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--accent-flow)]">
                                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-flow)]" />
                                          {indexProgress < 15
                                            ? 'Scanning files...'
                                            : indexProgress < 35
                                              ? 'Parsing AST...'
                                              : indexProgress < 75
                                                ? 'Building graph...'
                                                : 'Finalizing...'}
                                        </span>
                                      )}
                                      {indexStatus === 'complete' && (
                                        <span className="flex items-center gap-1.5 rounded-full border border-[var(--accent-health)]/30 bg-[var(--accent-health)]/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--accent-health)]">
                                          <Check size={10} weight="bold" />
                                          Complete
                                        </span>
                                      )}
                                      {indexStatus === 'error' && (
                                        <span className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-red-400">
                                          Error
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[11px] text-[var(--text-tertiary)]" style={numberStyle}>
                                        {formatElapsed(indexElapsed)}
                                      </span>
                                      {indexStatus === 'indexing' && (
                                        <button
                                          onClick={handleCancelIndexing}
                                          className="rounded-md border border-[var(--border-default)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
                                        >
                                          Cancel
                                        </button>
                                      )}
                                      {indexStatus === 'complete' && (
                                        <button
                                          onClick={handleDismissComplete}
                                          className="rounded-md border border-[var(--accent-health)] bg-[var(--accent-health)] px-2.5 py-0.5 text-[11px] font-medium text-white transition hover:opacity-90"
                                        >
                                          Done
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Progress bar */}
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-base)]">
                                    <motion.div
                                      className="h-full rounded-full"
                                      style={{ backgroundColor: indexStatus === 'complete' ? 'var(--accent-health)' : 'var(--accent-graph)' }}
                                      initial={{ width: '0%' }}
                                      animate={{ width: `${indexProgress}%` }}
                                      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                                    />
                                  </div>

                                  {/* Log lines */}
                                  {indexLogs.length > 0 && (
                                    <div className="max-h-[160px] space-y-0.5 overflow-y-auto">
                                      {indexLogs.map((line, i) => (
                                        <div
                                          key={`${line}-${i}`}
                                          className="text-[11px] leading-relaxed"
                                          style={{
                                            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                                            color: i === 0 ? 'var(--accent-health)' : 'var(--text-tertiary)',
                                            opacity: i === 0 ? 1 : 0.7,
                                          }}
                                        >
                                          {line}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Analysis</div>
                <div className="mt-3 space-y-3">
                  {[
                    ['Auto-reindex on file change', 'autoReindex'],
                    ['Include dependencies', 'includeDependencies'],
                    ['Deep analysis mode', 'deepAnalysis'],
                  ].map(([label, key]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-3 py-2">
                      <span className="text-sm text-[var(--text-primary)]">{label}</span>
                      <Toggle checked={settings[key as keyof typeof settings]} onChange={() => setSettings((prev) => ({ ...prev, [key]: !prev[key as keyof typeof settings] }))} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {active === 'About' && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-5">
              <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>SaaSquach CodeGraph</div>
              <div className="mt-1 text-sm text-[var(--text-secondary)]">Engineering intelligence cockpit</div>
              <div className="mt-4 text-sm" style={numberStyle}>Version 1.0.0</div>
              <div className="mt-3 text-sm text-[var(--text-secondary)]" style={numberStyle}>
                {stats ? `${stats.repositories} repos, ${stats.files.toLocaleString()} files, ${stats.functions.toLocaleString()} functions, ${stats.classes.toLocaleString()} classes` : 'Loading stats...'}
              </div>
              <button className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-2 text-sm hover:bg-[var(--bg-hover)]">View on GitHub</button>
            </div>
          )}

          {active === 'Indexing' && (
            <div className="space-y-4">
              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Re-index</div>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-[var(--text-primary)]">Re-index all repositories</div>
                    <div className="mt-1 text-xs text-[var(--text-tertiary)]" style={numberStyle}>Last indexed: 2 minutes ago</div>
                  </div>
                  <button
                    onClick={handleReindex}
                    disabled={indexing}
                    className="rounded-lg border border-[var(--accent-graph)] bg-[var(--accent-graph)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {indexing ? 'Indexing...' : 'Re-index now'}
                  </button>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Exclude Patterns</div>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">One pattern per line. Matching directories are skipped during indexing.</p>
                <textarea
                  value={excludePatterns}
                  onChange={(e) => setExcludePatterns(e.target.value)}
                  rows={5}
                  className="mt-3 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] focus:border-[var(--accent-graph)] focus:outline-none"
                />
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Index Depth</div>
                <div className="mt-3 space-y-2">
                  {(['shallow', 'standard', 'deep'] as IndexDepth[]).map((depth) => (
                    <label key={depth} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-3 py-2 transition hover:bg-[var(--bg-hover)]">
                      <span className={`grid h-4 w-4 place-items-center rounded-full border ${indexDepth === depth ? 'border-[var(--accent-graph)]' : 'border-[var(--border-default)]'}`}>
                        {indexDepth === depth && <span className="h-2 w-2 rounded-full bg-[var(--accent-graph)]" />}
                      </span>
                      <input type="radio" name="indexDepth" value={depth} checked={indexDepth === depth} onChange={() => setIndexDepth(depth)} className="sr-only" />
                      <div>
                        <div className="text-sm capitalize text-[var(--text-primary)]">{depth}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">
                          {depth === 'shallow' && 'Scan top-level files and exports only'}
                          {depth === 'standard' && 'Full AST parse with dependency resolution'}
                          {depth === 'deep' && 'Standard + cross-repo linking and data-flow analysis'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          )}

          {active === 'Appearance' && (
            <div className="space-y-4">
              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Theme</div>
                <div className="mt-3 flex gap-2">
                  {(['dark', 'light'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium capitalize transition ${theme === t ? 'border-[var(--accent-graph)] bg-[var(--accent-graph)] text-white' : 'border-[var(--border-default)] bg-[var(--bg-raised)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Font Size</div>
                <div className="mt-3 space-y-2">
                  {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                    <label key={size} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-3 py-2 transition hover:bg-[var(--bg-hover)]">
                      <span className={`grid h-4 w-4 place-items-center rounded-full border ${fontSize === size ? 'border-[var(--accent-graph)]' : 'border-[var(--border-default)]'}`}>
                        {fontSize === size && <span className="h-2 w-2 rounded-full bg-[var(--accent-graph)]" />}
                      </span>
                      <input type="radio" name="fontSize" value={size} checked={fontSize === size} onChange={() => setFontSize(size)} className="sr-only" />
                      <span className="text-sm capitalize text-[var(--text-primary)]">{size}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Display</div>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-3 py-2">
                    <span className="text-sm text-[var(--text-primary)]">Compact mode</span>
                    <Toggle checked={compactMode} onChange={() => setCompactMode((v) => !v)} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-3 py-2">
                    <span className="text-sm text-[var(--text-primary)]">Show line numbers in code views</span>
                    <Toggle checked={showLineNumbers} onChange={() => setShowLineNumbers((v) => !v)} />
                  </div>
                </div>
              </section>
            </div>
          )}

          {active === 'Integrations' && (
            <div className="space-y-4">
              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] text-lg">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>GitHub</span>
                      <span className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--accent-health)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-health)]" />
                        Connected
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">Org: Acme Corp</div>
                  </div>
                  <button className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-2 text-xs hover:bg-[var(--bg-hover)]">Configure</button>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] text-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>MCP Connector</span>
                      <span className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--accent-flow)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-flow)]" />
                        Active
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">Oracle ERP Connector</div>
                  </div>
                  <button className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-2 text-xs hover:bg-[var(--bg-hover)]">Configure</button>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] text-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>Slack Notifications</span>
                      <span className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-raised)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)]" />
                        Disconnected
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">Send alerts and reports to Slack channels</div>
                  </div>
                  <button className="rounded-lg border border-[var(--accent-graph)] bg-[var(--accent-graph)] px-3 py-2 text-xs font-medium text-white transition hover:opacity-90">Connect</button>
                </div>
              </section>
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>
  )
}
