'use client'

import { formatCouple, formatInr, riskDotClass } from '@/lib/types/project'
import type { ProjectAssignment, TeamGroup } from '@/lib/static/teams_static'

type Props = {
  teams: TeamGroup[]
  outliers: ProjectAssignment[]
}

function eventLabel(date: string | null): string {
  if (!date) return 'TBA'
  return new Date(date).toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
  })
}

function MemberPill({
  role,
  name,
  initials,
  color,
}: {
  role: string
  name: string | null
  initials: string
  color: string
}) {
  const isUnassigned = !name
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 6,
        background: isUnassigned ? 'var(--surface-elevated)' : 'transparent',
        border: isUnassigned
          ? '1px dashed var(--border-default)'
          : '1px solid var(--border-subtle)',
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: isUnassigned ? 'var(--surface)' : `${color}26`,
          color: isUnassigned ? 'var(--text-dim)' : color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 10,
          flexShrink: 0,
          border: isUnassigned ? '1px dashed var(--border-default)' : 'none',
        }}
      >
        {initials}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            lineHeight: 1.2,
          }}
        >
          {role}
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: isUnassigned ? 'var(--text-dim)' : 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
        >
          {name ?? 'TBA'}
        </div>
      </div>
    </div>
  )
}

function ProjectRow({ p }: { p: { pid: number; cx_name: string | null; overall_pid_risk: string | null; bgmv: number | null; event_start_date: string | null; coverage?: 'full' | 'partial' } }) {
  return (
    <div
      onClick={() => {
        window.location.hash = `#pid=${p.pid}`
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background 150ms ease-out',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-elevated)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span className={`status-dot ${riskDotClass(p.overall_pid_risk)}`} />
      <span
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          color: 'var(--text-dim)',
          minWidth: 52,
        }}
      >
        {p.pid}
      </span>
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          fontWeight: 500,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {formatCouple(p.cx_name)}
      </span>
      {p.coverage === 'partial' && (
        <span
          title="Mixed team coverage — some roles differ from canonical team"
          style={{
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 3,
            background: 'rgba(202,138,4,0.10)',
            color: 'var(--attention)',
            border: '1px solid rgba(202,138,4,0.20)',
            letterSpacing: '0.04em',
          }}
        >
          MIXED
        </span>
      )}
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 56,
          textAlign: 'right',
        }}
      >
        {eventLabel(p.event_start_date)}
      </span>
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 56,
          textAlign: 'right',
        }}
      >
        {formatInr(p.bgmv)}
      </span>
    </div>
  )
}

export function TeamView({ teams, outliers }: Props) {
  return (
    <>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          Team
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 2,
          }}
        >
          4 destination teams · {teams.reduce((s, t) => s + t.projects.length, 0)} canonical projects
          {outliers.length > 0 && ` · ${outliers.length} outliers`}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        {teams.map((t) => (
          <div key={t.team.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                {t.team.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {t.projects.length} {t.projects.length === 1 ? 'project' : 'projects'} · {formatInr(t.bgmvTotal)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <MemberPill
                role="Planner"
                name={t.team.planner.name}
                initials={t.team.planner.initials}
                color={t.team.planner.color}
              />
              <MemberPill
                role="Designer"
                name={t.team.designer.name}
                initials={t.team.designer.initials}
                color={t.team.designer.color}
              />
              <MemberPill
                role="PM"
                name={t.team.pm.name}
                initials={t.team.pm.initials}
                color={t.team.pm.color}
              />
            </div>

            {t.projects.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {t.projects.map((p) => (
                  <ProjectRow key={p.pid} p={p} />
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  padding: '8px 10px',
                  textAlign: 'center',
                  background: 'var(--surface-elevated)',
                  borderRadius: 6,
                }}
              >
                No active projects
              </div>
            )}
          </div>
        ))}
      </div>

      {outliers.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div className="eyebrow">Outliers · Cross-team or unmapped</div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {outliers.length} {outliers.length === 1 ? 'project' : 'projects'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {outliers.map((p) => (
              <ProjectRow key={p.pid} p={p} />
            ))}
          </div>
        </div>
      )}
      <div style={{ height: 8 }} />
    </>
  )
}
