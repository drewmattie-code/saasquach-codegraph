import { motion } from 'framer-motion'
import { ChartLineUp, Graph, GitBranch, Warning, Lightbulb, Gear, Folder, Lightning, CaretUpDown } from '@phosphor-icons/react'
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
    <motion.aside onHoverStart={() => setOpen(true)} onHoverEnd={() => setOpen(false)} animate={{ width: open ? 240 : 64 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }} className='flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-raised)]/80 p-2'>
      <div className='flex-1 space-y-1'>
        {items.map(([to, label, Icon, color]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex h-11 items-center gap-3 rounded-lg px-2 transition-colors duration-150 ${isActive ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'}`
            }
          >
            {({ isActive }) => (
              <>
                <motion.span
                  className='rounded-full'
                  animate={{ width: isActive ? 3 : 0, height: 20, background: isActive ? color : 'transparent' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                />
                <Icon size={20} weight='duotone' />
                {open && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='text-sm whitespace-nowrap'>{label}</motion.span>}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Org switcher + user avatar */}
      <div className='border-t border-[var(--border-subtle)] pt-2'>
        <div className='flex h-11 items-center gap-3 rounded-lg px-2 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors'>
          <div className='grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-[var(--text-inverse)]' style={{ background: 'linear-gradient(135deg, var(--accent-graph), var(--accent-flow))' }}>
            DM
          </div>
          {open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='flex min-w-0 flex-1 items-center justify-between'>
              <div className='min-w-0'>
                <div className='truncate text-sm text-[var(--text-primary)]'>Drew Mattie</div>
                <div className='truncate text-[10px] text-[var(--text-tertiary)]'>Charles & Roe</div>
              </div>
              <CaretUpDown size={14} className='shrink-0 text-[var(--text-tertiary)]' />
            </motion.div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
