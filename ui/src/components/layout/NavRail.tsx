import { motion } from 'framer-motion'
import { ChartLineUp, Graph, GitBranch, Warning, Lightbulb, Gear, Folder, Lightning } from '@phosphor-icons/react'
import { NavLink } from 'react-router-dom'
import { useState } from 'react'

const items = [
  ['/', 'Overview', ChartLineUp, 'var(--accent-graph)'],
  ['/repositories', 'Repositories', Folder, 'var(--accent-health)'],
  ['/graph', 'Graph', Graph, 'var(--accent-graph)'],
  ['/changes', 'Changes', GitBranch, 'var(--accent-change)'],
  ['/pipelines', 'Pipelines', Lightning, 'var(--accent-flow)'],
  ['/insights', 'Insights', Lightbulb, 'var(--accent-insight)'],
  ['/risks', 'Risks', Warning, 'var(--accent-risk)'],
  ['/settings', 'Settings', Gear, 'var(--text-tertiary)'],
] as const

export function NavRail() {
  const [open, setOpen] = useState(false)
  return (
    <motion.aside onHoverStart={() => setOpen(true)} onHoverEnd={() => setOpen(false)} animate={{ width: open ? 240 : 64 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }} className='border-r border-[var(--border-subtle)] bg-[var(--bg-raised)]/80 p-2'>
      <div className='space-y-1'>
        {items.map(([to, label, Icon, color]) => (
          <NavLink key={to} to={to} className='group flex h-11 items-center gap-3 rounded-lg px-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'>
            {({ isActive }) => (
              <>
                <span className='h-6 w-1 rounded-full' style={{ background: isActive ? color : 'transparent' }} />
                <Icon size={18} weight='duotone' />
                {open && <span className='text-sm'>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </motion.aside>
  )
}
