'use client'

import { Search } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/team': 'Team',
  '/intelligence': 'Intelligence',
  '/coplanner': 'Coplanner',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

function syncPillColor(syncedAt: string | null): string {
  if (!syncedAt) return 'var(--text-dim)'
  const mins = (Date.now() - new Date(syncedAt).getTime()) / 60000
  if (mins < 30) return 'var(--healthy)'
  if (mins < 60) return 'var(--attention)'
  return 'var(--critical)'
}

function syncLabel(syncedAt: string | null): string {
  if (!syncedAt) return 'Sync unknown'
  const mins = Math.floor((Date.now() - new Date(syncedAt).getTime()) / 60000)
  if (mins < 2) return 'Last sync: just now'
  if (mins < 60) return `Last sync: ${mins}m ago`
  return `Last sync: ${Math.floor(mins / 60)}h ago`
}

export function Topbar({ syncedAt }: { syncedAt?: string | null }) {
  const pathname = usePathname()
  const title = TITLES[pathname] ?? 'Meragi Intel'
  const dotColor = syncPillColor(syncedAt ?? null)

  return (
    <header id="topbar">
      <div className="page-title">{title}</div>
      <div className="search-wrap">
        <div className="search-icon">
          <Search />
        </div>
        <input
          className="search-input"
          type="text"
          placeholder="Search projects, clients, teams…"
          aria-label="Search"
        />
        <span className="search-kbd">⌘K</span>
      </div>
      <div className="topbar-right">
        <div className="topbar-divider" />
        <div className="sync-pill">
          <div className="pulse-dot" style={{ background: dotColor }} />
          <span>{syncLabel(syncedAt ?? null)}</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
