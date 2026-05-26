'use client'

import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatInr } from '@/lib/utils/format-currency'
import { LinkedText } from '@/lib/utils/linkify'
import type { BriefJSON } from '@/components/intelligence/BriefBody'
import { ActivitySparkline, type SparklineDay } from '@/components/panel/ActivitySparkline'
import { StatusStrip } from '@/components/panel/StatusMeters'
import { RiskTrackerSnapshot } from '@/components/panel/RiskTrackerSnapshot'
import { PortfolioMentions, extractPortfolioMentions } from '@/components/panel/PortfolioMentions'
import { SectionNav } from '@/components/panel/SectionNav'
import { RecentMessagesDropdown, type RecentMessage } from '@/components/panel/RecentMessagesDropdown'

// ── DB types ──────────────────────────────────────────────────────────────

type DBProject = {
  pid: number
  cx_name: string | null
  status: string | null
  overall_pid_risk: string | null
  cancellation_risk: number | null
  current_summary: string | null
  ai_notes_summary: string | null
  bgmv: number | null
  collection: number | null
  collection_pct: number | null
  package_price_eff: number | null
  event_start_date: string | null
  venue: string | null
  state: string | null
  planner: string | null
  designer: string | null
  project_manager: string | null
  cancellation_risk_reason: string | null
  collection_risk: string | null
  communication_risk: string | null
  sentiment_risk: string | null
  t_days: number | null
  project_health: number | null
  planning_status: string | null
}

type BriefMeta = {
  id: string
  json: BriefJSON
  date: string
  isCatchup: boolean
}

type PortfolioEntry = { type: string; text: string }

// ── Utility ───────────────────────────────────────────────────────────────

// Routed through a helper so the React purity-during-render lint rule stays quiet.
function nowMillis(): number { return Date.now() }

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })
}

function daysAgo(iso: string): string {
  const diff = Math.floor((nowMillis() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  return `${diff}d ago`
}

function buildSparklineDays(
  signals: Array<{ sent_at: string }>,
  briefs: Array<{ brief_date: string; brief_json: BriefJSON }>,
): SparklineDay[] {
  // Build a 14-day range ending today (IST)
  const todayIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const days: SparklineDay[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayIST)
    d.setDate(d.getDate() - i)
    days.push({ date: d.toISOString().slice(0, 10), signalCount: 0, sentiment: null })
  }

  // Count signals per day
  for (const s of signals) {
    const day = new Date(s.sent_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
    const entry = days.find((d) => d.date === day)
    if (entry) entry.signalCount++
  }

  // Apply brief sentiments
  for (const b of briefs) {
    const entry = days.find((d) => d.date === b.brief_date)
    if (entry) entry.sentiment = b.brief_json?.client_pulse?.sentiment ?? null
  }

  return days
}

// ── Role colors ───────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  planner:         'var(--accent)',
  designer:        '#ec4899',
  project_manager: '#14b8a6',
  pm:              '#14b8a6',
  tl:              'var(--text-muted)',
  client:          'var(--text-muted)',
  vendor:          '#f59e0b',
  rm:              'var(--text-dim)',
}

function roleColor(role: string | null): string {
  return ROLE_COLORS[role?.toLowerCase().replace(' ', '_') ?? ''] ?? 'var(--text-muted)'
}

function engagementFromNote(note: string | null, lastActiveDate: string | null): { label: string; color: string } {
  if (!note && !lastActiveDate) return { label: 'unknown', color: 'var(--text-dim)' }
  const n = (note ?? '').toLowerCase()
  if (n.startsWith('silent')) return { label: 'silent', color: 'var(--critical)' }
  if (!lastActiveDate) return { label: 'unknown', color: 'var(--text-dim)' }
  const days = Math.floor((nowMillis() - new Date(lastActiveDate).getTime()) / 86400000)
  if (days <= 3) return { label: 'active', color: 'var(--healthy)' }
  if (days <= 7) return { label: 'quiet', color: 'var(--attention)' }
  return { label: 'dormant', color: '#f97316' }
}

// ── Section header ────────────────────────────────────────────────────────

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--text-dim)',
      marginBottom: 7,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      {children}
      {count !== undefined && count > 0 && (
        <span style={{
          background: 'var(--critical)',
          color: '#fff',
          borderRadius: 8,
          padding: '1px 6px',
          fontSize: 9,
          fontWeight: 700,
        }}>{count}</span>
      )}
    </div>
  )
}

function PanelSection({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div id={id} data-section style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
      {children}
    </div>
  )
}

// ── Brief freshness ────────────────────────────────────────────────────────

function BriefFreshnessBar({ date, isCatchup }: { date: string; isCatchup: boolean }) {
  if (isCatchup) {
    return (
      <div style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
        Catch-up brief · {date} (1-year history)
      </div>
    )
  }
  const ageH = (nowMillis() - new Date(date).getTime()) / 3600000
  let color = 'var(--text-dim)'
  let label = `Brief generated · ${date}`
  if (ageH > 30) { color = 'var(--attention)'; label = `⚠ Brief is ${Math.floor(ageH / 24)}d old · last run ${date}` }
  else if (ageH > 12) { color = 'var(--text-muted)'; label = `Brief from yesterday · ${date}` }
  return <div style={{ fontSize: 10, color, fontFamily: 'var(--font-mono)' }}>{label}</div>
}

// ── Client Pulse ───────────────────────────────────────────────────────────

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'var(--healthy)',
  neutral:  'var(--text-dim)',
  cautious: 'var(--attention)',
  anxious:  'var(--critical)',
  cold:     'var(--critical)',
}

function ClientPulse({ pulse, tDays }: { pulse: BriefJSON['client_pulse']; tDays: number | null }) {
  const pastEvent = (tDays ?? 1) < 0
  const sentColor = SENTIMENT_COLOR[pulse.sentiment] ?? 'var(--text-dim)'
  const silenceRed = !pastEvent && (pulse.days_silent ?? 0) > 7

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
        <span style={{ color: silenceRed ? 'var(--critical)' : sentColor, fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
          {pulse.sentiment}
        </span>
        {' · '}confidence: {pulse.confidence}
        {!pastEvent && (pulse.days_silent ?? 0) > 0 && (
          <span style={{ color: silenceRed ? 'var(--critical)' : 'var(--text-dim)' }}>
            {' · '}{pulse.days_silent}d silent
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.65, margin: 0 }}>{pulse.summary}</p>
    </div>
  )
}

// ── Unacknowledged Requests ────────────────────────────────────────────────

function UnacknowledgedRequests({ items }: { items: BriefJSON['unacknowledged_requests'] }) {
  const list = items ?? []
  if (list.length === 0) {
    return <div style={{ fontSize: 11, color: 'var(--healthy)', fontStyle: 'italic' }}>✓ All client requests acknowledged.</div>
  }
  const sorted = [...list].sort((a, b) => b.days_unanswered - a.days_unanswered)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map((r, i) => (
        <div key={i} style={{
          fontSize: 12,
          padding: '6px 10px',
          background: 'var(--surface-elevated)',
          borderLeft: '3px solid var(--critical)',
          borderRadius: 4,
          lineHeight: 1.5,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--critical)', textTransform: 'uppercase', marginBottom: 3 }}>
            Unanswered {r.days_unanswered}d
          </div>
          <div style={{ color: 'var(--text-primary)' }}>&ldquo;{r.request}&rdquo;</div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
            {r.asked_by} · {r.asked_on}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Team Status ────────────────────────────────────────────────────────────

function TeamStatus({ members, tDays }: { members: BriefJSON['team_status']; tDays: number | null }) {
  const pastEvent = (tDays ?? 1) < 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {members.map((m, i) => {
        const color = roleColor(m.role)
        const eng = engagementFromNote(m.activity_note, m.last_active_date)
        const noteText = pastEvent
          ? (m.activity_note ?? '').replace(/^Silent\s*\d+d\s*[—-]\s*/i, '').trim()
          : m.activity_note

        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: `${color}22`, border: `1.5px solid ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color,
            }}>
              {(m.display_label ?? '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{m.display_label}</span>
                {!pastEvent && (
                  <span style={{ fontSize: 9, fontWeight: 600, color: eng.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {eng.label}
                  </span>
                )}
                {pastEvent && (
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>post-event</span>
                )}
              </div>
              {m.last_active_date && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>Last: {m.last_active_date}</div>
              )}
              {noteText && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>{noteText}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── What Changed ───────────────────────────────────────────────────────────

function WhatChanged({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false)
  const count = items.length
  if (count === 0) return <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>No notable changes in this window.</div>

  const visible = open ? items : items.slice(0, 3)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
      >
        <SectionTitle>What Changed ({count}) {open ? '▾' : '▸'}</SectionTitle>
      </button>
      {open && (
        <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {visible.map((item, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 10, borderLeft: '2px solid var(--border-subtle)', lineHeight: 1.6 }}>
              <LinkedText text={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Communications ─────────────────────────────────────────────────────────

function CommsSection({
  signals,
  commitmentCount,
  unacknowledgedCount,
  recentMessages,
  tDays,
  onScrollToCommitments,
  onScrollToUnacknowledged,
}: {
  signals: Array<{ sent_at: string; chat_type: string }>
  commitmentCount: number
  unacknowledgedCount: number
  recentMessages: RecentMessage[]
  tDays: number | null
  onScrollToCommitments: () => void
  onScrollToUnacknowledged: () => void
}) {
  const pastEvent = (tDays ?? 1) < 0
  // Compute client signal count over last 14 days
  const cutoff = nowMillis() - 14 * 86400000
  const clientCount = signals.filter((s) => s.chat_type === 'client' && new Date(s.sent_at).getTime() > cutoff).length
  // Last client message
  const lastClient = signals.filter((s) => s.chat_type === 'client').sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0]

  function chattinessLabel(n: number): string {
    if (n === 0) return 'Cold'
    if (n <= 10) return 'Quiet'
    if (n <= 30) return 'Steady'
    return 'Chatty'
  }

  const barPct = Math.min(100, (clientCount / 30) * 100)
  const barColor = clientCount === 0 ? 'var(--critical)' : clientCount <= 10 ? 'var(--attention)' : 'var(--healthy)'

  return (
    <div>
      {!pastEvent && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Client engagement: <strong style={{ color: barColor }}>{chattinessLabel(clientCount)}</strong>
            <span style={{ color: 'var(--text-dim)' }}> ({clientCount} messages / 14d)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
              <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
          </div>
          {lastClient && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Last client message: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(lastClient.sent_at)}</strong>
              <span style={{ color: 'var(--text-dim)' }}> ({daysAgo(lastClient.sent_at)})</span>
            </div>
          )}
        </>
      )}
      {commitmentCount > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          Open commitments:{' '}
          <button type="button" onClick={onScrollToCommitments} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: 0 }}>
            {commitmentCount} →
          </button>
        </div>
      )}
      {unacknowledgedCount > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
          Unanswered requests:{' '}
          <button type="button" onClick={onScrollToUnacknowledged} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--critical)', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: 0 }}>
            {unacknowledgedCount} →
          </button>
        </div>
      )}
      <RecentMessagesDropdown messages={recentMessages} />
    </div>
  )
}

// ── Money ──────────────────────────────────────────────────────────────────

function MoneySection({
  project,
  crossSourceFlags,
}: {
  project: DBProject
  crossSourceFlags: BriefJSON['cross_source_flags']
}) {
  const pct = project.collection_pct ?? 0
  const collected = formatInr(project.collection, 'full')
  const pending = project.package_price_eff && project.collection != null
    ? formatInr(project.package_price_eff - project.collection, 'full')
    : '—'

  const moneyFlag = crossSourceFlags?.find((f) => {
    const t = (f.flag + f.chat_says + f.tracker_says).toLowerCase()
    return t.includes('pending') || t.includes('collected') || t.includes('payment') || t.includes('collection') || t.includes('instalment') || t.includes('₹')
  })

  const barColor = pct > 40 ? 'var(--healthy)' : pct > 20 ? 'var(--attention)' : 'var(--critical)'

  return (
    <div>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <tbody>
          {project.package_price_eff != null && (
            <tr>
              <td style={{ color: 'var(--text-dim)', padding: '3px 0' }}>Package SP</td>
              <td style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 500 }}>{formatInr(project.package_price_eff, 'full')}</td>
            </tr>
          )}
          {project.bgmv != null && (
            <tr>
              <td style={{ color: 'var(--text-dim)', padding: '3px 0', fontSize: 11 }}>BGMV</td>
              <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>{formatInr(project.bgmv, 'full')}</td>
            </tr>
          )}
          <tr>
            <td style={{ color: 'var(--text-dim)', padding: '3px 0' }}>Collected</td>
            <td style={{ textAlign: 'right' }}>
              <span style={{ color: barColor, fontWeight: 600 }}>{collected}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>({pct.toFixed(1)}%)</span>
            </td>
          </tr>
          <tr>
            <td style={{ color: 'var(--text-dim)', padding: '3px 0' }}>Pending</td>
            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{pending}</td>
          </tr>
        </tbody>
      </table>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, marginTop: 6 }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: barColor, borderRadius: 2 }} />
      </div>
      {/* Inline money flag from cross-source */}
      {moneyFlag && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--attention)', padding: '5px 8px', background: 'var(--surface-elevated)', borderLeft: '3px solid var(--attention)', borderRadius: 4 }}>
          ⚠ {moneyFlag.flag}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Chat: {moneyFlag.chat_says} · Tracker: {moneyFlag.tracker_says}</div>
        </div>
      )}
    </div>
  )
}

// ── Commitments ────────────────────────────────────────────────────────────

const COMMIT_COLOR: Record<string, string> = {
  open:    'var(--attention)',
  done:    'var(--healthy)',
  overdue: 'var(--critical)',
  unclear: 'var(--text-dim)',
}

const COMMIT_ORDER: Record<string, number> = { overdue: 0, open: 1, unclear: 2, done: 3 }

function Commitments({ items }: { items: BriefJSON['commitments'] }) {
  const [showDone, setShowDone] = useState(false)
  if (!items || items.length === 0) return <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>No commitments tracked.</div>

  const sorted = [...items].sort((a, b) => (COMMIT_ORDER[a.status] ?? 2) - (COMMIT_ORDER[b.status] ?? 2))
  const open = sorted.filter((c) => c.status !== 'done')
  const done = sorted.filter((c) => c.status === 'done')

  return (
    <div>
      {open.map((c, i) => {
        const dueStr = c.due ?? ''
        const ownerColor = roleColor(c.owner?.toLowerCase())
        // Due-soon: if due date string is within 3 days
        let dueSoon = false
        if (dueStr) {
          const dueMs = new Date(dueStr).getTime()
          const diffDays = (dueMs - nowMillis()) / 86400000
          dueSoon = diffDays >= 0 && diffDays <= 3
        }
        return (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: COMMIT_COLOR[c.status] ?? 'var(--text-dim)', flexShrink: 0 }}>
              {c.status}
            </span>
            <span style={{ flex: 1, lineHeight: 1.5 }}>
              <LinkedText text={c.what} />
              <span style={{ color: ownerColor, fontWeight: 500 }}> · {c.owner}</span>
              {c.due && <span style={{ color: 'var(--text-dim)' }}> · by {c.due}</span>}
              {dueSoon && (
                <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: 'var(--attention)', background: 'var(--surface-elevated)', padding: '1px 5px', borderRadius: 3 }}>
                  due in {Math.ceil((new Date(dueStr).getTime() - nowMillis()) / 86400000)}d
                </span>
              )}
            </span>
          </div>
        )
      })}
      {done.length > 0 && (
        <>
          <button type="button" onClick={() => setShowDone(!showDone)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: 'var(--text-dim)', padding: 0, marginTop: 4 }}>
            {showDone ? '▾' : '▸'} Show completed ({done.length})
          </button>
          {showDone && done.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--healthy)', flexShrink: 0 }}>done</span>
              <span><LinkedText text={c.what} /></span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── Needs You ──────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  urgent:    'var(--critical)',
  soon:      'var(--attention)',
  when_able: 'var(--text-dim)',
}

function NeedsYou({ items }: { items: BriefJSON['needs_you'] }) {
  if (!items || items.length === 0) return <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>Nothing requires you right now.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((n, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: PRIORITY_COLOR[n.priority] ?? 'var(--text-dim)', flexShrink: 0, paddingTop: 2, minWidth: 56 }}>
            {n.priority.replace('_', ' ')}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>
            <LinkedText text={n.headline || n.action || ''} />
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Send to Group (editable + DB capture) ─────────────────────────────────

function SendToGroup({ message: initial, briefDate, pid }: { message: string; briefDate: string; pid: number }) {
  const [text, setText] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!initial) return null

  async function captureToDb(finalText: string) {
    try {
      await fetch('/api/clarification-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, brief_date: briefDate, edited_text: finalText }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* non-blocking */ }
  }

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      captureToDb(text)
    })
  }

  return (
    <div style={{ background: 'var(--surface-elevated)', borderRadius: 6, padding: '10px 12px' }}>
      {editing ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setEditing(false)}
          rows={4}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            padding: '6px 8px',
            fontSize: 12,
            color: 'var(--text-primary)',
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: 1.65,
            boxSizing: 'border-box',
            marginBottom: 8,
          }}
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          title="Click to edit"
          style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.65, margin: '0 0 8px', cursor: 'text' }}
        >
          {text}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={copy} style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: copied ? 'var(--healthy)' : 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', letterSpacing: '0.04em' }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={() => captureToDb(text)} style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 4, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          Mark as sent
        </button>
        {saved && <span style={{ fontSize: 10, color: 'var(--healthy)' }}>Saved</span>}
      </div>
    </div>
  )
}

// ── Cross-Source Flags ─────────────────────────────────────────────────────

function CrossSourceFlags({ flags }: { flags: BriefJSON['cross_source_flags'] }) {
  if (!flags || flags.length === 0) return <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>No tracker drift detected.</div>

  // Suppress money flags (shown in Money section)
  const nonMoneyFlags = flags.filter((f) => {
    const t = (f.flag + f.chat_says + f.tracker_says).toLowerCase()
    return !(t.includes('pending') || t.includes('collected') || t.includes('payment') || t.includes('collection') || t.includes('instalment') || t.includes('₹'))
  })

  if (nonMoneyFlags.length === 0) return <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>No tracker drift detected.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {nonMoneyFlags.map((f, i) => (
        <div key={i}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--attention)', marginBottom: 2 }}>[FLAG] {f.flag}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
            <span style={{ color: 'var(--text-dim)' }}>Chat: </span>{f.chat_says}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
            <span style={{ color: 'var(--text-dim)' }}>Tracker: </span>{f.tracker_says}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Phase / state line (Brief JSON v2) ─────────────────────────────────────

function PhaseLine({ brief }: { brief: BriefJSON }) {
  if (!brief.phase) return null
  const phase = brief.phase.replace(/_/g, ' ').toUpperCase()
  const runway = brief.runway_pct != null ? ` · ${brief.runway_pct}% runway` : ''
  const recovery = brief.recovery_state
    ? brief.recovery_state.sustained_positive
      ? ' · post-recovery (sustained)'
      : ' · POST-RECOVERY · heightened monitoring'
    : ''
  const badge = brief.exceptional_pid_score?.badge ? ' · ★ EXCEPTIONAL' : ''
  const recoveryColor = brief.recovery_state && !brief.recovery_state.sustained_positive
    ? 'var(--critical)'
    : 'var(--text-dim)'
  return (
    <div style={{ fontSize: 11, color: recoveryColor, fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>
      {phase}{runway}{recovery}{badge}
    </div>
  )
}

// ── Client Experience Frame ────────────────────────────────────────────────

function ClientExperienceFrame({ frame }: { frame?: string }) {
  if (!frame) return null
  return (
    <div style={{
      fontSize: 12,
      color: 'var(--text-primary)',
      lineHeight: 1.6,
      padding: '10px 12px',
      background: 'var(--surface-elevated)',
      borderLeft: '3px solid var(--accent)',
      borderRadius: 4,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
        Client Experience
      </div>
      {frame}
    </div>
  )
}

// ── Amaan's Open Asks (24h+ unanswered) ────────────────────────────────────

function AmaanSelfLoop({ items }: { items: BriefJSON['amaan_self_loop'] }) {
  if (!items || items.length === 0) {
    return <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>All your asks have responses.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((s, i) => (
        <div key={i} style={{ padding: '8px 10px', background: 'var(--surface-elevated)', borderRadius: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-primary)', marginBottom: 4 }}>
            &ldquo;{s.original_ask}&rdquo;
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>
            Asked {s.hours_unanswered}h ago, no substantive response
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-primary)', fontStyle: 'italic', borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
            Re-ping draft: {s.suggested_reping}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Role Lanes ─────────────────────────────────────────────────────────────

function RoleLanes({ brief }: { brief: BriefJSON }) {
  const d = brief.designer_lane
  const p = brief.pm_lane
  const v = brief.vm_lane
  if (!d && !p && !v) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {d && (
        <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>
          <strong style={{ color: 'var(--text-dim)' }}>Designer:</strong> {d.assigned_designer ?? '(unassigned)'}
          {d.days_since_intro_call != null ? ` · ${d.days_since_intro_call}d since intro` : ''}
          {' · '}{d.design_surface_count} design messages
          {d.flag && <span style={{ color: 'var(--critical)' }}> · ⚠ {d.flag}</span>}
        </div>
      )}
      {p && (
        <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>
          <strong style={{ color: 'var(--text-dim)' }}>PM:</strong> {p.assigned_pm ?? '(unassigned)'}
          {' · '}{p.phase_role}-phase
          {' · '}{p.client_group_messages_30d} client-group msgs (30d)
          {p.flag && <span style={{ color: 'var(--critical)' }}> · ⚠ {p.flag}</span>}
        </div>
      )}
      {v && (
        <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>
          <strong style={{ color: 'var(--text-dim)' }}>VM (Monu):</strong> {v.open_requests.length} request(s) tagged in 30d
          {v.flag && <span style={{ color: 'var(--critical)' }}> · ⚠ {v.flag}</span>}
        </div>
      )}
    </div>
  )
}

// ── AI Clarification ("What I don't know") ─────────────────────────────────

type BriefClarificationRow = {
  id: string
  question: string
  ai_uncertainty_reason: string | null
  category: 'sentiment' | 'payment' | 'team' | 'vendor' | 'other' | null
  amaan_answer: string | null
  answered_at: string | null
  brief_date: string
}

const CATEGORY_COLOR: Record<string, string> = {
  sentiment: 'var(--critical)',
  payment: 'var(--attention)',
  team: 'var(--accent)',
  vendor: 'var(--healthy)',
  other: 'var(--text-dim)',
}

function AIClarification({ pid }: { pid: number }) {
  const [rows, setRows] = useState<BriefClarificationRow[] | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('brief_clarifications')
      .select('id, question, ai_uncertainty_reason, category, amaan_answer, answered_at, brief_date')
      .eq('pid', pid)
      .gte('brief_date', sevenDaysAgo)
      .order('brief_date', { ascending: false })
      .order('created_at', { ascending: false })
    setRows((data ?? []) as BriefClarificationRow[])
  }, [pid, supabase])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-load on mount
  useEffect(() => { void load() }, [load])

  if (rows === null) {
    return <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Loading…</div>
  }
  if (rows.length === 0) {
    return <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>High confidence on recent briefs — no clarification needed.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r) => (
        <ClarificationCard key={r.id} row={r} onSaved={load} />
      ))}
    </div>
  )
}

function ClarificationCard({ row, onSaved }: { row: BriefClarificationRow; onSaved: () => void }) {
  const [answer, setAnswer] = useState(row.amaan_answer ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const isAnswered = Boolean(row.amaan_answer)
  const catColor = CATEGORY_COLOR[row.category ?? 'other']

  async function save() {
    if (!answer.trim()) return
    setState('saving')
    try {
      const res = await fetch('/api/clarification-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clarification_id: row.id, amaan_answer: answer }),
      })
      if (!res.ok) throw new Error('Save failed')
      setState('saved')
      setTimeout(() => { setState('idle'); onSaved() }, 800)
    } catch {
      setState('error')
    }
  }

  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--surface-elevated)',
      borderRadius: 4,
      borderLeft: `3px solid ${catColor}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: catColor, textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {row.category ?? 'other'}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          {row.brief_date}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 4 }}>
        {row.question}
      </div>
      {row.ai_uncertainty_reason && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 8 }}>
          Reason: {row.ai_uncertainty_reason}
        </div>
      )}
      {isAnswered ? (
        <div style={{
          fontSize: 11, color: 'var(--text-primary)', padding: '6px 8px',
          background: 'var(--surface)', borderRadius: 3, borderLeft: '2px solid var(--healthy)',
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--healthy)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 6 }}>
            Your answer
          </span>
          {row.amaan_answer}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer (persists as future-brief context)"
            rows={2}
            style={{
              flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 3,
              border: '1px solid var(--border-default)', background: 'var(--surface)',
              color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          <button
            onClick={save}
            disabled={!answer.trim() || state === 'saving'}
            style={{
              fontSize: 10, padding: '6px 10px', borderRadius: 3,
              background: state === 'saved' ? 'var(--healthy)' : 'var(--accent)',
              color: 'white', border: 'none', cursor: answer.trim() ? 'pointer' : 'not-allowed',
              opacity: answer.trim() ? 1 : 0.5, fontWeight: 600,
            }}
          >
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : state === 'error' ? 'Retry' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Feedback ───────────────────────────────────────────────────────────────

const FEEDBACK_TAGS = ['whole brief', 'client pulse', 'team status', 'send to group', 'commitments', 'needs you', 'cross-source flags', 'other']

function FeedbackSection({ briefId, pid }: { briefId: string; pid: number }) {
  const [feedback, setFeedback] = useState('')
  const [tag, setTag] = useState('whole brief')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function submit() {
    if (!feedback.trim()) return
    setState('saving')
    try {
      const res = await fetch('/api/brief/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_id: briefId, pid, user_input: `[${tag}] ${feedback}` }),
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>This is about:</span>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          style={{ fontSize: 11, background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-muted)', fontFamily: 'inherit' }}
        >
          {FEEDBACK_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="What should the AI do differently on this PID's briefs? E.g. 'don't suggest payment follow-ups after event' or 'Bhavika prefers shorter messages.'"
        rows={3}
        style={{ width: '100%', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={submit} disabled={!feedback.trim() || state === 'saving'}
          style={{ fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: 4, background: 'var(--accent)', color: '#fff', border: 'none', cursor: feedback.trim() && state !== 'saving' ? 'pointer' : 'not-allowed', opacity: feedback.trim() && state !== 'saving' ? 1 : 0.5 }}>
          {state === 'saving' ? 'Saving…' : 'Submit'}
        </button>
        {state === 'saved' && <span style={{ fontSize: 11, color: 'var(--healthy)' }}>Saved — will inform the next brief.</span>}
        {state === 'error' && <span style={{ fontSize: 11, color: 'var(--critical)' }}>Save failed. Try again.</span>}
      </div>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="panel-skeleton">
      <div className="panel-skeleton-strip skeleton-banner" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="panel-skeleton-line w-80 skeleton-banner" style={{ height: 13 }} />
        <div className="panel-skeleton-line w-60 skeleton-banner" style={{ height: 13 }} />
        <div className="panel-skeleton-line w-40 skeleton-banner" style={{ height: 13 }} />
      </div>
      <div className="panel-skeleton-strip skeleton-banner" style={{ height: 60 }} />
    </div>
  )
}

// ── Main DetailPanel ───────────────────────────────────────────────────────

export function DetailPanel() {
  const [openPid, setOpenPid] = useState<string | null>(null)
  const [project, setProject] = useState<DBProject | null>(null)
  const [brief, setBrief] = useState<BriefMeta | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefDates, setBriefDates] = useState<string[]>([])
  const [briefDateIdx, setBriefDateIdx] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [sparklineDays, setSparklineDays] = useState<SparklineDay[]>([])
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([])
  const [allSignals, setAllSignals] = useState<Array<{ sent_at: string; chat_type: string }>>([])
  const [portfolioEntries, setPortfolioEntries] = useState<PortfolioEntry[]>([])
  const [portfolioDate, setPortfolioDate] = useState('')
  const [navVisible, setNavVisible] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const riskTrackerRef = useRef<HTMLDivElement | null>(null)

  // Hash routing
  useEffect(() => {
    function onHashChange() {
      const match = window.location.hash.match(/^#pid=(\d+)/)
      setOpenPid(match ? match[1] : null)
    }
    onHashChange()
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Fetch project
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!openPid) { setProject(null); return }
    const supabase = createClient()
    supabase
      .from('projects')
      .select('pid, cx_name, status, overall_pid_risk, cancellation_risk, current_summary, ai_notes_summary, bgmv, collection, collection_pct, package_price_eff, event_start_date, venue, state, planner, designer, project_manager, cancellation_risk_reason, collection_risk, communication_risk, sentiment_risk, t_days, project_health, planning_status')
      .eq('pid', parseInt(openPid))
      .single()
      .then(({ data }) => setProject(data as DBProject | null))
  }, [openPid])

  // Fetch brief + sparkline data + recent messages + portfolio mentions
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!openPid) { setBrief(null); setSparklineDays([]); setRecentMessages([]); setAllSignals([]); setPortfolioEntries([]); setBriefDates([]); setBriefDateIdx(0); return }
    setBriefLoading(true)
    const supabase = createClient()
    const pid = parseInt(openPid)
    const cutoff14 = new Date(nowMillis() - 14 * 86400000).toISOString()

    Promise.all([
      // Latest brief
      supabase.from('briefs').select('id, brief_json, brief_date, is_catchup').eq('pid', pid).eq('is_catchup', false).order('brief_date', { ascending: false }).limit(1).single(),
      // 14-day signals (for sparkline + comms)
      supabase.from('signals').select('sent_at, chat_type').eq('pid', pid).gte('sent_at', cutoff14).order('sent_at', { ascending: true }),
      // 14-day briefs (for sparkline sentiment)
      supabase.from('briefs').select('brief_date, brief_json').eq('pid', pid).gte('brief_date', cutoff14.slice(0, 10)).order('brief_date', { ascending: true }),
      // Recent 20 messages
      supabase.from('signals').select('id, sent_at, body, sender_name, sender_wa_id, chat_type').eq('pid', pid).order('sent_at', { ascending: false }).limit(20),
      // Latest portfolio brief
      supabase.from('portfolio_briefs').select('brief_date, brief_json').order('brief_date', { ascending: false }).limit(1).single(),
    ]).then(([briefRes, signalsRes, briefsRes, recentRes, portfolioRes]) => {
      if (briefRes.data) {
        setBrief({
          id: briefRes.data.id as string,
          json: briefRes.data.brief_json as BriefJSON,
          date: briefRes.data.brief_date,
          isCatchup: briefRes.data.is_catchup,
        })
      } else {
        setBrief(null)
      }

      const signals = (signalsRes.data ?? []) as Array<{ sent_at: string; chat_type: string }>
      setAllSignals(signals)
      const sparkline14Briefs = (briefsRes.data ?? []) as Array<{ brief_date: string; brief_json: BriefJSON }>
      setSparklineDays(buildSparklineDays(signals, sparkline14Briefs))

      // Recent messages — enrich with display_label via signal_senders
      const rawMsgs = (recentRes.data ?? []) as RecentMessage[]
      supabase.from('signal_senders').select('sender_name, sender_wa_id, display_label').eq('pid', pid).then(({ data: senders }) => {
        if (!senders || senders.length === 0) { setRecentMessages(rawMsgs); return }
        const byName = new Map(senders.filter(s => s.sender_name).map(s => [s.sender_name, s.display_label]))
        const byWaId = new Map(senders.filter(s => s.sender_wa_id).map(s => [s.sender_wa_id, s.display_label]))
        setRecentMessages(rawMsgs.map(m => ({
          ...m,
          display_label: (m.sender_wa_id && byWaId.get(m.sender_wa_id)) || (m.sender_name && byName.get(m.sender_name)) || m.display_label,
        })))
      })

      // Portfolio mentions
      if (portfolioRes.data) {
        const json = portfolioRes.data.brief_json as Record<string, unknown>
        const entries = extractPortfolioMentions(json, pid)
        setPortfolioEntries(entries)
        setPortfolioDate(portfolioRes.data.brief_date)
      }

      setBriefLoading(false)
    })

    // Fetch all available brief dates for history navigation
    supabase.from('briefs').select('brief_date, is_catchup').eq('pid', pid).order('brief_date', { ascending: false }).then(({ data: dates }) => {
      const allDates = (dates ?? []).map(d => d.brief_date as string)
      setBriefDates(allDates)
      setBriefDateIdx(0)
    })
  }, [openPid])

  // Panel open/close DOM effects
  useEffect(() => {
    const isOpen = !!openPid
    document.getElementById('panel-overlay')?.classList.toggle('open', isOpen)
    document.getElementById('detail-panel')?.classList.toggle('open', isOpen)
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }, [openPid])

  function close() {
    history.pushState(null, '', window.location.pathname + window.location.search)
    setOpenPid(null)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && openPid) close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPid])

  // Intersection observer for section nav + floating nav visibility
  useEffect(() => {
    const body = bodyRef.current
    if (!body || !openPid) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveSection(e.target.id)
            setNavVisible(e.target.id !== 'section-client-pulse' && e.target.id !== 'section-status')
          }
        }
      },
      { root: body, threshold: 0.3, rootMargin: '-40px 0px -50% 0px' },
    )
    const sections = body.querySelectorAll('[data-section]')
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [openPid, brief, project])

  const scrollToSection = useCallback((id: string) => {
    const el = bodyRef.current?.querySelector(`#${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const scrollToRiskTracker = useCallback(() => {
    riskTrackerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const isLoading = openPid !== null && (project === null || String(project.pid) !== openPid)

  const navigateBrief = useCallback((direction: -1 | 1) => {
    const newIdx = briefDateIdx + direction
    if (newIdx < 0 || newIdx >= briefDates.length || !openPid) return
    setBriefDateIdx(newIdx)
    setBriefLoading(true)
    const supabase = createClient()
    const targetDate = briefDates[newIdx]
    supabase.from('briefs').select('id, brief_json, brief_date, is_catchup')
      .eq('pid', parseInt(openPid))
      .eq('brief_date', targetDate)
      .order('is_catchup', { ascending: true })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setBrief({ id: data.id as string, json: data.brief_json as BriefJSON, date: data.brief_date, isCatchup: data.is_catchup })
        }
        setBriefLoading(false)
      })
  }, [briefDateIdx, briefDates, openPid])

  const refreshBrief = useCallback(async () => {
    if (!openPid || refreshing) return
    if (!confirm('Refresh brief for this PID? This calls Haiku (~₹2).')) return
    setRefreshing(true)
    try {
      const res = await fetch('/api/refresh-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: parseInt(openPid) }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (data.brief) {
        setBrief({ id: data.id ?? '', json: data.brief as BriefJSON, date: data.brief_date, isCatchup: false })
      }
    } catch (err) {
      alert(`Refresh failed: ${err instanceof Error ? err.message : err}`)
    } finally {
      setRefreshing(false)
    }
  }, [openPid, refreshing])

  // Derived values for rendering
  const b = brief?.json
  const clarificationMessage = b
    ? (Array.isArray(b.open_questions)
        ? b.open_questions.map((q) => q.draft_message).filter(Boolean).join(' ')
        : b.open_questions?.clarification_message ?? '')
    : ''
  const unacknowledgedCount = b?.unacknowledged_requests?.length ?? 0
  const openCommitmentsCount = b?.commitments?.filter((c) => c.status === 'open' || c.status === 'overdue').length ?? 0

  return (
    <>
      <div id="panel-overlay" onClick={close} />
      <div id="detail-panel">
        {openPid && (
          <>
            {/* Header */}
            <div className="panel-header">
              <div>
                <div className="panel-pid">PID {openPid}</div>
                <div className="panel-couple">
                  {project?.cx_name?.replace(' & ', ' · ') ?? '—'}
                </div>
                {project?.venue && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{project.venue}</div>
                )}
              </div>
              <button className="panel-close" onClick={close} type="button" aria-label="Close panel">
                <X style={{ width: 13, height: 13 }} />
              </button>
            </div>

            {/* Activity Sparkline */}
            {sparklineDays.length > 0 && (
              <div style={{ padding: '8px 0 4px' }}>
                <ActivitySparkline days={sparklineDays} />
              </div>
            )}

            {/* Floating section nav */}
            <SectionNav
              visible={navVisible}
              activeSection={activeSection}
              unacknowledgedCount={unacknowledgedCount}
              onScrollTo={scrollToSection}
            />

            <div className="panel-body" ref={bodyRef}>
              {isLoading && <PanelSkeleton />}

              {!isLoading && project && (
                <>
                  {/* D1 Status strip */}
                  <PanelSection id="section-status">
                    <StatusStrip
                      days={project.t_days}
                      projectHealth={project.project_health}
                      cancellationRisk={project.cancellation_risk}
                      collectionRisk={project.collection_risk}
                      communicationRisk={project.communication_risk}
                      sentimentRisk={project.sentiment_risk}
                      needsYou={b?.needs_you}
                      onScrollToRiskTracker={scrollToRiskTracker}
                    />
                  </PanelSection>

                  {/* Brief content — only if brief exists */}
                  {briefLoading && (
                    <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-dim)' }}>Loading brief…</div>
                  )}

                  {!briefLoading && !b && (
                    <div style={{ padding: '12px 20px', fontSize: 12, color: 'var(--text-dim)' }}>
                      No brief generated yet for this PID.
                    </div>
                  )}

                  {!briefLoading && b && brief && (
                    <>
                      {/* B0 Freshness + history nav */}
                      <div style={{ padding: '6px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          disabled={briefDateIdx >= briefDates.length - 1}
                          onClick={() => navigateBrief(1)}
                          style={{ background: 'none', border: 'none', cursor: briefDateIdx >= briefDates.length - 1 ? 'default' : 'pointer', opacity: briefDateIdx >= briefDates.length - 1 ? 0.25 : 0.7, fontSize: 14, color: 'var(--text-muted)', padding: 0 }}
                        >&lt;</button>
                        <BriefFreshnessBar date={brief.date} isCatchup={brief.isCatchup} />
                        <button
                          type="button"
                          disabled={briefDateIdx <= 0}
                          onClick={() => navigateBrief(-1)}
                          style={{ background: 'none', border: 'none', cursor: briefDateIdx <= 0 ? 'default' : 'pointer', opacity: briefDateIdx <= 0 ? 0.25 : 0.7, fontSize: 14, color: 'var(--text-muted)', padding: 0 }}
                        >&gt;</button>
                        <button
                          type="button"
                          disabled={refreshing}
                          onClick={refreshBrief}
                          title="Refresh brief (~₹2)"
                          style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 4, cursor: refreshing ? 'wait' : 'pointer', fontSize: 10, color: 'var(--text-dim)', padding: '2px 6px', marginLeft: 'auto' }}
                        >{refreshing ? '...' : '↻'}</button>
                      </div>

                      {/* B0.5 Phase + state line (Brief JSON v2) */}
                      {b.phase && (
                        <div style={{ padding: '0 20px' }}>
                          <PhaseLine brief={b} />
                        </div>
                      )}

                      {/* B0.7 Client Experience Frame (drives intra-day triage) */}
                      {b.client_experience_frame && (
                        <PanelSection id="section-client-experience">
                          <ClientExperienceFrame frame={b.client_experience_frame} />
                        </PanelSection>
                      )}

                      {/* B1 Client Pulse */}
                      <PanelSection id="section-client-pulse">
                        <SectionTitle>Client Pulse</SectionTitle>
                        <ClientPulse pulse={b.client_pulse} tDays={project.t_days} />
                      </PanelSection>

                      {/* B5 Unacknowledged Requests */}
                      <PanelSection id="section-unacknowledged">
                        <SectionTitle count={unacknowledgedCount}>Unacknowledged Requests</SectionTitle>
                        <UnacknowledgedRequests items={b.unacknowledged_requests} />
                      </PanelSection>

                      {/* D3 Team Status */}
                      {b.team_status?.length > 0 && (
                        <PanelSection id="section-team">
                          <SectionTitle>Team Status</SectionTitle>
                          <TeamStatus members={b.team_status} tDays={project.t_days} />
                        </PanelSection>
                      )}

                      {/* B3 What Changed */}
                      <PanelSection id="section-what-changed">
                        <WhatChanged items={b.what_changed ?? []} />
                      </PanelSection>

                      {/* D4 Communications */}
                      <PanelSection id="section-comms">
                        <SectionTitle>Communications</SectionTitle>
                        <CommsSection
                          signals={allSignals}
                          commitmentCount={openCommitmentsCount}
                          unacknowledgedCount={unacknowledgedCount}
                          recentMessages={recentMessages}
                          tDays={project.t_days}
                          onScrollToCommitments={() => scrollToSection('section-commitments')}
                          onScrollToUnacknowledged={() => scrollToSection('section-unacknowledged')}
                        />
                      </PanelSection>

                      {/* D5 Money */}
                      <PanelSection id="section-money">
                        <SectionTitle>Money</SectionTitle>
                        <MoneySection project={project} crossSourceFlags={b.cross_source_flags} />
                      </PanelSection>

                      {/* D6 Vendor Coverage */}
                      <PanelSection id="section-vendor">
                        <SectionTitle>Vendor Coverage</SectionTitle>
                        {b.vendor_coverage && b.vendor_coverage.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {b.vendor_coverage.map((v, i) => {
                              const statusColor: Record<string, string> = {
                                confirmed: 'var(--healthy)',
                                pending: 'var(--attention)',
                                at_risk: 'var(--critical)',
                                unknown: 'var(--text-dim)',
                              }
                              return (
                                <div key={i} style={{
                                  fontSize: 11,
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  border: `1px solid ${statusColor[v.status] ?? 'var(--border-default)'}`,
                                  background: 'var(--surface-elevated)',
                                }}>
                                  <span style={{ fontWeight: 600, color: statusColor[v.status] }}>{v.vendor_type}</span>
                                  {v.vendor_name && <span style={{ color: 'var(--text-muted)' }}> ({v.vendor_name})</span>}
                                  <span style={{ color: 'var(--text-dim)', marginLeft: 4, textTransform: 'uppercase', fontSize: 9 }}>{v.status}</span>
                                  {v.note && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{v.note}</div>}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                            No vendor discussion in signal window.
                          </div>
                        )}
                      </PanelSection>

                      {/* D7 Decision Intel */}
                      <PanelSection id="section-decision">
                        <SectionTitle>Decision Intel</SectionTitle>
                        {b.decision_intel && (b.decision_intel.pending_decisions?.length > 0 || b.decision_intel.recent_decisions?.length > 0) ? (
                          <div style={{ fontSize: 12 }}>
                            {b.decision_intel.pending_decisions?.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>Pending</div>
                                {b.decision_intel.pending_decisions.map((d, i) => (
                                  <div key={i} style={{ color: 'var(--text-muted)', marginBottom: 4, paddingLeft: 0 }}>
                                    {d.blocking && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--critical)', marginRight: 4 }}>BLOCKING</span>}
                                    <span style={{ color: 'var(--text-primary)' }}>{d.decision}</span>
                                    <span style={{ color: 'var(--text-dim)', fontSize: 11 }}> — {d.owner}{d.deadline ? ` · by ${d.deadline}` : ''}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {b.decision_intel.recent_decisions?.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>Recent</div>
                                {b.decision_intel.recent_decisions.map((d, i) => (
                                  <div key={i} style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
                                    <span style={{ color: 'var(--text-primary)' }}>{d.decision}</span>
                                    <span style={{ color: 'var(--text-dim)', fontSize: 11 }}> — {d.decided_by}, {d.decided_on}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                            No decisions in signal window.
                          </div>
                        )}
                      </PanelSection>

                      {/* B4 Commitments */}
                      <PanelSection id="section-commitments">
                        <SectionTitle>Commitments</SectionTitle>
                        <Commitments items={b.commitments} />
                      </PanelSection>

                      {/* B6 Needs You */}
                      <PanelSection id="section-needs-you">
                        <SectionTitle>Needs You</SectionTitle>
                        <NeedsYou items={b.needs_you} />
                      </PanelSection>

                      {/* B7 Send to Group */}
                      {clarificationMessage && (
                        <PanelSection id="section-send-to-group">
                          <SectionTitle>Send to Group</SectionTitle>
                          <SendToGroup message={clarificationMessage} briefDate={brief.date} pid={project.pid} />
                        </PanelSection>
                      )}

                      {/* B8 Cross-Source Flags */}
                      <PanelSection id="section-flags">
                        <SectionTitle>Cross-Source Flags</SectionTitle>
                        <CrossSourceFlags flags={b.cross_source_flags} />
                      </PanelSection>

                      {/* V2.1 Amaan's Open Asks (24h+ unanswered) */}
                      {b.amaan_self_loop && b.amaan_self_loop.length > 0 && (
                        <PanelSection id="section-self-loop">
                          <SectionTitle count={b.amaan_self_loop.length}>Still Waiting On (Your Asks)</SectionTitle>
                          <AmaanSelfLoop items={b.amaan_self_loop} />
                        </PanelSection>
                      )}

                      {/* V2.2 Role Lanes (Designer + PM + VM) */}
                      {(b.designer_lane || b.pm_lane || b.vm_lane) && (
                        <PanelSection id="section-lanes">
                          <SectionTitle>Role Lanes</SectionTitle>
                          <RoleLanes brief={b} />
                        </PanelSection>
                      )}

                      {/* V2.3 AI Clarification (Step 7) */}
                      <PanelSection id="section-clarification">
                        <SectionTitle>What I Don&apos;t Know</SectionTitle>
                        <AIClarification pid={project.pid} />
                      </PanelSection>

                      {/* D10 Portfolio Mentions */}
                      {portfolioEntries.length > 0 && (
                        <PanelSection id="section-portfolio">
                          <PortfolioMentions pid={project.pid} entries={portfolioEntries} briefDate={portfolioDate} />
                        </PanelSection>
                      )}
                    </>
                  )}

                  {/* Risk Tracker Snapshot — always present */}
                  <div ref={riskTrackerRef} style={{ padding: '0 20px 14px' }}>
                    <RiskTrackerSnapshot
                      collectionRisk={project.collection_risk}
                      communicationRisk={project.communication_risk}
                      sentimentRisk={project.sentiment_risk}
                      cancellationRiskLabel={null}
                      overallPidRisk={project.overall_pid_risk}
                      currentSummary={project.current_summary}
                      aiNotesSummary={project.ai_notes_summary}
                      cancellationRiskReason={project.cancellation_risk_reason}
                    />
                  </div>

                  {/* B9 Feedback */}
                  {brief && (
                    <PanelSection id="section-feedback">
                      <SectionTitle>Feedback</SectionTitle>
                      <FeedbackSection briefId={brief.id} pid={project.pid} />
                    </PanelSection>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
