import { AnimatePresence, motion } from 'framer-motion'

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && <motion.div className='fixed inset-0 z-50 grid place-items-start bg-black/40 pt-20 backdrop-blur-lg' initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -8 }} className='w-[640px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-3' onClick={(e) => e.stopPropagation()}>
          <input autoFocus className='focus-ring w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-3 text-[var(--text-primary)] outline-none' placeholder='Type a command or search…' />
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  )
}
