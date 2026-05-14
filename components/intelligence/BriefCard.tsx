'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export interface BriefJSON {
  client_pulse: {
    sentiment: 'positive' | 'neutral' | 'cautious' | 'anxious' | 'cold'
    confidence: 'high' | 'medium' | 'low'
    summary: string
    days_silent: number
  }
  team_status: Array<{
    display_label: string
    role: string
    last_active_date: string
    activity_note: string
  }>
  what_changed: string[]
  commitments: Array<{
    what: string
    owner: string
    due: string
    status: 'open' | 'done' | 'overdue' | 'unclear'
  }>
  needs_you: Array<{ action: string; priority: 'urgent' | 'soon' | 'when_able' }>
  open_questions: { clarification_message: string } | Array<{ question: string; draft_message: string }>
  cross_source_flags: Array<{ flag: string; chat_says: string; tracker_says: string }>
}

export interface BriefCardProps {
  briefId: string
  pid: number
  briefDate: string
  isCatchup: boolean
  brief: BriefJSON
  cxName: string | null
  eventStart: string | null
  eventEnd: string | null
  tDays: number | null
  collectionPct: string | null
  projectHealth: number | null
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'var(--healthy)',
  neutral:  'var(--text-dim)',
  cautious: 'var(--attention)',
  anxious:  'var(--critical)',
  cold:     'var(--critical)',
}

const COMMIT_COLOR: Record<string, string> = {
  open:    'var(--attention)',
  done:    'var(--healthy)',
  overdue: 'var(--critical)',
  unclear: 'var(--text-dim)',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent:    'var(--critical)',
  soon:      'var(--attention)',
  when_able: 'var(--text-dim)',
}

function eventLabel(start: string | null, end: string | null, tDays: number | null): string {
  if (!start) return '—'
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const dateStr = end && end !== start ? `${fmt(start)}–${fmt(end)}` : fmt(start)
  if (tDays == null) return dateStr
  if (tDays > 0) return `${dateStr} · ${tDays}d away`
  if (tDays === 0) return `${dateStr} · today`
  return `${dateStr} · past`
}

// Exported so DetailPanel can render it in the Brief tab
export function BriefBody({ brief, briefDate, isCatchup }: { brief: BriefJSON; briefDate: string; isCatchup: boolean }) {
  const pulse = brief.client_pulse
  const sentColor = SENTIMENT_COLOR[pulse.sentiment] ?? 'var(--text-dim)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Brief date + catch-up notice */}
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
        {isCatchup ? 'catch-up brief' : 'daily brief'} · {briefDate}
      </div>

      {/* Client Pulse */}
      <Section title="Client Pulse">
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          <span style={{ color: sentColor, fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
            {pulse.sentiment}
          </span>
          {' · '}confidence: {pulse.confidence}
          {pulse.days_silent > 0 && ` · ${pulse.days_silent}d silent`}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.65, margin: 0 }}>
          {pulse.summary}
        </p>
      </Section>

      {/* Team Status */}
      {brief.team_status?.length > 0 && (
        <Section title="Team Status">
          {brief.team_status.map((t, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.display_label}</span>
              {t.last_active_date && (
                <span style={{ color: 'var(--text-dim)' }}> · {t.last_active_date}</span>
              )}
              {t.activity_note && ` — ${t.activity_note}`}
            </div>
          ))}
        </Section>
      )}

      {/* What Changed */}
      {brief.what_changed?.length > 0 && (
        <Section title="What Changed">
          {brief.what_changed.map((item, i) => (
            <BulletRow key={i} text={item} />
          ))}
        </Section>
      )}

      {/* Commitments */}
      {brief.commitments?.length > 0 && (
        <Section title="Commitments">
          {brief.commitments.map((c, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: COMMIT_COLOR[c.status] ?? 'var(--text-dim)',
                  flexShrink: 0,
                }}
              >
                {c.status}
              </span>
              <span>
                {c.what}
                <span style={{ color: 'var(--text-dim)' }}>
                  {' · '}<strong style={{ color: 'var(--text-primary)' }}>{c.owner}</strong>
                  {c.due ? ` · by ${c.due}` : ''}
                </span>
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Needs You */}
      {brief.needs_you?.length > 0 && (
        <Section title="Needs You">
          {brief.needs_you.map((n, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: PRIORITY_COLOR[n.priority] ?? 'var(--text-dim)',
                  flexShrink: 0,
                }}
              >
                {n.priority.replace('_', ' ')}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{n.action}</span>
            </div>
          ))}
        </Section>
      )}

      {/* Clarification Message */}
      <ClarificationSection openQuestions={brief.open_questions} />

      {/* Cross-Source Flags */}
      {brief.cross_source_flags?.length > 0 && (
        <Section title="Cross-Source Flags">
          {brief.cross_source_flags.map((f, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--attention)', marginBottom: 2 }}>
                [FLAG] {f.flag}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                <span style={{ color: 'var(--text-dim)' }}>Chat: </span>{f.chat_says}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                <span style={{ color: 'var(--text-dim)' }}>Tracker: </span>{f.tracker_says}
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

export function BriefCard({
  briefId, pid, briefDate, isCatchup, brief,
  cxName, eventStart, eventEnd, tDays, collectionPct,
}: BriefCardProps) {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackState, setFeedbackState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const pulse = brief.client_pulse
  const flags = brief.cross_source_flags?.length ?? 0
  const actions = brief.needs_you?.length ?? 0
  const sentColor = SENTIMENT_COLOR[pulse.sentiment] ?? 'var(--text-dim)'

  async function submitFeedback() {
    if (!feedback.trim()) return
    setFeedbackState('saving')
    try {
      const res = await fetch('/api/brief/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_id: briefId, pid, user_input: feedback }),
      })
      if (!res.ok) throw new Error('save failed')
      setFeedback('')
      setFeedbackState('saved')
      setTimeout(() => setFeedbackState('idle'), 3000)
    } catch {
      setFeedbackState('error')
      setTimeout(() => setFeedbackState('idle'), 3000)
    }
  }

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        borderLeft: `3px solid ${sentColor}`,
      }}
    >
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: sentColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {cxName ?? `PID ${pid}`}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-dim)',
            flexShrink: 0,
          }}
        >
          {pid}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          {eventLabel(eventStart, eventEnd, tDays)}
        </span>
        {flags > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--attention)', flexShrink: 0, letterSpacing: '0.04em' }}>
            flags: {flags}
          </span>
        )}
        {actions > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--critical)', flexShrink: 0, letterSpacing: '0.04em' }}>
            actions: {actions}
          </span>
        )}
        {collectionPct && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
            {collectionPct}% col.
          </span>
        )}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: sentColor,
            flexShrink: 0,
          }}
        >
          {pulse.sentiment}
        </span>
        {open
          ? <ChevronUp style={{ width: 13, height: 13, color: 'var(--text-dim)', flexShrink: 0 }} />
          : <ChevronDown style={{ width: 13, height: 13, color: 'var(--text-dim)', flexShrink: 0 }} />
        }
      </button>

      {/* Expanded body */}
      {open && (
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <BriefBody brief={brief} briefDate={briefDate} isCatchup={isCatchup} />

          {/* Open full project link */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { window.location.hash = `#pid=${pid}&tab=brief` }}
              style={{
                fontSize: 11,
                color: 'var(--accent)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 0',
                fontFamily: 'inherit',
              }}
            >
              Open full project →
            </button>
          </div>

          {/* Feedback */}
          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 14,
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
                onClick={submitFeedback}
                disabled={!feedback.trim() || feedbackState === 'saving'}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '5px 14px',
                  borderRadius: 4,
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  cursor: feedback.trim() && feedbackState !== 'saving' ? 'pointer' : 'not-allowed',
                  opacity: feedback.trim() && feedbackState !== 'saving' ? 1 : 0.5,
                }}
              >
                {feedbackState === 'saving' ? 'Saving…' : 'Submit'}
              </button>
              {feedbackState === 'saved' && (
                <span style={{ fontSize: 11, color: 'var(--healthy)' }}>Saved — will inform the next brief.</span>
              )}
              {feedbackState === 'error' && (
                <span style={{ fontSize: 11, color: 'var(--critical)' }}>Save failed. Try again.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClarificationSection({ openQuestions }: { openQuestions: BriefJSON['open_questions'] }) {
  const [copied, setCopied] = useState(false)

  const message = Array.isArray(openQuestions)
    ? openQuestions.map((q) => q.draft_message).filter(Boolean).join(' ')
    : openQuestions?.clarification_message ?? ''

  if (!message) return null

  function copy() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Section title="Send to Group">
      <div
        style={{
          background: 'var(--surface-elevated)',
          borderRadius: 6,
          padding: '10px 12px',
          position: 'relative',
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.65, margin: 0, marginBottom: 8 }}>
          {message}
        </p>
        <button
          type="button"
          onClick={copy}
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 4,
            background: copied ? 'var(--healthy)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          marginBottom: 7,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function BulletRow({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, paddingLeft: 10, borderLeft: '2px solid var(--border-subtle)', lineHeight: 1.6 }}>
      {text}
    </div>
  )
}
