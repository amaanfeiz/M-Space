'use client'

import type { ReactNode } from 'react'

export function PIDLink({
  pid,
  className,
  children,
  style,
}: {
  pid: number | string
  className?: string
  children: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <a
      href={`#pid=${pid}`}
      className={className}
      style={{ textDecoration: 'none', ...style }}
      onClick={(e) => {
        e.preventDefault()
        window.location.hash = `#pid=${pid}`
      }}
    >
      {children}
    </a>
  )
}
