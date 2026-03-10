import { MagnifyingGlass } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NotificationBell, NotificationsPanel } from '@/components/NotificationsPanel'

export function CommandBar({ onOpen }: { onOpen: () => void }) {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
  )
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }))
    }, 30000)

    return () => clearInterval(id)
  }, [])
  return (
    <header className='flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-raised)]/70 px-6 py-3 backdrop-blur-xl'>
      <div className='text-xs text-[var(--text-tertiary)]'>Acme Org / Platform / All Repos / main</div>
      <Button onClick={onOpen} className='w-[460px] border-[var(--border-default)] bg-[var(--bg-base)] text-left text-[var(--text-secondary)]'>
        <span className='flex items-center gap-2'><MagnifyingGlass size={14} /> Search repos, files, contributors... <span className='ml-auto text-[10px]'>⌘K</span></span>
      </Button>
      <div className='flex items-center gap-3'>
        <NotificationBell onClick={() => setNotifOpen(v => !v)} unreadCount={3} />
        <div className='text-xs text-[var(--text-secondary)]'>{time}</div>
      </div>
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </header>
  )
}
