import { MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export function CommandBar({ onOpen }: { onOpen: () => void }) {
  return (
    <header className='flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-raised)]/70 px-6 py-3 backdrop-blur-xl'>
      <div className='text-xs text-[var(--text-tertiary)]'>Acme Org / Platform / All Repos / main</div>
      <Button onClick={onOpen} className='w-[460px] border-[var(--border-default)] bg-[var(--bg-base)] text-left text-[var(--text-secondary)]'>
        <span className='flex items-center gap-2'><MagnifyingGlass size={14} /> Search repos, files, contributors... <span className='ml-auto text-[10px]'>⌘K</span></span>
      </Button>
      <div className='text-xs text-[var(--text-secondary)]'>11:00 EDT</div>
    </header>
  )
}
