import type { GraphEdge, GraphNode, Repo, SearchResult, StatSummary } from '../types'

const API = 'http://localhost:7477'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  stats: () => get<StatSummary>('/api/stats'),
  repos: () => get<Repo[]>('/api/repos'),
  graph: () => get<{ nodes: GraphNode[]; edges: GraphEdge[] }>('/api/graph?limit=500'),
  search: (q: string) => get<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
  deadCode: () => get<{ potentially_unused_functions: SearchResult[] }>('/api/analysis/dead-code'),
  complexity: () => get<Array<{ function_name: string; complexity: number; path: string }>>('/api/analysis/complexity'),
  mcpStatus: () => get<{ running: boolean; port: number; clients: number; tools: number }>('/api/mcp/status'),
}
