'use client'

import { useState } from 'react'

interface BriefFeedbackProps {
  briefId: string
  pid: number
}

/**
 * Feedback textarea attached to a brief. Posts to /api/brief/feedback
 * which writes to the brief_feedback table. Used by the DetailPanel
 * Brief tab. The last N feedback entries are injected into the
 * generate-brief.ts prompt so corrections shape future briefs.
 */
export function BriefFeedback({ briefId, pid }: BriefFeedbackProps) {
  const [feedback, setFeedback] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function submit() {
    if (!feedback.trim()) return
    setState('saving')
    try {
      const res = await fetch('/api/brief/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_id: briefId, pid, user_input: feedback }),
      })
      if (!res.ok) throw new Error('save failed')
      setFeedback('')
      setState('saved')
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: 14,
        marginTop: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Feedback
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Correct something, add context, or flag what's missing…"
        rows={3}
        style={{
          width: '100%',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 12,
          color: 'var(--text-primary)',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={submit}
          disabled={!feedback.trim() || state === 'saving'}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 14px',
            borderRadius: 4,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: feedback.trim() && state !== 'saving' ? 'pointer' : 'not-allowed',
            opacity: feedback.trim() && state !== 'saving' ? 1 : 0.5,
          }}
        >
          {state === 'saving' ? 'Saving…' : 'Submit'}
        </button>
        {state === 'saved' && (
          <span style={{ fontSize: 11, color: 'var(--healthy)' }}>Saved — will inform the next brief.</span>
        )}
        {state === 'error' && (
          <span style={{ fontSize: 11, color: 'var(--critical)' }}>Save failed. Try again.</span>
        )}
      </div>
    </div>
  )
}
