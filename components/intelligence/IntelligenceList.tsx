'use client'

import { useMemo, useState } from 'react'
import { BriefCard, type BriefJSON } from './BriefCard'

export interface BriefItem {
  id: string
  pid: number
  briefDate: string
  isCatchup: boolean
  brief: BriefJSON | null
  cxName: string | null
  eventStart: string | null
  eventEnd: string | null
  tDays: number | null
  collectionPct: string | null
  projectHealth: number | null
  isSalesWip?: boolean
  rm?: string | null
}

type SortMode = 'urgency' | 'event-asc' | 'event-desc'

const URGENCY: Record<string, number> = {
  cold: 0, anxious: 1, cautious: 2, neutral: 3, positive: 4,
}

export function IntelligenceList({ items }: { items: BriefItem[] }) {
  const [sort, setSort] = useState<SortMode>('urgency')

  const sorted = useMemo(() => {
    const wip = items.filter((b) => b.isSalesWip)
    const nonWip = items.filter((b) => !b.isSalesWip)
    const active = nonWip.filter((b) => (b.tDays ?? 0) >= -7)
    const executed = nonWip.filter((b) => (b.tDays ?? 0) < -7)

    function sortItems(arr: BriefItem[]): BriefItem[] {
      if (sort === 'urgency') {
        return [...arr].sort((a, b) => {
          const ua = URGENCY[a.brief?.client_pulse?.sentiment ?? 'neutral'] ?? 3
          const ub = URGENCY[b.brief?.client_pulse?.sentiment ?? 'neutral'] ?? 3
          if (ua !== ub) return ua - ub
          const fa = (a.brief?.cross_source_flags?.length ?? 0) + (a.brief?.needs_you?.length ?? 0)
          const fb = (b.brief?.cross_source_flags?.length ?? 0) + (b.brief?.needs_you?.length ?? 0)
          return fb - fa
        })
      }
      return [...arr].sort((a, b) => {
        const da = a.eventStart ? new Date(a.eventStart).getTime() : Infinity
        const db = b.eventStart ? new Date(b.eventStart).getTime() : Infinity
        return sort === 'event-asc' ? da - db : db - da
      })
    }

    return [...sortItems(active), ...executed, ...wip]
  }, [items, sort])

  const firstExecutedIndex = sorted.findIndex((b) => !b.isSalesWip && (b.tDays ?? 0) < -7)
  const firstWipIndex = sorted.findIndex((b) => b.isSalesWip)

  return (
    <>
      {/* Sort control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Sort:</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            padding: '3px 8px',
            cursor: 'pointer',
          }}
        >
          <option value="urgency">Urgency</option>
          <option value="event-asc">Event date ↑</option>
          <option value="event-desc">Event date ↓</option>
        </select>
      </div>

      {/* Brief cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map((b, i) => (
          <div key={b.id}>
            {i === firstExecutedIndex && firstExecutedIndex !== -1 && (
              <Divider label="Past events" />
            )}
            {i === firstWipIndex && firstWipIndex !== -1 && (
              <Divider label="Sales WIP — planning not started" />
            )}
            {b.isSalesWip ? (
              <SalesWipCard pid={b.pid} cxName={b.cxName} rm={b.rm ?? null} eventStart={b.eventStart} tDays={b.tDays} />
            ) : (
              <BriefCard
                briefId={b.id}
                pid={b.pid}
                briefDate={b.briefDate}
                isCatchup={b.isCatchup}
                brief={b.brief!}
                cxName={b.cxName}
                eventStart={b.eventStart}
                eventEnd={b.eventEnd}
                tDays={b.tDays}
                collectionPct={b.collectionPct}
                projectHealth={b.projectHealth}
              />
            )}
          </div>
        ))}
        {sorted.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 0' }}>
            No briefs generated yet. Run <code>npx tsx generate-brief.ts --all-mine --catchup</code> to generate.
          </div>
        )}
      </div>
    </>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        color: 'var(--text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        padding: '10px 0 6px',
        borderTop: '1px solid var(--border-subtle)',
        marginTop: 8,
      }}
    >
      {label}
    </div>
  )
}

function SalesWipCard({ pid, cxName, rm, eventStart, tDays }: {
  pid: number
  cxName: string | null
  rm: string | null
  eventStart: string | null
  tDays: number | null
}) {
  const dateLabel = eventStart
    ? new Date(eventStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
      (tDays != null ? (tDays > 0 ? ` · ${tDays}d away` : tDays === 0 ? ' · today' : ' · past') : '')
    : 'Dates TBC'

  return (
    <div
      className="card"
      style={{
        padding: '10px 14px',
        borderLeft: '3px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-subtle)', flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cxName ?? `PID ${pid}`}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{pid}</span>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>{dateLabel}</span>
      {rm && <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>RM: {rm}</span>}
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', flexShrink: 0 }}>
        no brief
      </span>
    </div>
  )
}
