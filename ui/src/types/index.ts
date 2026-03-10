export interface StatSummary { repositories: number; files: number; functions: number; classes: number }
export interface Repo { name: string; path: string; is_dependency?: boolean; stats?: { files: number; functions: number; classes: number } }
export interface GraphNode { id: number; name: string; type: string; path?: string; line?: number }
export interface GraphEdge { id: number; source: number; target: number; kind: string }
export interface SearchResult { name: string; path?: string; line_number?: number; source?: string; search_type?: string }
