import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import {
  Package,
  ShieldWarning,
  ArrowUp,
  CalendarBlank,
  Star,
  DownloadSimple,
  FileCode,
  Warning,
  CheckCircle,
  Info,
} from '@phosphor-icons/react'

cytoscape.use(fcose as Parameters<typeof cytoscape.use>[0])

const card = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
const numberStyle = { fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' as const }

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

type DepStatus = 'current' | 'outdated' | 'vulnerable'

const STATUS_COLORS: Record<DepStatus, string> = {
  current: '#00d68f',
  outdated: '#ffb84d',
  vulnerable: '#ff6b6b',
}

const STATUS_LABELS: Record<DepStatus, string> = {
  current: 'Up to date',
  outdated: 'Update available',
  vulnerable: 'Vulnerability',
}

/* ------------------------------------------------------------------ */
/*  Mock data types                                                    */
/* ------------------------------------------------------------------ */

interface DepNode {
  id: string
  name: string
  version: string
  latestVersion: string
  status: DepStatus
  description: string
  license: string
  weeklyDownloads: string
  githubStars: string
  lastPublished: string
  usedBy: string[]
  vulnerability?: {
    severity: string
    cveId: string
    description: string
  }
  children: {
    id: string
    name: string
    version: string
    status: DepStatus
  }[]
}

/* ------------------------------------------------------------------ */
/*  Full mock dataset                                                  */
/* ------------------------------------------------------------------ */

const MOCK_DEPS: DepNode[] = [
  {
    id: 'neo4j-driver',
    name: 'neo4j-driver',
    version: '^5.14.0',
    latestVersion: '5.14.0',
    status: 'current',
    description: 'Official Neo4j driver for JavaScript and TypeScript. Provides Bolt protocol connectivity and query execution.',
    license: 'Apache-2.0',
    weeklyDownloads: '245K',
    githubStars: '1.2K',
    lastPublished: '2024-01-18',
    usedBy: ['src/services/graphDb.ts', 'src/connectors/neo4j.ts', 'src/utils/cypher.ts', 'src/api/graph.ts'],
    children: [
      { id: 'neo4j-driver-bolt-connection', name: 'bolt-connection', version: '5.14.0', status: 'current' },
      { id: 'neo4j-driver-core', name: 'neo4j-driver-core', version: '5.14.0', status: 'current' },
      { id: 'neo4j-driver-bolt-protocol', name: 'bolt-protocol', version: '5.14.0', status: 'current' },
      { id: 'neo4j-driver-rxjs', name: 'rxjs', version: '7.8.1', status: 'current' },
      { id: 'neo4j-driver-buffer', name: 'buffer', version: '6.0.3', status: 'current' },
      { id: 'neo4j-driver-string-decoder', name: 'string_decoder', version: '1.3.0', status: 'current' },
    ],
  },
  {
    id: 'networkx',
    name: 'networkx',
    version: '^3.2',
    latestVersion: '3.2.1',
    status: 'current',
    description: 'Python package for creating, manipulating, and studying complex networks and graph structures.',
    license: 'BSD-3-Clause',
    weeklyDownloads: '12.8M',
    githubStars: '14.2K',
    lastPublished: '2024-01-05',
    usedBy: ['src/analysis/topology.py', 'src/analysis/centrality.py', 'src/utils/graph_metrics.py'],
    children: [
      { id: 'networkx-numpy', name: 'numpy', version: '1.26.3', status: 'current' },
      { id: 'networkx-scipy', name: 'scipy', version: '1.11.4', status: 'current' },
      { id: 'networkx-matplotlib', name: 'matplotlib', version: '3.8.2', status: 'outdated' },
      { id: 'networkx-pandas', name: 'pandas', version: '2.1.4', status: 'current' },
    ],
  },
  {
    id: 'tree-sitter',
    name: 'tree-sitter',
    version: '^0.21',
    latestVersion: '0.22.1',
    status: 'outdated',
    description: 'Incremental parsing system for programming tools. Builds concrete syntax trees for source files.',
    license: 'MIT',
    weeklyDownloads: '890K',
    githubStars: '16.8K',
    lastPublished: '2024-02-01',
    usedBy: ['src/parser/treeSitter.ts', 'src/parser/languages.ts', 'src/analysis/ast.ts', 'src/indexer/symbols.ts'],
    children: [
      { id: 'tree-sitter-cli', name: 'tree-sitter-cli', version: '0.21.0', status: 'outdated' },
      { id: 'tree-sitter-node-addon', name: 'node-addon-api', version: '7.0.0', status: 'current' },
      { id: 'tree-sitter-nan', name: 'nan', version: '2.18.0', status: 'current' },
    ],
  },
  {
    id: 'fastapi',
    name: 'fastapi',
    version: '^0.109',
    latestVersion: '0.109.0',
    status: 'current',
    description: 'Modern, fast web framework for building APIs with Python based on standard type hints.',
    license: 'MIT',
    weeklyDownloads: '8.4M',
    githubStars: '68.5K',
    lastPublished: '2024-01-20',
    usedBy: ['src/api/main.py', 'src/api/routes.py', 'src/api/middleware.py'],
    children: [
      { id: 'fastapi-starlette', name: 'starlette', version: '0.35.1', status: 'current' },
      { id: 'fastapi-pydantic', name: 'pydantic', version: '2.5.3', status: 'current' },
      { id: 'fastapi-uvicorn', name: 'uvicorn', version: '0.25.0', status: 'current' },
      { id: 'fastapi-httptools', name: 'httptools', version: '0.6.1', status: 'current' },
      { id: 'fastapi-anyio', name: 'anyio', version: '4.2.0', status: 'current' },
      { id: 'fastapi-typing-ext', name: 'typing-extensions', version: '4.9.0', status: 'current' },
      { id: 'fastapi-email-validator', name: 'email-validator', version: '2.1.0', status: 'current' },
      { id: 'fastapi-jinja2', name: 'jinja2', version: '3.1.3', status: 'current' },
    ],
  },
  {
    id: 'pydantic',
    name: 'pydantic',
    version: '^2.5',
    latestVersion: '2.5.3',
    status: 'current',
    description: 'Data validation library using Python type annotations. Enforces type hints at runtime.',
    license: 'MIT',
    weeklyDownloads: '22.1M',
    githubStars: '18.9K',
    lastPublished: '2024-01-12',
    usedBy: ['src/models/schema.py', 'src/api/validators.py', 'src/config/settings.py'],
    children: [
      { id: 'pydantic-core', name: 'pydantic-core', version: '2.14.6', status: 'current' },
      { id: 'pydantic-annotated', name: 'annotated-types', version: '0.6.0', status: 'current' },
      { id: 'pydantic-typing-ext', name: 'typing-extensions', version: '4.9.0', status: 'current' },
      { id: 'pydantic-email-validator', name: 'email-validator', version: '2.1.0', status: 'current' },
      { id: 'pydantic-devtools', name: 'devtools', version: '0.12.2', status: 'current' },
    ],
  },
  {
    id: 'redis',
    name: 'redis',
    version: '^5.0',
    latestVersion: '5.0.2',
    status: 'vulnerable',
    description: 'Python client for Redis key-value store. Supports pipelines, pub/sub, and Lua scripting.',
    license: 'MIT',
    weeklyDownloads: '11.3M',
    githubStars: '12.1K',
    lastPublished: '2024-01-08',
    usedBy: ['src/cache/redis.py', 'src/workers/queue.py', 'src/services/session.py', 'src/pubsub/events.py'],
    vulnerability: {
      severity: 'HIGH',
      cveId: 'CVE-2024-31228',
      description: 'Denial of service vulnerability in Redis server. Specially crafted ACL selectors can trigger unbounded memory allocation during pattern matching.',
    },
    children: [
      { id: 'redis-async-timeout', name: 'async-timeout', version: '4.0.3', status: 'current' },
      { id: 'redis-hiredis', name: 'hiredis', version: '2.3.2', status: 'vulnerable' },
      { id: 'redis-packaging', name: 'packaging', version: '23.2', status: 'current' },
      { id: 'redis-importlib', name: 'importlib-metadata', version: '7.0.1', status: 'current' },
    ],
  },
  {
    id: 'celery',
    name: 'celery',
    version: '^5.3',
    latestVersion: '5.3.7',
    status: 'outdated',
    description: 'Distributed task queue for processing asynchronous workloads with support for scheduling.',
    license: 'BSD-3-Clause',
    weeklyDownloads: '5.6M',
    githubStars: '23.4K',
    lastPublished: '2024-01-15',
    usedBy: ['src/workers/tasks.py', 'src/workers/celeryconfig.py', 'src/services/pipeline.py'],
    children: [
      { id: 'celery-billiard', name: 'billiard', version: '4.2.0', status: 'current' },
      { id: 'celery-kombu', name: 'kombu', version: '5.3.4', status: 'outdated' },
      { id: 'celery-vine', name: 'vine', version: '5.1.0', status: 'current' },
      { id: 'celery-amqp', name: 'amqp', version: '5.2.0', status: 'current' },
      { id: 'celery-click', name: 'click', version: '8.1.7', status: 'current' },
      { id: 'celery-dateutil', name: 'python-dateutil', version: '2.8.2', status: 'outdated' },
    ],
  },
  {
    id: 'pytest',
    name: 'pytest',
    version: '^7.4',
    latestVersion: '7.4.4',
    status: 'current',
    description: 'Full-featured testing framework for Python. Supports fixtures, parameterization, and plugins.',
    license: 'MIT',
    weeklyDownloads: '31.2M',
    githubStars: '11.3K',
    lastPublished: '2023-12-30',
    usedBy: ['tests/conftest.py', 'tests/test_graph.py', 'tests/test_api.py'],
    children: [
      { id: 'pytest-pluggy', name: 'pluggy', version: '1.3.0', status: 'current' },
      { id: 'pytest-iniconfig', name: 'iniconfig', version: '2.0.0', status: 'current' },
      { id: 'pytest-packaging', name: 'packaging', version: '23.2', status: 'current' },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Aggregate stats                                                    */
/* ------------------------------------------------------------------ */

const TOTAL_DEPS = 156
const OUTDATED_COUNT = 7
const VULN_COUNT = 2

/* ------------------------------------------------------------------ */
/*  Build Cytoscape elements                                           */
/* ------------------------------------------------------------------ */

type FilterMode = 'direct' | 'transitive'

function buildElements(deps: DepNode[], mode: FilterMode) {
  const nodes: cytoscape.ElementDefinition[] = []
  const edges: cytoscape.ElementDefinition[] = []

  // Root node
  nodes.push({
    data: {
      id: 'platform',
      label: 'platform',
      version: '',
      status: 'current' as DepStatus,
      childCount: deps.length,
    },
  })

  for (const dep of deps) {
    nodes.push({
      data: {
        id: dep.id,
        label: dep.name,
        version: dep.version,
        status: dep.status,
        childCount: dep.children.length,
      },
    })
    edges.push({
      data: {
        id: `platform->${dep.id}`,
        source: 'platform',
        target: dep.id,
      },
    })

    if (mode === 'transitive') {
      for (const child of dep.children) {
        nodes.push({
          data: {
            id: child.id,
            label: child.name,
            version: child.version,
            status: child.status,
            childCount: 0,
          },
        })
        edges.push({
          data: {
            id: `${dep.id}->${child.id}`,
            source: dep.id,
            target: child.id,
          },
        })
      }
    }
  }

  return [...nodes, ...edges]
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DependenciesPage() {
  const [filterMode, setFilterMode] = useState<FilterMode>('transitive')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  // Find selected dep data
  const selectedDep: DepNode | null =
    selectedId ? MOCK_DEPS.find((d) => d.id === selectedId) ?? null : null

  /* ---- Build / rebuild Cytoscape ---- */
  useEffect(() => {
    if (!containerRef.current) return

    if (cyRef.current) {
      cyRef.current.destroy()
      cyRef.current = null
    }

    const elements = buildElements(MOCK_DEPS, filterMode)

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      style: [
        {
          selector: 'node',
          style: {
            label: (ele: cytoscape.NodeSingular) => {
              const name = ele.data('label')
              const ver = ele.data('version')
              return ver ? `${name}\n${ver}` : name
            },
            'font-size': 10,
            'font-family': 'JetBrains Mono, monospace',
            color: '#e8e8f0',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 6,
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'background-color': (ele: cytoscape.NodeSingular) =>
              STATUS_COLORS[(ele.data('status') as DepStatus) ?? 'current'],
            width: (ele: cytoscape.NodeSingular) => {
              const c = Number(ele.data('childCount') ?? 0)
              if (ele.id() === 'platform') return 32
              return Math.max(14, Math.min(28, 14 + c * 1.8))
            },
            height: (ele: cytoscape.NodeSingular) => {
              const c = Number(ele.data('childCount') ?? 0)
              if (ele.id() === 'platform') return 32
              return Math.max(14, Math.min(28, 14 + c * 1.8))
            },
            'border-width': 0,
            'border-color': '#ffffff',
            'text-background-color': '#0c0c14',
            'text-background-opacity': 0.75,
            'text-background-padding': '2px',
            'shadow-color': (ele: cytoscape.NodeSingular) =>
              STATUS_COLORS[(ele.data('status') as DepStatus) ?? 'current'],
            'shadow-opacity': 0.4,
            'shadow-blur': 8,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0,
            'transition-property': 'opacity, border-width, shadow-blur',
            'transition-duration': 250,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node#platform',
          style: {
            'background-color': '#6c5ce7',
            'shadow-color': '#6c5ce7',
            'shadow-opacity': 0.6,
            'shadow-blur': 14,
            'font-size': 12,
            'font-weight': 700,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-width': 2,
            'border-color': '#ffffff',
            'shadow-blur': 20,
            'shadow-opacity': 0.9,
            'z-index': 999,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'node.dimmed',
          style: {
            opacity: 0.12,
          } as cytoscape.Css.Node,
        },
        {
          selector: 'edge',
          style: {
            width: 1,
            'line-color': '#2a2a45',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#2a2a45',
            'arrow-scale': 0.7,
            'curve-style': 'bezier',
            opacity: 0.5,
            'transition-property': 'opacity, line-color, target-arrow-color',
            'transition-duration': 250,
          } as cytoscape.Css.Edge,
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#6c5ce7',
            'target-arrow-color': '#6c5ce7',
            width: 1.5,
            opacity: 0.9,
          } as cytoscape.Css.Edge,
        },
        {
          selector: 'edge.dimmed',
          style: {
            opacity: 0.06,
          } as cytoscape.Css.Edge,
        },
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        spacingFactor: 1.0,
        avoidOverlap: true,
        animate: true,
        animationDuration: 600,
        roots: '#platform',
      } as cytoscape.LayoutOptions,
    })

    /* ---- Click node ---- */
    cy.on('tap', 'node', (e) => {
      const nodeId = e.target.id()
      if (nodeId === 'platform') return

      // Check if it's a top-level dep or a sub-dep
      const topDep = MOCK_DEPS.find((d) => d.id === nodeId)
      if (topDep) {
        setSelectedId(nodeId)
      } else {
        // Find parent dep
        const parent = MOCK_DEPS.find((d) => d.children.some((c) => c.id === nodeId))
        if (parent) setSelectedId(parent.id)
      }

      // Highlight dependency chain (ancestors + descendants)
      cy.elements().removeClass('highlighted dimmed')
      const ancestors = e.target.predecessors()
      const descendants = e.target.successors()
      const chain = ancestors.union(descendants).union(e.target)
      chain.addClass('highlighted')
      cy.elements().not(chain).addClass('dimmed')
    })

    /* ---- Hover ---- */
    cy.on('mouseover', 'node', (e) => {
      if (cy.$('.highlighted').length > 0) return // don't override selection highlight
      const ancestors = e.target.predecessors()
      const descendants = e.target.successors()
      const chain = ancestors.union(descendants).union(e.target)
      chain.addClass('highlighted')
      cy.elements().not(chain).addClass('dimmed')
    })
    cy.on('mouseout', 'node', () => {
      if (selectedId) return // keep selection highlight
      cy.elements().removeClass('highlighted dimmed')
    })

    /* ---- Background click ---- */
    cy.on('tap', (e) => {
      if (e.target === cy) {
        cy.elements().removeClass('highlighted dimmed')
        setSelectedId(null)
      }
    })

    cyRef.current = cy

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode])

  /* ---- Re-apply highlight when selectedId changes externally ---- */
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().removeClass('highlighted dimmed')
    if (!selectedId) return

    const node = cy.$(`#${selectedId}`)
    if (node.length) {
      const ancestors = node.predecessors()
      const descendants = node.successors()
      const chain = ancestors.union(descendants).union(node)
      chain.addClass('highlighted')
      cy.elements().not(chain).addClass('dimmed')
    }
  }, [selectedId])

  return (
    <motion.div
      initial="initial"
      animate="animate"
      transition={{ staggerChildren: 0.06 }}
      className="space-y-4 p-5"
    >
      {/* ================================================================ */}
      {/*  Header                                                          */}
      {/* ================================================================ */}
      <motion.header
        variants={card}
        className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4"
      >
        <h1
          className="text-3xl font-bold tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Dependencies
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Hierarchical dependency tree with version status and vulnerability tracking.
        </p>
      </motion.header>

      {/* ================================================================ */}
      {/*  Summary Bar                                                     */}
      {/* ================================================================ */}
      <motion.section
        variants={card}
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] px-5 py-4"
      >
        {/* Stat cards */}
        <div className="flex flex-1 flex-wrap gap-3">
          {/* Total */}
          <div className="flex min-w-[120px] items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3">
            <Package size={20} className="text-[var(--accent-graph)]" weight="duotone" />
            <div>
              <div className="text-xs text-[var(--text-tertiary)]">Total</div>
              <div className="text-xl font-bold" style={numberStyle}>{TOTAL_DEPS}</div>
            </div>
          </div>
          {/* Direct */}
          <div className="flex min-w-[120px] items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3">
            <Package size={20} className="text-[var(--accent-flow)]" weight="duotone" />
            <div>
              <div className="text-xs text-[var(--text-tertiary)]">Direct</div>
              <div className="text-xl font-bold" style={numberStyle}>23</div>
            </div>
          </div>
          {/* Outdated */}
          <div className="flex min-w-[120px] items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3">
            <ArrowUp size={20} className="text-[var(--accent-insight)]" weight="duotone" />
            <div>
              <div className="text-xs text-[var(--text-tertiary)]">Outdated</div>
              <div className="text-xl font-bold text-[var(--accent-insight)]" style={numberStyle}>{OUTDATED_COUNT}</div>
            </div>
          </div>
          {/* Vulnerabilities */}
          <div className="flex min-w-[120px] items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3">
            <ShieldWarning size={20} className="text-[var(--accent-risk)]" weight="duotone" />
            <div>
              <div className="text-xs text-[var(--text-tertiary)]">Vulnerabilities</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-[var(--accent-risk)]" style={numberStyle}>{VULN_COUNT}</span>
                <span className="rounded-full bg-[var(--accent-risk)] px-2 py-0.5 text-[10px] font-semibold text-white">
                  ALERT
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Toggle: Direct / Transitive */}
        <div className="flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-1">
          <button
            onClick={() => setFilterMode('direct')}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${
              filterMode === 'direct'
                ? 'bg-[var(--accent-graph)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Direct
          </button>
          <button
            onClick={() => setFilterMode('transitive')}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${
              filterMode === 'transitive'
                ? 'bg-[var(--accent-graph)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Transitive
          </button>
        </div>
      </motion.section>

      {/* ================================================================ */}
      {/*  Main content: Graph + Detail Panel                              */}
      {/* ================================================================ */}
      <motion.section variants={card} className="flex gap-4">
        {/* ---- LEFT: Cytoscape Graph (55%) ---- */}
        <div
          className="relative overflow-hidden rounded-2xl border border-[var(--border-default)]"
          style={{
            width: '55%',
            height: 'calc(100vh - 280px)',
            background: 'linear-gradient(160deg, var(--bg-elevated) 0%, var(--bg-base) 60%, var(--bg-void) 100%)',
          }}
        >
          <div ref={containerRef} className="h-full w-full" />

          {/* Legend overlay */}
          <div className="absolute bottom-3 left-3 flex items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[rgba(12,12,20,0.85)] px-3 py-2 text-[10px] backdrop-blur">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS.current }} />
              Current
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS.outdated }} />
              Outdated
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS.vulnerable }} />
              Vulnerable
            </span>
          </div>
        </div>

        {/* ---- RIGHT: Detail Panel (45%) ---- */}
        <div
          className="overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-5"
          style={{ width: '45%', height: 'calc(100vh - 280px)' }}
        >
          {selectedDep ? (
            <motion.div
              key={selectedDep.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Package name + version badges */}
              <div>
                <h2
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {selectedDep.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2.5 py-1 text-xs" style={numberStyle}>
                    current: {selectedDep.version}
                  </span>
                  <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2.5 py-1 text-xs" style={numberStyle}>
                    latest: {selectedDep.latestVersion}
                  </span>
                  <span
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium"
                    style={{
                      background: `${STATUS_COLORS[selectedDep.status]}18`,
                      color: STATUS_COLORS[selectedDep.status],
                      border: `1px solid ${STATUS_COLORS[selectedDep.status]}30`,
                    }}
                  >
                    {selectedDep.status === 'current' && <CheckCircle size={13} weight="bold" />}
                    {selectedDep.status === 'outdated' && <ArrowUp size={13} weight="bold" />}
                    {selectedDep.status === 'vulnerable' && <ShieldWarning size={13} weight="bold" />}
                    {STATUS_LABELS[selectedDep.status]}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {selectedDep.description}
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 text-center">
                  <DownloadSimple size={16} className="mx-auto mb-1 text-[var(--text-tertiary)]" />
                  <div className="text-sm font-semibold" style={numberStyle}>{selectedDep.weeklyDownloads}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">Weekly downloads</div>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 text-center">
                  <Star size={16} className="mx-auto mb-1 text-[var(--text-tertiary)]" />
                  <div className="text-sm font-semibold" style={numberStyle}>{selectedDep.githubStars}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">GitHub stars</div>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 text-center">
                  <CalendarBlank size={16} className="mx-auto mb-1 text-[var(--text-tertiary)]" />
                  <div className="text-sm font-semibold" style={numberStyle}>{selectedDep.lastPublished}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">Last published</div>
                </div>
              </div>

              {/* License badge */}
              <div className="flex items-center gap-2">
                <Info size={14} className="text-[var(--text-tertiary)]" />
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                  {selectedDep.license}
                </span>
              </div>

              {/* Vulnerability alert */}
              {selectedDep.vulnerability && (
                <div className="rounded-xl border border-[var(--accent-risk)]/30 bg-[var(--accent-risk)]/8 p-4">
                  <div className="flex items-center gap-2">
                    <Warning size={18} className="text-[var(--accent-risk)]" weight="bold" />
                    <span className="text-sm font-semibold text-[var(--accent-risk)]">
                      Security Vulnerability
                    </span>
                    <span className="ml-auto rounded-full bg-[var(--accent-risk)] px-2 py-0.5 text-[10px] font-bold text-white">
                      {selectedDep.vulnerability.severity}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-medium text-[var(--text-primary)]" style={numberStyle}>
                    {selectedDep.vulnerability.cveId}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {selectedDep.vulnerability.description}
                  </p>
                </div>
              )}

              {/* Used by */}
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  Used by
                </div>
                <div className="space-y-1.5">
                  {selectedDep.usedBy.map((file) => (
                    <div
                      key={file}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs"
                    >
                      <FileCode size={14} className="shrink-0 text-[var(--accent-graph)]" />
                      <span className="truncate" style={{ fontFamily: 'var(--font-display)' }}>
                        {file}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-dependencies */}
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  Sub-dependencies ({selectedDep.children.length})
                </div>
                <div className="space-y-1">
                  {selectedDep.children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: STATUS_COLORS[child.status] }}
                        />
                        <span style={{ fontFamily: 'var(--font-display)' }}>{child.name}</span>
                      </div>
                      <span className="text-[var(--text-tertiary)]" style={numberStyle}>
                        {child.version}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Update button */}
              <button
                className="w-full rounded-xl border border-[var(--accent-graph)]/40 bg-[var(--accent-graph)]/10 py-2.5 text-sm font-medium text-[var(--accent-graph)] transition hover:bg-[var(--accent-graph)]/20"
              >
                <ArrowUp size={14} className="mr-1.5 inline-block" weight="bold" />
                Update to latest
              </button>
            </motion.div>
          ) : (
            /* Placeholder when nothing selected */
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Package size={48} className="mb-4 text-[var(--text-tertiary)]" weight="duotone" />
              <h3
                className="text-lg font-semibold text-[var(--text-secondary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Select a dependency to view details
              </h3>
              <p className="mt-2 max-w-[280px] text-xs text-[var(--text-tertiary)]">
                Click on any node in the dependency graph to inspect its version, license, vulnerabilities, and usage.
              </p>
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>
  )
}
