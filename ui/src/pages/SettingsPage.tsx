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

export default function SettingsPage() {
  const [active, setActive] = useState<Section>('General')
  const [stats, setStats] = useState<Stats | null>(null)
  const [repos, setRepos] = useState<Repo[]>([])
  const [settings, setSettings] = useState({ autoReindex: true, includeDependencies: true, deepAnalysis: false })

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

          {active !== 'General' && active !== 'About' && (
            <div className="grid h-48 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] text-sm text-[var(--text-secondary)]">
              {active} settings panel ready for configuration inputs.
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>
  )
}
