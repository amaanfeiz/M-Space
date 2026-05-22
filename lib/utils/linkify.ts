import React from 'react'

// Linkify a plain text string — replaces 5-digit PID numbers with PIDLink anchors.
// Returns an array of React nodes suitable for rendering inside a JSX element.
export function linkifyText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // Match "PID 28438" or bare 5-digit numbers
  const pattern = /\bPID\s*(\d{5})\b|\b(\d{5})\b/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const pid = match[1] ?? match[2]
    parts.push(
      React.createElement(
        'a',
        {
          key: match.index,
          href: `#pid=${pid}`,
          onClick: (e: React.MouseEvent) => {
            e.preventDefault()
            window.location.hash = `#pid=${pid}`
          },
          style: { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 },
        },
        match[0],
      ),
    )
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export function LinkedText({ text, style }: { text: string; style?: React.CSSProperties }) {
  return React.createElement('span', { style }, ...linkifyText(text))
}
