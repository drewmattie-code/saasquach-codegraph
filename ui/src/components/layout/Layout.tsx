import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Bot, GitBranch, Home, Search, Settings, Share2 } from 'lucide-react'
import { useMcpStatus } from '../../hooks/useData'

const nav = [
  ['/', 'Dashboard', Home],
  ['/graph', 'Graph Explorer', Share2],
  ['/search', 'Code Search', Search],
  ['/analysis', 'Analysis', BarChart3],
  ['/repositories', 'Repositories', GitBranch],
  ['/ai-hub', 'AI Hub', Bot],
  ['/settings', 'Settings', Settings],
] as const

export function Layout() {
  const { data } = useMcpStatus()
  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-[#f0f0f5]">
      <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-[#2a2a3a] bg-[#12121a] p-4">
        <h1 className="mb-6 text-lg font-semibold">SaaSquach CodeGraph</h1>
        <nav className="flex-1 space-y-1">
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg border-l-2 px-3 py-2 text-sm transition duration-150 ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200'
                    : 'border-transparent text-[#8888aa] hover:bg-[#1a1a26] hover:text-[#e4e4ef]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-lg border border-[#2a2a3a] p-3 text-xs text-[#8888aa]">
          <span className={`pulse-dot mr-2 inline-block h-2 w-2 rounded-full ${data?.running ? 'bg-emerald-400' : 'bg-gray-500'}`} />
          MCP {data?.running ? 'Running' : 'Stopped'}
        </div>
      </aside>
      <main className="ml-60 w-[calc(100%-15rem)] p-6">
        <div className="animate-in fade-in duration-150">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
