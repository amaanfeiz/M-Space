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

export function Topbar() {
  const pathname = usePathname()
  const title = TITLES[pathname] ?? 'Meragi Intel'

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
        <button className="filter-pill" type="button">
          All Teams
        </button>
        <button className="filter-pill" type="button">
          All Months
        </button>
        <div className="topbar-divider" />
        <div className="sync-pill">
          <div className="pulse-dot" />
          <span>Last sync: just now</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
