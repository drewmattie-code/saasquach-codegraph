import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { NavRail } from './NavRail'
import { CommandBar } from './CommandBar'
import { CommandPalette } from '@/components/CommandPalette'

export function Shell() {
  const [palette, setPalette] = useState(false)
  const location = useLocation()

  // Global Cmd+K / Ctrl+K shortcut to toggle the command palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPalette((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="noise flex min-h-screen bg-[var(--bg-base)]">
      <NavRail />
      <main className="flex min-w-0 flex-1 flex-col">
        <CommandBar onOpen={() => setPalette(true)} />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="min-h-0 flex-1 overflow-auto"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
