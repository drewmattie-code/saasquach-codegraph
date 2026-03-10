import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: api.stats })
export const useRepos = () => useQuery({ queryKey: ['repos'], queryFn: api.repos })
export const useGraph = (limit = 500) => useQuery({ queryKey: ['graph', limit], queryFn: () => api.graph(limit) })
export const useMcpStatus = () => useQuery({ queryKey: ['mcp'], queryFn: api.mcpStatus, refetchInterval: 3000 })
