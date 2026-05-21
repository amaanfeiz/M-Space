'use client'

import { useState } from 'react'

export type RecentMessage = {
  id: string
  sent_at: string
  body: string | null
  sender_name: string | null
  sender_wa_id: string | null
  display_label: string | null
  chat_type: 'client' | 'internal' | string
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })
}

function senderLabel(m: RecentMessage): string {
  if (m.display_label) return m.display_label
  if (m.sender_name) return m.sender_name
  if (m.sender_wa_id) return m.sender_wa_id.split('@')[0]
  return 'Unknown'
}

export function RecentMessagesDropdown({ messages }: { messages: RecentMessage[] }) {
  const [open, setOpen] = useState(false)
  if (messages.length === 0) return null

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 11,
          color: 'var(--accent)',
          padding: 0,
        }}
      >
        Recent messages: ▸ Last {messages.length}{open ? ' ▾' : ''}
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {messages.map((m) => (
            <div key={m.id} style={{
              fontSize: 11,
              padding: '5px 8px',
              borderRadius: 4,
              background: 'var(--surface-elevated)',
              borderLeft: `2px solid ${m.chat_type === 'client' ? 'var(--accent)' : 'var(--border-subtle)'}`,
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{senderLabel(m)}</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  [{m.chat_type}]
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>{formatTime(m.sent_at)}</span>
              </div>
              <div style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>{m.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
