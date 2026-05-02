'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FileText,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Settings as SettingsIcon,
  Sparkles,
  Users,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  beta?: boolean
}

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: Layers },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/intelligence', label: 'Intelligence', icon: Sparkles },
  { href: '/coplanner', label: 'Coplanner', icon: MessageSquare, beta: true },
  { href: '/reports', label: 'Reports', icon: FileText },
]

type SidebarProps = {
  userName: string
  userInitials: string
  userRole: string
}

export function Sidebar({ userName, userInitials, userRole }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside id="sidebar" className="sidebar-rail" aria-label="Primary navigation">
      <div className="sidebar-logo">
        <span className="brand-dot" aria-hidden />
        <span className="logo-text">Meragi</span>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(({ href, label, icon: Icon, beta }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item${active ? ' active' : ''}`}
              aria-label={label}
              title={label}
            >
              <Icon />
              <span className="nav-label">{label}</span>
              {beta && <span className="nav-beta">BETA</span>}
            </Link>
          )
        })}
      </nav>
      <div className="sidebar-settings">
        <Link
          href="/settings"
          className={`nav-item${pathname === '/settings' ? ' active' : ''}`}
          style={{ color: 'var(--text-dim)' }}
          aria-label="Settings"
          title="Settings"
        >
          <SettingsIcon />
          <span className="nav-label">Settings</span>
        </Link>
      </div>
      <div className="sidebar-bottom">
        <div className="user-card" title={`${userName} · ${userRole}`}>
          <div className="avatar">{userInitials}</div>
          <div className="user-meta">
            <div className="user-name">{userName}</div>
            <div className="user-role">{userRole}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
