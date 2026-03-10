import type { GraphPayload, MCPStatus, Repo, SearchResult, StatSummary } from '../types'

const API = 'http://localhost:7477'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  stats: () => get<StatSummary>('/api/stats'),
  repos: () => get<Repo[]>('/api/repos'),
  graph: (limit = 500) => get<GraphPayload>(`/api/graph?limit=${limit}`),
  node: (id: number) => get(`/api/graph/node/${id}`),
  search: (q: string, type = 'all') => get<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`),
  deadCode: () => get<{ potentially_unused_functions: SearchResult[] }>('/api/analysis/dead-code'),
  complexity: () => get<Array<{ function_name: string; complexity: number; path: string }>>('/api/analysis/complexity'),
  calls: (name: string) => get<Array<{ called_function_name: string }>>(`/api/analysis/calls/${encodeURIComponent(name)}`),
  callers: (name: string) => get<Array<{ caller_function_name: string }>>(`/api/analysis/callers/${encodeURIComponent(name)}`),
  chain: (fromFunction: string, toFunction: string) =>
    get<Array<{ function_name: string; order: number }>>(`/api/analysis/chain?from_function=${encodeURIComponent(fromFunction)}&to_function=${encodeURIComponent(toFunction)}`),
  dependencies: (module: string) => get<{ imports_from: string[]; imported_by: string[] }>(`/api/analysis/dependencies/${encodeURIComponent(module)}`),
  inheritance: (className: string) => get<{ parent?: string; children: string[] }>(`/api/analysis/inheritance/${encodeURIComponent(className)}`),
  mcpStatus: () => get<MCPStatus>('/api/mcp/status'),
  mcpStart: () => send('/api/mcp/start', 'POST'),
  mcpStop: () => send('/api/mcp/stop', 'POST'),
  mcpRestart: () => send('/api/mcp/restart', 'POST'),
  mcpConfig: (provider: string) => get(`/api/mcp/config/${provider}`),
  mcpTest: (provider: string) => send(`/api/mcp/test/${provider}`, 'POST'),
  indexRepo: (path: string) => send('/api/repos/index', 'POST', { path }),
  removeRepo: (name: string) => send(`/api/repos/${encodeURIComponent(name)}`, 'DELETE'),
}
