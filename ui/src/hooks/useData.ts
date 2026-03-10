import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: api.stats })
export const useRepos = () => useQuery({ queryKey: ['repos'], queryFn: api.repos })
export const useGraph = () => useQuery({ queryKey: ['graph'], queryFn: api.graph })
export const useMcpStatus = () => useQuery({ queryKey: ['mcp'], queryFn: api.mcpStatus, refetchInterval: 3000 })
