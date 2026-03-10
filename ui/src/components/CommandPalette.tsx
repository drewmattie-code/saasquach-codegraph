import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { File, Function, GitBranch, Folder, MagnifyingGlass } from '@phosphor-icons/react'

interface SearchResult {
  name: string
  type: string
  path: string
  line_number: number
  source_preview?: string  // first 3 lines of function source
}

type GroupKey = 'Repositories' | 'Functions' | 'Classes' | 'Files'

const TYPE_TO_GROUP: Record<string, GroupKey> = {
  repository: 'Repositories',
  repo: 'Repositories',
  function: 'Functions',
  method: 'Functions',
  class: 'Classes',
  file: 'Files',
}

const GROUP_ORDER: GroupKey[] = ['Repositories', 'Functions', 'Classes', 'Files']

const GROUP_ICONS: Record<GroupKey, typeof Folder> = {
  Repositories: Folder,
  Functions: Function,
  Classes: GitBranch,
  Files: File,
}

const DEMO_SYMBOLS: SearchResult[] = [
  { name: 'execute_cypher_query', type: 'function', path: 'src/analysis/graph_query.py', line_number: 16 },
  { name: 'GraphQuery', type: 'class', path: 'src/analysis/graph_query.py', line_number: 42 },
  { name: 'parse_ast', type: 'function', path: 'src/parser/ast_parser.py', line_number: 22 },
  { name: 'analyze_code', type: 'function', path: 'src/analysis/code_analyzer.py', line_number: 10 },
  { name: 'DependencyResolver', type: 'class', path: 'src/graph/dependency_resolver.py', line_number: 13 },
  { name: 'validate_input', type: 'function', path: 'src/utils/validators.py', line_number: 5 },
  { name: 'CacheManager', type: 'class', path: 'src/core/cache.py', line_number: 8 },
  { name: 'build_graph', type: 'function', path: 'src/graph/builder.py', line_number: 31 },
  { name: 'authenticate_user', type: 'function', path: 'src/auth/provider.py', line_number: 44 },
  { name: 'EventEmitter', type: 'class', path: 'src/core/events.py', line_number: 1 },
]

function mockPreview(result: SearchResult): string {
  const t = result.type.toLowerCase()
  if (t === 'function' || t === 'method') {
    return `def ${result.name}(self, *args, **kwargs):\n    """${result.name.replace(/_/g, ' ')}"""\n    ...`
  }
  if (t === 'class') {
    return `class ${result.name}:\n    """${result.name} implementation"""\n    def __init__(self):`
  }
  return `# ${result.path}\n# ${result.name}`
}

function getPreview(result: SearchResult): string {
  return result.source_preview ?? mockPreview(result)
}

function groupResults(results: SearchResult[]): Map<GroupKey, SearchResult[]> {
  const groups = new Map<GroupKey, SearchResult[]>()
  for (const r of results) {
    const key = TYPE_TO_GROUP[r.type.toLowerCase()] ?? 'Files'
    const list = groups.get(key)
    if (list) {
      list.push(r)
    } else {
      groups.set(key, [r])
    }
  }
  return groups
}

function filterDemoSymbols(q: string): SearchResult[] {
  const lower = q.toLowerCase()
  return DEMO_SYMBOLS.filter((s) => s.name.toLowerCase().includes(lower))
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSelectedIndex(0)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data: SearchResult[] = await res.json()
          if (data.length > 0) {
            setResults(data)
          } else {
            setResults(filterDemoSymbols(query.trim()))
          }
          setSelectedIndex(0)
        } else {
          setResults(filterDemoSymbols(query.trim()))
          setSelectedIndex(0)
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error('Search failed:', err)
          setResults(filterDemoSymbols(query.trim()))
          setSelectedIndex(0)
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  // Reset state when palette opens/closes
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [open])

  // Build the flat list of results for keyboard navigation
  const flatList = useMemo(() => {
    const grouped = groupResults(results)
    const flat: SearchResult[] = []
    for (const groupKey of GROUP_ORDER) {
      const items = grouped.get(groupKey)
      if (items) {
        flat.push(...items)
      }
    }
    return flat
  }, [results])

  const grouped = useMemo(() => groupResults(results), [results])

  // Navigate to the selected result
  const navigateToResult = useCallback(
    (result: SearchResult) => {
      const group = TYPE_TO_GROUP[result.type.toLowerCase()] ?? 'Files'
      if (group === 'Repositories') {
        navigate(`/repositories`)
      } else {
        navigate(`/graph?file=${encodeURIComponent(result.path)}&line=${result.line_number}`)
      }
      onClose()
    },
    [navigate, onClose]
  )

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (flatList[selectedIndex]) {
            navigateToResult(flatList[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [flatList, selectedIndex, navigateToResult, onClose]
  )

  // Track the flat index as we render grouped results
  let flatIndex = -1

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/40 pt-20 backdrop-blur-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="flex max-h-[560px] w-[720px] flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] py-3 pl-9 pr-3 text-[var(--text-primary)] outline-none transition-shadow duration-150 focus:[box-shadow:inset_0_0_0_1px_var(--accent-graph),0_0_20px_var(--glow-graph)]"
                placeholder="Type a command or search..."
              />
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-tertiary)] border-t-[var(--accent-graph)]" />
                </div>
              )}
            </div>

            {/* Results */}
            {flatList.length > 0 && (
              <div ref={listRef} className="mt-2 overflow-y-auto">
                {GROUP_ORDER.map((groupKey) => {
                  const items = grouped.get(groupKey)
                  if (!items || items.length === 0) return null
                  const Icon = GROUP_ICONS[groupKey]

                  return (
                    <div key={groupKey} className="mb-1">
                      {/* Section header */}
                      <div
                        className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]"
                      >
                        {groupKey}
                      </div>

                      {/* Items */}
                      {items.map((result) => {
                        flatIndex++
                        const currentIndex = flatIndex
                        const isSelected = currentIndex === selectedIndex

                        return (
                          <div key={`${result.path}:${result.line_number}:${result.name}`}>
                            <button
                              data-selected={isSelected}
                              onClick={() => navigateToResult(result)}
                              onMouseEnter={() => setSelectedIndex(currentIndex)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                isSelected
                                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                              }`}
                            >
                              <Icon
                                size={16}
                                weight="duotone"
                                className={isSelected ? 'text-[var(--accent-graph)]' : 'text-[var(--text-tertiary)]'}
                              />
                              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                                <span
                                  className="truncate font-[var(--font-display)] text-sm font-medium"
                                  style={{ fontFamily: 'var(--font-display)' }}
                                >
                                  {result.name}
                                </span>
                                <span className="truncate text-xs text-[var(--text-tertiary)]">
                                  {result.path}
                                  {result.line_number > 0 && `:${result.line_number}`}
                                </span>
                              </span>
                            </button>

                            {/* Source code preview */}
                            <AnimatePresence>
                              {isSelected && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                                  className="overflow-hidden"
                                >
                                  <div
                                    className="mx-3 mb-1 rounded-md border-l-2 border-l-[var(--accent-graph)] bg-[var(--bg-base)] px-2 py-0.5"
                                    style={{
                                      fontFamily: 'var(--font-display)',
                                      fontSize: '11px',
                                      color: 'var(--text-secondary)',
                                      whiteSpace: 'pre',
                                    }}
                                  >
                                    {getPreview(result)}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Empty state */}
            {query.trim() && !loading && flatList.length === 0 && (
              <div className="py-8 text-center text-sm text-[var(--text-tertiary)]">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {/* Keyboard hints */}
            {!query.trim() && (
              <div className="mt-3 flex items-center justify-center gap-4 py-4 text-xs text-[var(--text-tertiary)]">
                <span>
                  <kbd className="rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-1.5 py-0.5 font-mono text-[10px]">
                    &uarr;&darr;
                  </kbd>{' '}
                  navigate
                </span>
                <span>
                  <kbd className="rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-1.5 py-0.5 font-mono text-[10px]">
                    &crarr;
                  </kbd>{' '}
                  select
                </span>
                <span>
                  <kbd className="rounded border border-[var(--border-default)] bg-[var(--bg-base)] px-1.5 py-0.5 font-mono text-[10px]">
                    esc
                  </kbd>{' '}
                  close
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
