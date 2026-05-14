'use client'

import { ChevronRight, Search } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/team': 'Team',
  '/coplanner': 'Coplanner',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

// Wrapped so the React purity-during-render rule treats it as opaque.
function nowMillis(): number {
  return Date.now()
}

function syncPillColor(syncedAt: string | null): string {
  if (!syncedAt) return 'var(--text-dim)'
  const mins = (nowMillis() - new Date(syncedAt).getTime()) / 60000
  if (mins < 30) return 'var(--healthy)'
  if (mins < 60) return 'var(--attention)'
  return 'var(--critical)'
}

function syncLabel(syncedAt: string | null): string {
  if (!syncedAt) return 'Sync unknown'
  const mins = Math.floor((nowMillis() - new Date(syncedAt).getTime()) / 60000)
  if (mins < 2) return 'Last sync: just now'
  if (mins < 60) return `Last sync: ${mins}m ago`
  return `Last sync: ${Math.floor(mins / 60)}h ago`
}

/** Returns hours since last sync, or null if no sync ever recorded. */
function hoursSinceSync(syncedAt: string | null): number | null {
  if (!syncedAt) return null
  return (nowMillis() - new Date(syncedAt).getTime()) / 3_600_000
}

function openPalette() {
  // Synthesize Cmd+K — handled by CommandPalette listener
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
  )
}

export function Topbar({ syncedAt }: { syncedAt?: string | null }) {
  const pathname = usePathname()
  const title = TITLES[pathname] ?? 'Meragi Intel'
  const dotColor = syncPillColor(syncedAt ?? null)
  const isModKeyMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
  const hours = hoursSinceSync(syncedAt ?? null)
  // Sync stalled beyond 24h is a real problem — the dashboard is showing
  // tracker data that may have moved without us seeing it.
  const stalled = hours == null || hours >= 24

  return (
    <>
      {stalled && (
        <div
          role="alert"
          style={{
            padding: '8px 24px',
            fontSize: 12,
            background: 'color-mix(in srgb, var(--critical) 12%, transparent)',
            color: 'var(--critical)',
            borderBottom: '1px solid color-mix(in srgb, var(--critical) 30%, transparent)',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {hours == null
            ? 'Sync has never run. Tracker data shown may be empty or stale.'
            : `Sync stalled · last successful run ${Math.floor(hours)}h ago. Check the Supabase Edge Function logs.`}
        </div>
      )}
      <header id="topbar">
        <div className="breadcrumb">
          <span className="breadcrumb-root">Meragi Intel</span>
          <ChevronRight className="breadcrumb-sep" />
          <span className="breadcrumb-current">{title}</span>
        </div>
        <button
          type="button"
          className="search-trigger"
          onClick={openPalette}
          aria-label="Open command palette"
        >
          <Search className="search-trigger-icon" />
          <span className="search-trigger-text">Search projects, jump to a page…</span>
          <span className="search-kbd">{isModKeyMac ? '⌘' : 'Ctrl'} K</span>
        </button>
        <div className="topbar-right">
          <div className="topbar-divider" />
          <div className="sync-pill">
            <div className="pulse-dot" style={{ background: dotColor }} />
            <span>{syncLabel(syncedAt ?? null)}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
    </>
  )
}
