export interface StatSummary {
  repositories: number
  files: number
  functions: number
  classes: number
  dead_code_pct?: number
  avg_complexity?: number
  depth_penalty?: number
}

export interface Repo {
  name: string
  path: string
  is_dependency?: boolean
  watch?: boolean
  last_indexed_at?: string
  stats?: { files: number; functions: number; classes: number }
}

export interface GraphNode {
  id: number
  name: string
  type: string
  path?: string
  line?: number
  complexity?: number
  source?: string
  callers?: string[]
  callees?: string[]
  connections?: number
}

export interface GraphEdge {
  id: number
  source: number
  target: number
  kind: string
}

export interface GraphPayload {
  nodes: GraphNode[]
  edges: GraphEdge[]
  total?: number
  truncated?: boolean
}

export interface SearchResult {
  id?: number
  name: string
  path?: string
  line_number?: number
  source?: string
  search_type?: string
  complexity?: number
}

export interface IndexJob {
  id: string
  status: string
  progress: number
  metadata?: Record<string, unknown>
  start_time?: string
}

export interface MCPStatus {
  running: boolean
  port: number
  clients: number
  tools: number
}
