'use client'

import { Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const THEME_EVENT = 'meragi-theme-change'

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(THEME_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light'
}

function getServerSnapshot(): Theme {
  return 'light'
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return (
    <button
      id="theme-toggle"
      onClick={toggle}
      type="button"
      title="Toggle theme"
      aria-label="Toggle dark/light mode"
    >
      <span suppressHydrationWarning>
        {theme === 'dark' ? <Sun /> : <Moon />}
      </span>
    </button>
  )
}
