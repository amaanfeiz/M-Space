'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CornerDownLeft,
  FileText,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'

type PaletteProject = {
  pid: number
  cx_name: string | null
  status: string | null
}

type PageItem = {
  type: 'page'
  href: string
  label: string
  icon: LucideIcon
}

type ProjectItem = {
  type: 'project'
  pid: number
  label: string
  status: string | null
}

type ResultItem = PageItem | ProjectItem

const PAGES: PageItem[] = [
  { type: 'page', href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { type: 'page', href: '/projects', label: 'Projects', icon: Layers },
  { type: 'page', href: '/team', label: 'Team', icon: Users },
  { type: 'page', href: '/intelligence', label: 'Intelligence', icon: Sparkles },
  { type: 'page', href: '/coplanner', label: 'Coplanner', icon: MessageSquare },
  { type: 'page', href: '/reports', label: 'Reports', icon: FileText },
  { type: 'page', href: '/settings', label: 'Settings', icon: SettingsIcon },
]

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  let hi = 0
  for (let ni = 0; ni < n.length; ni++) {
    const c = n[ni]
    while (hi < h.length && h[hi] !== c) hi++
    if (hi === h.length) return false
    hi++
  }
  return true
}

export function CommandPalette({ projects }: { projects: PaletteProject[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const results = useMemo<ResultItem[]>(() => {
    const pages = PAGES.filter((p) => fuzzyMatch(p.label, query))
    const projItems: ProjectItem[] = projects
      .filter((p) => {
        const label = `${p.pid} ${p.cx_name ?? ''}`
        return fuzzyMatch(label, query)
      })
      .slice(0, 50)
      .map((p) => ({
        type: 'project',
        pid: p.pid,
        label: `${p.pid} — ${p.cx_name ?? 'Unnamed'}`,
        status: p.status,
      }))
    return [...pages, ...projItems]
  }, [query, projects])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const togglePalette = useCallback(() => {
    setOpen((v) => {
      if (v) {
        setQuery('')
        setSelectedIndex(0)
      }
      return !v
    })
  }, [])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        togglePalette()
        return
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        closePalette()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, togglePalette, closePalette])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 10)
      return () => clearTimeout(t)
    }
  }, [open])

  const select = useCallback(
    (item: ResultItem) => {
      closePalette()
      if (item.type === 'page') {
        router.push(item.href)
      } else {
        window.location.hash = `#pid=${item.pid}`
      }
    },
    [router, closePalette],
  )

  function onQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setSelectedIndex(0)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = results[selectedIndex]
      if (item) select(item)
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!open) return null

  const pagesCount = results.filter((r) => r.type === 'page').length

  return (
    <div className="cmdk-overlay" onClick={closePalette} role="dialog" aria-modal>
      <div className="cmdk-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Search className="cmdk-icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={onQueryChange}
            onKeyDown={onKeyDown}
            placeholder="Search projects, jump to a page…"
            className="cmdk-input"
            aria-label="Command palette search"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmdk-esc">ESC</kbd>
        </div>
        <div ref={listRef} className="cmdk-list">
          {results.length === 0 && (
            <div className="cmdk-empty">No matches for &quot;{query}&quot;</div>
          )}
          {pagesCount > 0 && <div className="cmdk-section">Pages</div>}
          {results.map((item, i) => {
            const selected = i === selectedIndex
            if (item.type === 'page') {
              const Icon = item.icon
              return (
                <button
                  key={`page-${item.href}`}
                  data-index={i}
                  className={`cmdk-item${selected ? ' selected' : ''}`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => select(item)}
                  type="button"
                >
                  <Icon className="cmdk-item-icon" />
                  <span className="cmdk-item-label">{item.label}</span>
                  <span className="cmdk-item-meta">Page</span>
                  {selected && <CornerDownLeft className="cmdk-enter" />}
                </button>
              )
            }
            if (i === pagesCount) {
              return (
                <div key="proj-divider">
                  <div className="cmdk-section">Projects</div>
                  <button
                    data-index={i}
                    className={`cmdk-item${selected ? ' selected' : ''}`}
                    onMouseEnter={() => setSelectedIndex(i)}
                    onClick={() => select(item)}
                    type="button"
                  >
                    <span className="cmdk-pid-mark">PID</span>
                    <span className="cmdk-item-label">{item.label}</span>
                    {item.status && (
                      <span className="cmdk-item-meta">{item.status}</span>
                    )}
                    {selected && <CornerDownLeft className="cmdk-enter" />}
                  </button>
                </div>
              )
            }
            return (
              <button
                key={`proj-${item.pid}`}
                data-index={i}
                className={`cmdk-item${selected ? ' selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => select(item)}
                type="button"
              >
                <span className="cmdk-pid-mark">PID</span>
                <span className="cmdk-item-label">{item.label}</span>
                {item.status && (
                  <span className="cmdk-item-meta">{item.status}</span>
                )}
                {selected && <CornerDownLeft className="cmdk-enter" />}
              </button>
            )
          })}
        </div>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
