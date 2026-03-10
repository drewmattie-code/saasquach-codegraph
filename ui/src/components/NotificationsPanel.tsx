import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, Warning, GitBranch, Lightning, Graph, X } from '@phosphor-icons/react'

interface Notification {
  id: string
  type: 'alert' | 'info' | 'success' | 'warning'
  title: string
  description: string
  time: string
  read: boolean
  icon: 'warning' | 'git' | 'pipeline' | 'graph' | 'check'
}

const ICON_MAP = {
  warning: Warning,
  git: GitBranch,
  pipeline: Lightning,
  graph: Graph,
  check: Check,
}

const TYPE_COLORS = {
  alert: 'var(--accent-risk)',
  info: 'var(--accent-flow)',
  success: 'var(--accent-health)',
  warning: 'var(--accent-insight)',
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'alert',
    title: 'High complexity detected',
    description: 'gateway.dispatch_workflow exceeded complexity threshold (score: 47)',
    time: '2m ago',
    read: false,
    icon: 'warning',
  },
  {
    id: '2',
    type: 'alert',
    title: 'Vulnerability found',
    description: 'CVE-2025-31482 in redis@4.5.1 — upgrade to 4.6.0+',
    time: '8m ago',
    read: false,
    icon: 'warning',
  },
  {
    id: '3',
    type: 'success',
    title: 'Pipeline completed',
    description: 'codegraph/core main — all 342 tests passed',
    time: '15m ago',
    read: false,
    icon: 'pipeline',
  },
  {
    id: '4',
    type: 'info',
    title: 'Graph index updated',
    description: '1,247 nodes and 3,891 edges reindexed from latest commit',
    time: '22m ago',
    read: true,
    icon: 'graph',
  },
  {
    id: '5',
    type: 'warning',
    title: 'Dead code increase',
    description: '12 new potentially unused functions detected in src/services/',
    time: '1h ago',
    read: true,
    icon: 'warning',
  },
  {
    id: '6',
    type: 'success',
    title: 'PR merged',
    description: '#247 "Refactor query optimizer" merged into main by drew',
    time: '1h ago',
    read: true,
    icon: 'git',
  },
  {
    id: '7',
    type: 'info',
    title: 'Dependency update available',
    description: 'fastapi 0.115.0 → 0.116.2 (minor, non-breaking)',
    time: '2h ago',
    read: true,
    icon: 'check',
  },
  {
    id: '8',
    type: 'alert',
    title: 'Coupling risk escalation',
    description: 'auth.token_provider cross-package references up 28% this week',
    time: '3h ago',
    read: true,
    icon: 'warning',
  },
  {
    id: '9',
    type: 'success',
    title: 'Schema migration applied',
    description: 'Migration 0042_add_symbol_index completed in 1.2s',
    time: '4h ago',
    read: true,
    icon: 'check',
  },
  {
    id: '10',
    type: 'warning',
    title: 'Review queue backlog',
    description: '6 PRs waiting > 48h for review in codegraph/analysis',
    time: '5h ago',
    read: true,
    icon: 'git',
  },
]

export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed right-6 top-14 z-50 flex w-[420px] flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] shadow-2xl"
            style={{ maxHeight: 'calc(100vh - 80px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Notifications</h2>
                {unreadCount > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: 'var(--accent-risk)',
                      color: '#fff',
                      fontFamily: 'var(--font-display)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="rounded-md px-2 py-1 text-[11px] text-[var(--accent-graph)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={onClose} className="rounded-md p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Bell size={32} className="text-[var(--text-tertiary)] mb-2" />
                  <p className="text-xs text-[var(--text-tertiary)]">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {notifications.map((n) => {
                    const IconComponent = ICON_MAP[n.icon]
                    const color = TYPE_COLORS[n.type]
                    return (
                      <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`group relative flex gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)] cursor-pointer ${!n.read ? 'bg-[var(--bg-base)]' : ''}`}
                        onClick={() => markRead(n.id)}
                      >
                        {/* Unread indicator */}
                        {!n.read && (
                          <div
                            className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                            style={{ background: color }}
                          />
                        )}

                        {/* Icon */}
                        <div
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `${color}15`, color }}
                        >
                          <IconComponent size={14} weight="bold" />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`text-xs font-medium ${!n.read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
                              style={{ fontFamily: 'var(--font-display)' }}
                            >
                              {n.title}
                            </span>
                            <span
                              className="shrink-0 text-[10px] text-[var(--text-tertiary)]"
                              style={{ fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}
                            >
                              {n.time}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)] line-clamp-2 leading-[1.4]">
                            {n.description}
                          </p>
                        </div>

                        {/* Dismiss button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(n.id) }}
                          className="absolute right-2 top-2 hidden rounded-md p-0.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] group-hover:block transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border-subtle)] px-4 py-2.5">
              <button className="w-full rounded-lg py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors">
                View all activity
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function NotificationBell({ onClick, unreadCount }: { onClick: () => void; unreadCount: number }) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
      title="Notifications"
    >
      <Bell size={18} weight={unreadCount > 0 ? 'fill' : 'regular'} />
      {unreadCount > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{
            background: 'var(--accent-risk)',
            fontFamily: 'var(--font-display)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
