'use client'

import { useState } from 'react'

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
  unacknowledged_requests?: Array<{
    request: string
    asked_by: string
    asked_on: string
    days_unanswered: number
  }>
  open_questions: { clarification_message: string } | Array<{ question: string; draft_message: string }>
  cross_source_flags: Array<{ flag: string; chat_says: string; tracker_says: string }>

  // Brief JSON v2 fields — all optional for backward compatibility with older
  // briefs persisted before the schema upgrade.
  phase?:
    | 'sales_wip' | 'onboarding' | 'active_planning' | 'mid_runway'
    | 'final_quarter' | 'post_event' | 'paused' | 'cancelled'
  runway_pct?: number | null
  client_experience_frame?: string
  ai_clarification?: Array<{
    question: string
    reason: string
    category: 'sentiment' | 'payment' | 'team' | 'vendor' | 'other'
  }>
  amaan_self_loop?: Array<{
    original_ask: string
    asked_at: string
    hours_unanswered: number
    suggested_reping: string
  }>
  recovery_state?: null | {
    entered_at: string
    sustained_positive: boolean
    last_positive_marker_at: string | null
  }
  designer_lane?: {
    assigned_designer: string | null
    days_since_intro_call: number | null
    design_surface_count: number
    flag: string | null
  }
  pm_lane?: {
    assigned_pm: string | null
    phase_role: 'early' | 'late' | 'na'
    client_group_messages_30d: number
    meet_voice_count_30d: number
    flag: string | null
  }
  vm_lane?: {
    open_requests: Array<{
      tagged_at: string
      topic: string
      has_deadline: boolean
      status_updates: number
    }>
    flag: string | null
  }
  commercial_trail?: Array<{
    vendor_name: string
    locked: boolean
    cp_present: boolean
    sp_present: boolean
    advance_present: boolean
    margin_present: boolean
    schedule_present: boolean
    completeness_pct: number
  }>
  phase_expectations?: {
    expected_at_runway_pct: Array<{ item: string; expected: boolean; actual: boolean }>
  }
  exceptional_pid_score?: {
    proactive_surface: number
    client_mirroring: number
    collaborative_framing: number
    badge: boolean
  }
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
      <Section title="What Changed">
        {brief.what_changed?.length > 0
          ? brief.what_changed.map((item, i) => (
              <BulletRow key={i} text={item} />
            ))
          : <EmptyLine>No notable changes in this window.</EmptyLine>
        }
      </Section>

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

      {/* Unacknowledged client requests — most critical category */}
      {brief.unacknowledged_requests && brief.unacknowledged_requests.length > 0 && (
        <Section title="Unacknowledged client requests">
          {brief.unacknowledged_requests.map((r, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginBottom: 6,
                padding: '6px 10px',
                background: 'var(--surface-elevated)',
                borderLeft: '3px solid var(--critical)',
                borderRadius: 4,
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--critical)', textTransform: 'uppercase', flexShrink: 0 }}>
                  Unanswered {r.days_unanswered}d
                </span>
              </div>
              <div style={{ color: 'var(--text-primary)' }}>
                &ldquo;{r.request}&rdquo;
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                {r.asked_by} · {r.asked_on}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Needs You */}
      <Section title="Needs You">
        {brief.needs_you?.length > 0
          ? brief.needs_you.map((n, i) => (
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
            ))
          : <EmptyLine>Nothing requires you right now.</EmptyLine>
        }
      </Section>

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

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.55 }}>
      {children}
    </div>
  )
}
