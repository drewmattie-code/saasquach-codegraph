// Procedural graph generation — realistic codebase topology for demo mode
// Produces ~2500 nodes in 5 weighted clusters with ~4200 edges (nebula layout)

// ── Seeded PRNG for deterministic generation ──────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let _rand = Math.random

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(_rand() * arr.length)]
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => _rand() - 0.5)
  return shuffled.slice(0, n)
}

// ── Node type colors ──────────────────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  function: '#00d4aa',
  class: '#e040fb',
  module: '#ff9100',
  interface: '#a371f7',
  variable: '#76ff03',
  import: '#2979ff',
}

// ── Name pools ────────────────────────────────────────────────────────────────

const FUNCTION_NAMES = [
  // parsing & AST
  'parse_document', 'tokenize_input', 'lex_source', 'build_ast', 'walk_tree',
  'extract_symbols', 'resolve_imports', 'analyze_scope', 'visit_node', 'transform_ast',
  'collapse_whitespace', 'strip_comments', 'normalize_text', 'detect_encoding', 'decode_utf8',
  // search & retrieval
  'fetch_search_results', 'rank_documents', 'build_index', 'query_index', 'score_relevance',
  'filter_duplicates', 'merge_results', 'paginate_response', 'highlight_matches', 'expand_query',
  'fuzzy_match', 'exact_search', 'semantic_search', 'vector_lookup', 'rerank_candidates',
  // embeddings & ML
  'create_embedding', 'batch_embed', 'compute_similarity', 'cluster_vectors', 'reduce_dimensions',
  'normalize_vector', 'quantize_weights', 'load_model', 'infer_batch', 'warmup_model',
  'train_classifier', 'evaluate_model', 'export_onnx', 'calibrate_threshold', 'split_dataset',
  // chunking & processing
  'process_chunk', 'split_document', 'merge_chunks', 'overlap_windows', 'estimate_tokens',
  'truncate_context', 'pad_sequence', 'encode_tokens', 'decode_tokens', 'count_tokens',
  'compress_payload', 'decompress_stream', 'hash_content', 'fingerprint_doc', 'deduplicate_chunks',
  // crawling & ingestion
  'crawl_url', 'fetch_page', 'extract_links', 'follow_redirect', 'parse_robots_txt',
  'rate_limit_request', 'retry_fetch', 'cache_response', 'validate_url', 'normalize_url',
  'scrape_metadata', 'extract_title', 'detect_language', 'clean_html', 'convert_to_markdown',
  // database & storage
  'execute_query', 'prepare_statement', 'begin_transaction', 'commit_transaction', 'rollback_transaction',
  'migrate_schema', 'seed_database', 'create_index', 'drop_table', 'vacuum_database',
  'insert_record', 'update_record', 'delete_record', 'upsert_batch', 'bulk_insert',
  // auth & crypto
  'authenticate_user', 'authorize_request', 'validate_token', 'refresh_session', 'revoke_access',
  'hash_password', 'verify_password', 'generate_salt', 'derive_key', 'encrypt_field',
  'decrypt_payload', 'sign_message', 'verify_signature', 'rotate_keys', 'generate_otp',
  // API & HTTP
  'handle_request', 'parse_headers', 'validate_body', 'serialize_response', 'send_error',
  'apply_middleware', 'cors_preflight', 'compress_response', 'log_request', 'measure_latency',
  'throttle_client', 'check_rate_limit', 'resolve_route', 'dispatch_handler', 'stream_response',
  // events & messaging
  'emit_event', 'subscribe_topic', 'publish_message', 'consume_queue', 'acknowledge_message',
  'retry_delivery', 'dead_letter', 'fan_out', 'aggregate_events', 'replay_stream',
  'debounce_handler', 'throttle_callback', 'schedule_task', 'cancel_task', 'poll_status',
  // config & env
  'load_config', 'parse_env', 'validate_config', 'merge_defaults', 'resolve_path',
  'read_secrets', 'watch_config', 'reload_settings', 'feature_flag', 'toggle_experiment',
  // monitoring & logging
  'log_info', 'log_warning', 'log_error', 'flush_logs', 'rotate_log_file',
  'record_metric', 'increment_counter', 'observe_histogram', 'set_gauge', 'export_metrics',
  'check_health', 'ping_dependency', 'report_status', 'alert_threshold', 'page_oncall',
  // file & IO
  'read_file', 'write_file', 'append_log', 'delete_temp', 'create_directory',
  'list_directory', 'watch_filesystem', 'compute_checksum', 'copy_file', 'move_file',
  'open_stream', 'close_stream', 'flush_buffer', 'seek_position', 'read_chunk',
  // graph & topology
  'build_graph', 'find_shortest_path', 'detect_cycles', 'topological_sort', 'compute_centrality',
  'find_connected_components', 'merge_subgraphs', 'prune_orphans', 'layout_force_directed', 'cluster_louvain',
  // caching
  'get_cached', 'set_cached', 'invalidate_cache', 'warm_cache', 'evict_lru',
  'compute_cache_key', 'serialize_cache_entry', 'deserialize_cache_entry', 'check_ttl', 'refresh_cache',
  // validation & sanitization
  'validate_input', 'sanitize_html', 'escape_sql', 'check_schema', 'coerce_type',
  'assert_non_null', 'clamp_range', 'validate_email', 'validate_uuid', 'normalize_phone',
  // formatting & rendering
  'render_template', 'format_date', 'format_currency', 'interpolate_string', 'compile_template',
  'generate_pdf', 'render_markdown', 'syntax_highlight', 'wrap_lines', 'indent_block',
  // deployment & infra
  'deploy_service', 'rollback_deploy', 'scale_replicas', 'drain_node', 'cordon_node',
  'create_namespace', 'apply_manifest', 'check_pod_status', 'tail_logs', 'port_forward',
  'build_image', 'push_registry', 'tag_release', 'run_migrations', 'smoke_test',
]

const CLASS_NAMES = [
  // core services
  'DocumentProcessor', 'SearchEngine', 'EmbeddingService', 'CrawlerManager', 'IndexBuilder',
  'VectorStore', 'ChunkSplitter', 'TokenCounter', 'QueryPlanner', 'ResultAggregator',
  // data layer
  'DatabasePool', 'MigrationRunner', 'SchemaValidator', 'RecordMapper', 'TransactionManager',
  'CacheStore', 'SessionRepository', 'AuditLogger', 'EventStore', 'SnapshotManager',
  // API & networking
  'HttpClient', 'WebSocketServer', 'GrpcService', 'RequestHandler', 'ResponseSerializer',
  'RateLimiter', 'CircuitBreaker', 'RetryPolicy', 'LoadBalancer', 'ConnectionPool',
  // auth
  'AuthProvider', 'TokenValidator', 'PermissionChecker', 'SessionManager', 'OAuthClient',
  'KeyRotator', 'PasswordHasher', 'TwoFactorAuth', 'ApiKeyManager', 'RoleResolver',
  // ML / AI
  'ModelRegistry', 'InferenceEngine', 'FeatureExtractor', 'PipelineOrchestrator', 'DatasetLoader',
  'TrainingLoop', 'HyperparameterTuner', 'MetricTracker', 'ExperimentLogger', 'ModelExporter',
  // infra
  'ConfigLoader', 'SecretManager', 'ServiceDiscovery', 'HealthChecker', 'MetricsExporter',
  'LogAggregator', 'AlertRouter', 'TaskScheduler', 'WorkerPool', 'QueueConsumer',
  // UI / rendering
  'TemplateEngine', 'ThemeManager', 'ComponentRegistry', 'StateController', 'RouterDispatcher',
  'FormValidator', 'NotificationCenter', 'ModalManager', 'ToastQueue', 'AnimationController',
]

const MODULE_NAMES = [
  'parser', 'embeddings', 'search', 'crawler', 'config', 'auth', 'crypto', 'storage',
  'cache', 'queue', 'events', 'logging', 'metrics', 'health', 'middleware', 'routes',
  'models', 'schemas', 'validators', 'serializers', 'transforms', 'adapters', 'connectors',
  'drivers', 'plugins', 'hooks', 'workers', 'schedulers', 'migrations', 'seeds',
  'fixtures', 'factories', 'utils', 'helpers', 'constants', 'types', 'errors', 'exceptions',
  'signals', 'streams', 'buffers', 'protocols', 'handlers', 'dispatchers', 'resolvers',
  'providers', 'services', 'controllers', 'repositories', 'gateways', 'interceptors',
]

const INTERFACE_NAMES = [
  'ISearchResult', 'IDocumentChunk', 'IEmbeddingVector', 'ICrawlTarget', 'IIndexEntry',
  'IQueryPlan', 'IRankScore', 'IFilterPredicate', 'ISortOrder', 'IPaginatedResponse',
  'IDatabaseConfig', 'IConnectionOptions', 'IMigrationStep', 'ISchemaDefinition', 'IRecordMeta',
  'IHttpRequest', 'IHttpResponse', 'IWebSocketMessage', 'IGrpcMethod', 'IRouteDefinition',
  'IAuthToken', 'IUserSession', 'IPermissionGrant', 'IOAuthConfig', 'IApiKey',
  'IModelConfig', 'IInferenceResult', 'ITrainingMetrics', 'IFeatureVector', 'IDatasetSplit',
  'IConfigEntry', 'ISecretRef', 'IServiceEndpoint', 'IHealthStatus', 'IMetricSample',
  'ILogEntry', 'IAlertRule', 'ITaskPayload', 'IWorkerStatus', 'IQueueMessage',
  'IThemeConfig', 'IComponentProps', 'IFormField', 'INotification', 'IAnimationState',
  'ICachePolicy', 'IRetryConfig', 'ICircuitState', 'IRateLimitRule', 'ILoadBalancerConfig',
]

const VARIABLE_NAMES = [
  'searchIndex', 'modelConfig', 'activeConnections', 'requestQueue', 'responseCache',
  'tokenBucket', 'embeddingDim', 'maxRetries', 'batchSize', 'chunkOverlap',
  'crawlDepth', 'rateLimitWindow', 'sessionTimeout', 'cacheExpiry', 'poolSize',
  'workerCount', 'queueCapacity', 'logLevel', 'metricInterval', 'healthTimeout',
  'schemaVersion', 'migrationLock', 'featureFlags', 'experimentConfig', 'defaultLocale',
  'currentTheme', 'routeTable', 'middlewareStack', 'pluginRegistry', 'hookMap',
  'errorBuffer', 'retryBackoff', 'circuitThreshold', 'loadFactor', 'connectionLimit',
  'bufferCapacity', 'streamPosition', 'eventCounter', 'taskPriority', 'snapshotInterval',
  'authSecret', 'jwtExpiry', 'otpWindow', 'saltRounds', 'keyLength',
  'indexVersion', 'queryTimeout', 'resultLimit', 'filterChain', 'sortComparator',
]

const IMPORT_NAMES = [
  '@surfsense/core', '@surfsense/search', '@surfsense/embeddings', '@surfsense/crawler',
  '@surfsense/ui', '@surfsense/config', '@surfsense/auth', '@surfsense/db',
  'langchain/embeddings', 'langchain/text_splitter', 'langchain/document_loaders', 'langchain/vectorstores',
  'langchain/llms', 'langchain/chains', 'langchain/memory', 'langchain/callbacks',
  'fastapi', 'fastapi/middleware', 'fastapi/security', 'fastapi/websockets',
  'pydantic', 'pydantic/settings', 'sqlalchemy', 'sqlalchemy/orm',
  'alembic', 'alembic/operations', 'celery', 'celery/schedules',
  'redis', 'redis/sentinel', 'elasticsearch', 'elasticsearch/helpers',
  'react', 'react-dom', 'react-router', 'react-query',
  'next', 'next/server', 'next/image', 'next/link',
  'tailwindcss', 'tailwindcss/plugin', 'postcss', 'autoprefixer',
  'docker', 'docker/compose', 'kubernetes', 'kubernetes/client',
  'pytest', 'pytest/fixtures', 'httpx', 'httpx/transports',
  'numpy', 'pandas', 'scipy', 'scikit-learn',
  'torch', 'torch/nn', 'transformers', 'tokenizers',
  'openai', 'anthropic', 'tiktoken', 'sentence-transformers',
]

// ── Directory structure (realistic monorepo) ──────────────────────────────────

const DIRS_BY_CLUSTER: Record<number, readonly string[]> = {
  0: [ // core
    'surfsense_backend/app/core',
    'surfsense_backend/app/services',
    'surfsense_backend/app/models',
    'surfsense_backend/app/schemas',
    'surfsense_backend/app/api',
    'surfsense_backend/app/db',
    'surfsense_backend/app/utils',
    'surfsense_backend/app/tasks',
    'surfsense_backend/app/ml',
    'surfsense_backend/app/embeddings',
    'surfsense_backend/app/search',
    'surfsense_backend/app/crawler',
    'surfsense_backend/alembic/versions',
    'surfsense_backend/alembic/env',
  ],
  1: [ // frontend
    'surfsense_web/app/components',
    'surfsense_web/app/hooks',
    'surfsense_web/app/lib',
    'surfsense_web/app/pages',
    'surfsense_web/app/stores',
    'surfsense_web/app/styles',
    'surfsense_web/app/utils',
    'surfsense_web/app/api',
    'surfsense_web/app/types',
    'surfsense_web/app/providers',
  ],
  2: [ // infrastructure
    'docker/services',
    'docker/compose',
    'scripts/deploy',
    'scripts/ci',
    'scripts/db',
    'scripts/setup',
    'docs/architecture',
    'docs/api',
    'docs/guides',
  ],
  3: [ // integrations
    'surfsense_browser_extension/background',
    'surfsense_browser_extension/lib',
    'surfsense_browser_extension/popup',
    'surfsense_browser_extension/content',
    'surfsense_browser_extension/options',
    'surfsense_browser_extension/utils',
    'surfsense_browser_extension/api',
    'surfsense_browser_extension/storage',
  ],
  4: [ // utilities
    'scripts/utils',
    'scripts/tools',
    'scripts/benchmarks',
    'scripts/migrations',
    'scripts/generators',
    'docs/internal',
  ],
}

const CLUSTER_NAMES = ['core', 'frontend', 'infrastructure', 'integrations', 'utilities'] as const

const CLUSTER_WEIGHTS = [0.40, 0.20, 0.15, 0.15, 0.10]

const EDGE_KINDS = ['calls', 'imports', 'implements', 'extends', 'uses', 'references'] as const

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface GeneratedNode {
  id: number
  name: string
  type: string
  path: string
  line_number: number
  color: string
}

export interface GeneratedEdge {
  source: number
  target: number
  kind: string
  edgeColor: string
}

export interface GeneratedGraph {
  nodes: GeneratedNode[]
  edges: GeneratedEdge[]
}

// ── Unique name generator ─────────────────────────────────────────────────────

function makeUniqueName(pool: readonly string[], index: number): string {
  if (index < pool.length) return pool[index]
  const base = pool[index % pool.length]
  const suffix = Math.floor(index / pool.length)
  return `${base}_${suffix}`
}

function makeUniqueClassName(pool: readonly string[], index: number): string {
  if (index < pool.length) return pool[index]
  const base = pool[index % pool.length]
  const suffix = Math.floor(index / pool.length)
  return `${base}${suffix}`
}

// ── Path generation ───────────────────────────────────────────────────────────

function pathForNode(name: string, type: string, cluster: number): string {
  const dir = pick(DIRS_BY_CLUSTER[cluster])
  switch (type) {
    case 'function':
      return `${dir}/${name.split('_').slice(0, 2).join('_')}.py`
    case 'class':
      return `${dir}/${name.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1)}.py`
    case 'module':
      return `${dir}/${name}/__init__.py`
    case 'interface':
      return `${dir}/${name.replace(/^I/, '').replace(/([A-Z])/g, '_$1').toLowerCase().slice(1)}.ts`
    case 'variable':
      return `${dir}/${name.replace(/([A-Z])/g, '_$1').toLowerCase()}.ts`
    case 'import':
      return `${dir}/deps.ts`
    default:
      return `${dir}/${name}.py`
  }
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generateMockGraph(
  nodeCount = 2500,
  seed = 42,
): GeneratedGraph {
  _rand = mulberry32(seed)

  // ── Compute per-type counts ───────────────────────────────────────────────
  const typeDist: { type: string; ratio: number }[] = [
    { type: 'function', ratio: 0.56 },
    { type: 'class', ratio: 0.08 },
    { type: 'module', ratio: 0.12 },
    { type: 'interface', ratio: 0.10 },
    { type: 'variable', ratio: 0.08 },
    { type: 'import', ratio: 0.06 },
  ]

  const typeCounts: Record<string, number> = {}
  let allocated = 0
  for (let i = 0; i < typeDist.length; i++) {
    const count = i === typeDist.length - 1
      ? nodeCount - allocated
      : Math.round(nodeCount * typeDist[i].ratio)
    typeCounts[typeDist[i].type] = count
    allocated += count
  }

  // ── Compute per-cluster counts ────────────────────────────────────────────
  const clusterCounts: number[] = []
  let clusterAllocated = 0
  for (let c = 0; c < CLUSTER_WEIGHTS.length; c++) {
    const count = c === CLUSTER_WEIGHTS.length - 1
      ? nodeCount - clusterAllocated
      : Math.round(nodeCount * CLUSTER_WEIGHTS[c])
    clusterCounts.push(count)
    clusterAllocated += count
  }

  // ── Name pools per type ───────────────────────────────────────────────────
  const namePoolForType: Record<string, readonly string[]> = {
    function: FUNCTION_NAMES,
    class: CLASS_NAMES,
    module: MODULE_NAMES,
    interface: INTERFACE_NAMES,
    variable: VARIABLE_NAMES,
    import: IMPORT_NAMES,
  }

  const nameCounterForType: Record<string, number> = {
    function: 0, class: 0, module: 0, interface: 0, variable: 0, import: 0,
  }

  // ── Create nodes ──────────────────────────────────────────────────────────
  const nodes: GeneratedNode[] = []
  const clusterAssignment: number[] = [] // index by node array index
  let nextId = 1

  // For each cluster, assign a proportional mix of node types
  for (let c = 0; c < clusterCounts.length; c++) {
    const clusterSize = clusterCounts[c]
    // Distribute types within this cluster proportionally
    const typeOrder = typeDist.map(t => t.type)
    const typeRatios = typeDist.map(t => t.ratio)
    const localCounts: number[] = []
    let localAllocated = 0
    for (let t = 0; t < typeOrder.length; t++) {
      const count = t === typeOrder.length - 1
        ? clusterSize - localAllocated
        : Math.round(clusterSize * typeRatios[t])
      localCounts.push(count)
      localAllocated += count
    }

    for (let t = 0; t < typeOrder.length; t++) {
      const nodeType = typeOrder[t]
      const pool = namePoolForType[nodeType]
      for (let i = 0; i < localCounts[t]; i++) {
        const nameIdx = nameCounterForType[nodeType]++
        const name = nodeType === 'class' || nodeType === 'interface'
          ? makeUniqueClassName(pool, nameIdx)
          : makeUniqueName(pool, nameIdx)
        const color = NODE_COLORS[nodeType]
        nodes.push({
          id: nextId++,
          name,
          type: nodeType,
          path: pathForNode(name, nodeType, c),
          line_number: nodeType === 'module' ? 1 : Math.floor(_rand() * 800) + 1,
          color,
        })
        clusterAssignment.push(c)
      }
    }
  }

  // ── Build cluster index ───────────────────────────────────────────────────
  const clusterNodeIndices: number[][] = Array.from({ length: 5 }, () => [])
  for (let i = 0; i < nodes.length; i++) {
    clusterNodeIndices[clusterAssignment[i]].push(i)
  }

  // Indices by type within each cluster
  const clusterTypeIndices: Record<string, number[]>[] = Array.from({ length: 5 }, () => ({
    function: [], class: [], module: [], interface: [], variable: [], import: [],
  }))
  for (let i = 0; i < nodes.length; i++) {
    clusterTypeIndices[clusterAssignment[i]][nodes[i].type].push(i)
  }

  // ── Identify hub nodes (~2% = ~50 for 2500) ──────────────────────────────
  const hubCount = Math.max(10, Math.round(nodeCount * 0.02))
  // Prefer classes and modules as hubs
  const hubCandidates: number[] = []
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].type === 'class' || nodes[i].type === 'module') {
      hubCandidates.push(i)
    }
  }
  // Shuffle and pick; if not enough classes/modules, pad with functions
  const shuffledHubCandidates = [...hubCandidates].sort(() => _rand() - 0.5)
  const hubSet = new Set<number>()
  for (const idx of shuffledHubCandidates) {
    if (hubSet.size >= hubCount) break
    hubSet.add(idx)
  }
  if (hubSet.size < hubCount) {
    for (let i = 0; i < nodes.length && hubSet.size < hubCount; i++) {
      if (!hubSet.has(i)) hubSet.add(i)
    }
  }
  const hubIndices = [...hubSet]

  // ── Edge generation ───────────────────────────────────────────────────────
  const edges: GeneratedEdge[] = []
  const edgeSet = new Set<string>()

  function addEdge(sourceIdx: number, targetIdx: number, kind: string): boolean {
    const s = nodes[sourceIdx].id
    const t = nodes[targetIdx].id
    if (s === t) return false
    const key = `${s}-${t}`
    if (edgeSet.has(key)) return false
    edgeSet.add(key)
    edges.push({
      source: s,
      target: t,
      kind,
      edgeColor: nodes[sourceIdx].color,
    })
    return true
  }

  // Target ~4200 edges total: 70% intra-cluster (~2940), 30% inter-cluster (~1260)
  const targetEdges = Math.round(nodeCount * 1.68)
  const targetIntra = Math.round(targetEdges * 0.70)
  const targetInter = targetEdges - targetIntra

  // ── Hub connections (20-60 edges each) ────────────────────────────────────
  for (const hubIdx of hubIndices) {
    const hubCluster = clusterAssignment[hubIdx]
    const connectionCount = 20 + Math.floor(_rand() * 41)
    const intraCount = Math.round(connectionCount * 0.7)
    const interCount = connectionCount - intraCount

    // Intra-cluster connections
    const clusterMembers = clusterNodeIndices[hubCluster]
    for (let i = 0; i < intraCount; i++) {
      const targetIdx = clusterMembers[Math.floor(_rand() * clusterMembers.length)]
      addEdge(hubIdx, targetIdx, pick(EDGE_KINDS))
    }

    // Inter-cluster connections (bridges)
    for (let i = 0; i < interCount; i++) {
      let otherCluster = Math.floor(_rand() * 5)
      if (otherCluster === hubCluster) otherCluster = (otherCluster + 1) % 5
      const otherMembers = clusterNodeIndices[otherCluster]
      const targetIdx = otherMembers[Math.floor(_rand() * otherMembers.length)]
      addEdge(hubIdx, targetIdx, pick(EDGE_KINDS))
    }
  }

  // ── Structural intra-cluster edges ────────────────────────────────────────
  for (let c = 0; c < 5; c++) {
    const ci = clusterTypeIndices[c]

    // Modules import functions (each module -> 5-12 functions)
    for (const modIdx of ci.module) {
      const count = 5 + Math.floor(_rand() * 8)
      const targets = ci.function.length > 0
        ? pickN(ci.function, Math.min(count, ci.function.length))
        : []
      for (const t of targets) addEdge(modIdx, t, 'imports')
    }

    // Classes call/use functions (each class -> 3-8 functions)
    for (const clsIdx of ci.class) {
      const count = 3 + Math.floor(_rand() * 6)
      const targets = ci.function.length > 0
        ? pickN(ci.function, Math.min(count, ci.function.length))
        : []
      for (const t of targets) addEdge(clsIdx, t, 'calls')
    }

    // Classes implement interfaces
    for (const clsIdx of ci.class) {
      if (ci.interface.length > 0 && _rand() < 0.5) {
        const ifaceIdx = ci.interface[Math.floor(_rand() * ci.interface.length)]
        addEdge(clsIdx, ifaceIdx, 'implements')
      }
    }

    // Classes extend other classes
    for (let i = 1; i < ci.class.length; i++) {
      if (_rand() < 0.25) {
        addEdge(ci.class[i], ci.class[i - 1], 'extends')
      }
    }

    // Interfaces extend other interfaces
    for (let i = 1; i < ci.interface.length; i++) {
      if (_rand() < 0.2) {
        addEdge(ci.interface[i], ci.interface[i - 1], 'extends')
      }
    }

    // Modules reference variables
    for (const modIdx of ci.module) {
      const count = 1 + Math.floor(_rand() * 3)
      const targets = ci.variable.length > 0
        ? pickN(ci.variable, Math.min(count, ci.variable.length))
        : []
      for (const t of targets) addEdge(modIdx, t, 'references')
    }

    // Imports are used by modules and classes
    for (const impIdx of ci.import) {
      const users = [...ci.module, ...ci.class]
      if (users.length > 0) {
        const count = 2 + Math.floor(_rand() * 4)
        const targets = pickN(users, Math.min(count, users.length))
        for (const t of targets) addEdge(t, impIdx, 'imports')
      }
    }

    // Function -> function calls within cluster (dense mesh)
    for (const fnIdx of ci.function) {
      const callCount = 1 + Math.floor(_rand() * 3)
      for (let i = 0; i < callCount; i++) {
        if (ci.function.length > 1) {
          const targetIdx = ci.function[Math.floor(_rand() * ci.function.length)]
          addEdge(fnIdx, targetIdx, 'calls')
        }
      }
    }

    // Variables referenced by functions
    for (const varIdx of ci.variable) {
      const count = 1 + Math.floor(_rand() * 4)
      const targets = ci.function.length > 0
        ? pickN(ci.function, Math.min(count, ci.function.length))
        : []
      for (const t of targets) addEdge(t, varIdx, 'uses')
    }
  }

  // ── Fill remaining intra-cluster edges ────────────────────────────────────
  let attempts = 0
  while (edges.length < targetIntra && attempts < targetIntra * 3) {
    attempts++
    const c = Math.floor(_rand() * 5)
    const members = clusterNodeIndices[c]
    if (members.length < 2) continue
    const srcIdx = members[Math.floor(_rand() * members.length)]
    const tgtIdx = members[Math.floor(_rand() * members.length)]
    addEdge(srcIdx, tgtIdx, pick(EDGE_KINDS))
  }

  // ── Inter-cluster bridges ─────────────────────────────────────────────────
  attempts = 0
  const currentInter = edges.length - edgeSet.size // approximate, not exact
  while (edges.length < targetEdges && attempts < targetInter * 3) {
    attempts++
    const c1 = Math.floor(_rand() * 5)
    let c2 = Math.floor(_rand() * 5)
    if (c2 === c1) c2 = (c2 + 1) % 5
    const members1 = clusterNodeIndices[c1]
    const members2 = clusterNodeIndices[c2]
    if (members1.length === 0 || members2.length === 0) continue
    const srcIdx = members1[Math.floor(_rand() * members1.length)]
    const tgtIdx = members2[Math.floor(_rand() * members2.length)]
    addEdge(srcIdx, tgtIdx, pick(EDGE_KINDS))
  }

  // ── Ensure no orphans (every node has at least 1 edge) ────────────────────
  const connectedNodes = new Set<number>()
  for (const e of edges) {
    connectedNodes.add(e.source)
    connectedNodes.add(e.target)
  }
  for (const n of nodes) {
    if (!connectedNodes.has(n.id)) {
      // Connect orphan to a random node in same cluster
      const nodeIdx = n.id - 1
      const c = clusterAssignment[nodeIdx]
      const members = clusterNodeIndices[c]
      const targetIdx = members[Math.floor(_rand() * members.length)]
      if (targetIdx !== nodeIdx) {
        addEdge(nodeIdx, targetIdx, pick(EDGE_KINDS))
      }
    }
  }

  return { nodes, edges }
}
