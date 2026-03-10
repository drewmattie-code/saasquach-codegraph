// Procedural graph generation — realistic codebase topology for demo mode
// Produces 500 nodes in 3-5 clusters with ~1000 edges

const FUNCTION_NAMES = [
  'find_by_variable', 'analyze_code', 'get_repository_stats', 'load_bundle',
  'execute_cypher_query', 'find_related_code', 'check_job_status', 'parse_ast',
  'validate_input', 'transform_node', 'build_graph', 'resolve_imports',
  'compute_metrics', 'extract_symbols', 'detect_cycles', 'merge_results',
  'fetch_metadata', 'normalize_path', 'traverse_tree', 'emit_event',
  'process_batch', 'schedule_task', 'compress_data', 'decrypt_payload',
  'encode_response', 'decode_request', 'authenticate_user', 'authorize_action',
  'cache_result', 'invalidate_cache', 'log_activity', 'send_notification',
  'render_template', 'compile_query', 'optimize_plan', 'evaluate_expression',
  'serialize_output', 'deserialize_input', 'handle_error', 'retry_operation',
  'spawn_worker', 'collect_garbage', 'allocate_buffer', 'release_resource',
  'connect_driver', 'close_connection', 'migrate_schema', 'seed_database',
  'index_documents', 'search_index', 'rank_results', 'filter_duplicates',
  'aggregate_stats', 'diff_snapshots', 'apply_patch', 'revert_change',
  'clone_repository', 'checkout_branch', 'commit_changes', 'push_remote',
  'pull_upstream', 'resolve_conflict', 'tag_release', 'create_bundle',
  'deploy_artifact', 'rollback_deploy', 'monitor_health', 'alert_threshold',
  'scale_service', 'drain_queue', 'rebalance_shards', 'snapshot_state',
  'restore_backup', 'rotate_keys', 'refresh_token', 'revoke_session',
  'hash_password', 'verify_signature', 'generate_keypair', 'encrypt_field',
  'sanitize_html', 'escape_sql', 'validate_schema', 'lint_source',
  'format_code', 'minify_output', 'bundle_assets', 'transpile_module',
  'watch_filesystem', 'debounce_handler', 'throttle_requests', 'rate_limit',
]

const CLASS_NAMES = [
  'GraphQuery', 'RepositoryManager', 'CodeAnalyzer', 'CypherEngine',
  'ASTParser', 'SymbolResolver', 'DependencyTracker', 'IndexBuilder',
  'CacheManager', 'EventEmitter', 'TaskScheduler', 'ConnectionPool',
  'QueryOptimizer', 'SchemaValidator', 'AuthProvider', 'SessionStore',
  'MetricsCollector', 'AlertManager', 'DeployPipeline', 'BundleCompiler',
  'TemplateEngine', 'RouterHandler', 'MiddlewareChain', 'ErrorBoundary',
  'StateManager', 'ConfigLoader', 'PluginRegistry', 'HookDispatcher',
  'StreamProcessor', 'BatchExecutor', 'WorkerPool', 'ResourceAllocator',
]

const MODULE_NAMES = [
  'parser', 'ast', 'graph', 'shutdown', 'close_driver', 'config',
  'utils', 'helpers', 'constants', 'types', 'middleware', 'routes',
  'models', 'services', 'controllers', 'repositories', 'migrations',
  'seeds', 'fixtures', 'factories', 'validators', 'serializers',
  'transforms', 'adapters', 'connectors', 'drivers', 'plugins',
  'hooks', 'events', 'streams', 'queues', 'workers', 'schedulers',
  'monitors', 'alerts', 'metrics', 'logging', 'auth', 'crypto',
  'storage', 'cache',
]

const DIRS = [
  'src/core', 'src/graph', 'src/api', 'src/services', 'src/utils',
  'src/auth', 'src/models', 'src/middleware', 'src/workers', 'src/plugins',
  'lib/parser', 'lib/ast', 'lib/query', 'lib/cache', 'lib/crypto',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickUnique(arr: string[], count: number): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    if (i < shuffled.length) {
      result.push(shuffled[i])
    } else {
      // Append suffix for uniqueness
      result.push(`${shuffled[i % shuffled.length]}_${Math.floor(i / shuffled.length)}`)
    }
  }
  return result
}

interface GeneratedNode {
  id: number
  name: string
  type: string
  path: string
  line_number: number
}

interface GeneratedEdge {
  source: number
  target: number
  kind: string
}

export interface GeneratedGraph {
  nodes: GeneratedNode[]
  edges: GeneratedEdge[]
}

export function generateMockGraph(
  nodeCount = 500,
  functionRatio = 0.8,
  classRatio = 0.12,
): GeneratedGraph {
  const fnCount = Math.floor(nodeCount * functionRatio)
  const clsCount = Math.floor(nodeCount * classRatio)
  const modCount = Math.max(1, nodeCount - fnCount - clsCount)

  const nodes: GeneratedNode[] = []
  let id = 1

  // Generate function names with suffixes for uniqueness
  const fnNames = pickUnique(FUNCTION_NAMES, fnCount)
  for (const name of fnNames) {
    const dir = pick(DIRS)
    nodes.push({
      id: id++,
      name,
      type: 'function',
      path: `${dir}/${name.split('_')[0]}.py`,
      line_number: Math.floor(Math.random() * 500) + 1,
    })
  }

  const clsNames = pickUnique(CLASS_NAMES, clsCount)
  for (const name of clsNames) {
    const dir = pick(DIRS)
    nodes.push({
      id: id++,
      name,
      type: 'class',
      path: `${dir}/${name.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1)}.py`,
      line_number: Math.floor(Math.random() * 200) + 1,
    })
  }

  const modNames = pickUnique(MODULE_NAMES, modCount)
  for (const name of modNames) {
    const dir = pick(DIRS)
    nodes.push({
      id: id++,
      name,
      type: 'module',
      path: `${dir}/${name}/__init__.py`,
      line_number: 1,
    })
  }

  // Assign nodes to clusters (3-5 clusters based on directory prefix)
  const clusters = new Map<string, number[]>()
  for (const n of nodes) {
    const prefix = n.path.split('/')[0]
    if (!clusters.has(prefix)) clusters.set(prefix, [])
    clusters.get(prefix)!.push(n.id)
  }

  const edges: GeneratedEdge[] = []
  const edgeSet = new Set<string>()

  function addEdge(source: number, target: number, kind: string) {
    if (source === target) return
    const key = `${source}-${target}`
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    edges.push({ source, target, kind })
  }

  // Intra-cluster edges (dense): modules→functions, classes→functions (methods)
  const moduleNodes = nodes.filter(n => n.type === 'module')
  const classNodes = nodes.filter(n => n.type === 'class')
  const functionNodes = nodes.filter(n => n.type === 'function')

  // Each module imports 8-15 functions
  for (const mod of moduleNodes) {
    const count = 8 + Math.floor(Math.random() * 8)
    const targets = functionNodes.sort(() => Math.random() - 0.5).slice(0, count)
    for (const t of targets) addEdge(mod.id, t.id, 'imports')
  }

  // Each class calls 4-10 functions (methods)
  for (const cls of classNodes) {
    const count = 4 + Math.floor(Math.random() * 7)
    const targets = functionNodes.sort(() => Math.random() - 0.5).slice(0, count)
    for (const t of targets) addEdge(cls.id, t.id, 'calls')
  }

  // Function→function calls within same cluster (builds dense clusters)
  for (const [, ids] of clusters) {
    const clusterFns = ids.filter(id => nodes[id - 1]?.type === 'function')
    for (const fnId of clusterFns) {
      const callCount = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < callCount; i++) {
        const target = pick(clusterFns)
        addEdge(fnId, target, 'calls')
      }
    }
  }

  // Cross-cluster edges (sparse coupling): ~5% of functions call across clusters
  const allClusterKeys = [...clusters.keys()]
  for (const fn of functionNodes) {
    if (Math.random() < 0.05) {
      const otherCluster = pick(allClusterKeys)
      const otherIds = clusters.get(otherCluster) ?? []
      if (otherIds.length > 0) {
        addEdge(fn.id, pick(otherIds), 'calls')
      }
    }
  }

  // Add some class→class dependencies
  for (let i = 0; i < classNodes.length; i++) {
    if (Math.random() < 0.3 && i + 1 < classNodes.length) {
      addEdge(classNodes[i].id, classNodes[i + 1].id, 'imports')
    }
  }

  return { nodes, edges }
}
