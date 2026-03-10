import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

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
                    {indexing ? 'Indexing…' : 'Re-index now'}
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
