'use client'

import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PID_DATA } from '@/lib/static/pid_data_static'
import { formatInr } from '@/lib/types/project'
import type { StaticPID } from '@/lib/static/pid_data_static'
import { BriefBody, type BriefJSON } from '@/components/intelligence/BriefBody'
import { BriefFeedback } from '@/components/intelligence/BriefFeedback'

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
}

type BriefMeta = {
  id: string
  json: BriefJSON
  date: string
  isCatchup: boolean
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function levelColor(level: string | null) {
  if (level === 'Critical' || level === 'critical') return 'var(--critical)'
  if (level === 'Attention' || level === 'attention') return 'var(--attention)'
  return 'var(--healthy)'
}

function collectClass(pct: number | null): string {
  if (!pct) return 'money-collected-red'
  if (pct > 40) return 'money-collected-green'
  if (pct > 20) return 'money-collected-amber'
  return 'money-collected-red'
}

function SectionTitle({ children, ai }: { children: React.ReactNode; ai?: boolean }) {
  return (
    <div className="panel-section-title">
      {ai && <div className="panel-ai-dot" />}
      {children}
    </div>
  )
}

function TeamSection({ s }: { s: StaticPID }) {
  return (
    <div>
      <SectionTitle>Team Status</SectionTitle>
      {s.team_status.map((m, i) => (
        <div key={i} className="team-status-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="ts-avatar" style={{ background: m.bg, color: m.color }}>{m.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="ts-name">{m.name}</span>
              <span className="ts-role">· {m.role}</span>
              <span className={`engagement-chip ${m.engagement}`}>{m.engagement}</span>
              {m.carrying_signal === 'Stretched' && (
                <span className="carrying-pill Stretched">Stretched</span>
              )}
            </div>
            <div className="ts-last-action">Last action: {m.last_action}</div>
            <div className="ts-notes">{m.notes}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CommsSection({ s }: { s: StaticPID }) {
  const [open, setOpen] = useState(false)
  const barPct = s.comms.client_chattiness
  const barColor = barPct > 70 ? 'var(--healthy)' : barPct > 40 ? 'var(--accent)' : 'var(--attention)'
  return (
    <div>
      <SectionTitle>Communications</SectionTitle>
      <div className="comms-chattiness-label">
        {s.comms.client_chattiness_label}
        {s.comms.off_channel_indicator && <span className="off-channel-pill" style={{ marginLeft: 8 }}>Off-channel</span>}
      </div>
      <div className="comms-bar-wrap">
        <div style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, minWidth: 20 }}>0</div>
        <div className="comms-bar-track">
          <div className="comms-bar-fill" style={{ width: `${barPct}%`, background: barColor }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, minWidth: 20 }}>100</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
        Last client message: <strong style={{ color: 'var(--text-primary)' }}>{s.comms.last_client_message}</strong>
      </div>
      {s.comms.open_commitments > 0 && (
        <>
          <div
            onClick={() => setOpen(!open)}
            style={{ marginTop: 8, fontSize: 12, cursor: 'pointer', color: 'var(--accent)' }}
          >
            Open commitments: <strong>{s.comms.open_commitments}</strong> ▾
          </div>
          <div className={`commitments-list${open ? ' open' : ''}`}>
            {s.comms.open_commitments_detail.map((c, i) => (
              <div key={i} className="commitment-item">{c}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function VendorSection({ s }: { s: StaticPID }) {
  const icon: Record<string, string> = { confirmed: '✓', in_progress: '·', blocked: '✗', unassigned: '.' }
  return (
    <div>
      <SectionTitle>Vendor Coverage</SectionTitle>
      <div className="vendor-grid">
        {s.vendor_coverage.map((v, i) => (
          <div key={i} className="vendor-pill-wrap">
            <div className={`vendor-pill ${v.status}`}>
              <span>{icon[v.status] ?? '·'}</span>
              <span>{v.vendor_type}</span>
            </div>
            {v.note && <div className="vendor-tooltip">{v.note}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function DecisionSection({ s }: { s: StaticPID }) {
  const velColor = s.decision_intel.velocity === 'fast' ? 'var(--healthy)'
    : s.decision_intel.velocity === 'deliberate' ? 'var(--attention)' : 'var(--text-muted)'
  return (
    <div>
      <SectionTitle>Decision Intel</SectionTitle>
      <div className="decision-velocity" style={{ color: velColor }}>
        {s.decision_intel.velocity.charAt(0).toUpperCase() + s.decision_intel.velocity.slice(1)}
      </div>
      <div className="decision-vel-note">{s.decision_intel.velocity_note}</div>
      <div style={{ marginTop: 10 }}>
        {s.decision_intel.decision_makers.map((dm, i) => (
          <div key={i} className="decision-maker-row">
            <div className="dm-name">{dm.name}</div>
            <div className="dm-role">{dm.role}</div>
            <div className="dm-authority">{dm.authority}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ActionsSection({ s }: { s: StaticPID }) {
  return (
    <div>
      <SectionTitle>Action Items</SectionTitle>
      {s.actions.map((a, i) => (
        <div key={i} className="action-item">
          <input type="checkbox" className="action-cb" readOnly />
          <span className="action-text">{a.text}</span>
          <span className={`pchip-${a.priority}`}>
            {a.priority.charAt(0).toUpperCase() + a.priority.slice(1)}
          </span>
        </div>
      ))}
    </div>
  )
}

function MessagesSection({ s }: { s: StaticPID }) {
  return (
    <div>
      <SectionTitle>Recent Messages</SectionTitle>
      {s.messages.map((m, i) => (
        <div key={i} className={`msg-card${m.negative ? ' negative' : ''}`}>
          <div className="msg-header">
            <div className="msg-avatar" style={{ background: m.bg, color: m.color }}>{m.initials}</div>
            <span className="msg-sender">{m.sender}</span>
            <span className="msg-role">· {m.role}</span>
            <span className="msg-time">{m.time}</span>
          </div>
          <div className="msg-body">{m.body}</div>
        </div>
      ))}
    </div>
  )
}

function TLDirectiveSection({ s }: { s: StaticPID }) {
  return (
    <div>
      <SectionTitle>TL Directive</SectionTitle>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>{s.tl_directive}</div>
    </div>
  )
}

function SuggestedReplySection({ s }: { s: StaticPID }) {
  return (
    <div>
      <SectionTitle>Suggested Reply</SectionTitle>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
        Drafted for <strong style={{ color: 'var(--text-muted)' }}>{s.suggested_client_reply.drafted_for}</strong>
        {' → '}{s.suggested_client_reply.to}
      </div>
      <textarea className="panel-textarea" readOnly defaultValue={s.suggested_client_reply.body} />
      <div className="panel-btn-row">
        <button className="btn-secondary" type="button">Copy</button>
      </div>
    </div>
  )
}

function MoneySection({ p }: { p: DBProject; s: StaticPID | null }) {
  const collected = formatInr(p.collection)
  const pending = p.package_price_eff && p.collection ? formatInr(p.package_price_eff - p.collection) : '—'
  const pct = p.collection_pct ?? 0
  return (
    <div>
      <SectionTitle>Money</SectionTitle>
      <table className="money-table">
        <tbody>
          <tr><td>Package SP</td><td>{formatInr(p.package_price_eff)}</td></tr>
          <tr>
            <td>Collected</td>
            <td>
              <span className={collectClass(p.collection_pct)}>
                {collected} <span style={{ fontSize: 11, fontWeight: 400 }}>({pct.toFixed(1)}%)</span>
              </span>
            </td>
          </tr>
          <tr><td>Pending</td><td>{pending}</td></tr>
        </tbody>
      </table>
    </div>
  )
}

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="panel-skeleton-line w-80 skeleton-banner" style={{ height: 13 }} />
        <div className="panel-skeleton-line w-60 skeleton-banner" style={{ height: 13 }} />
      </div>
    </div>
  )
}

export function DetailPanel() {
  const [openPid, setOpenPid] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'brief' | 'details'>('details')
  const [project, setProject] = useState<DBProject | null>(null)
  const [brief, setBrief] = useState<BriefMeta | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('section-status')
  const bodyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onHashChange() {
      const match = window.location.hash.match(/^#pid=(\d+)(?:&tab=(brief|details))?$/)
      setOpenPid(match ? match[1] : null)
      setActiveTab((match?.[2] as 'brief' | 'details') ?? 'details')
    }
    onHashChange()
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Fetch project data
  useEffect(() => {
    if (!openPid) { setProject(null); return }
    const supabase = createClient()
    supabase
      .from('projects')
      .select('pid, cx_name, status, overall_pid_risk, cancellation_risk, current_summary, ai_notes_summary, bgmv, collection, collection_pct, package_price_eff, event_start_date, venue, state, planner, designer, project_manager, cancellation_risk_reason, collection_risk, communication_risk, sentiment_risk')
      .eq('pid', parseInt(openPid))
      .single()
      .then(({ data }) => {
        setProject(data as DBProject | null)
      })
  }, [openPid])

  // Fetch latest brief for this PID
  useEffect(() => {
    if (!openPid) { setBrief(null); return }
    setBriefLoading(true)
    const supabase = createClient()
    supabase
      .from('briefs')
      .select('id, brief_json, brief_date, is_catchup')
      .eq('pid', parseInt(openPid))
      .order('brief_date', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setBrief({
            id: data.id as string,
            json: data.brief_json as BriefJSON,
            date: data.brief_date,
            isCatchup: data.is_catchup,
          })
        } else {
          setBrief(null)
        }
        setBriefLoading(false)
      })
  }, [openPid])

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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && openPid) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPid])

  const scrollToSection = useCallback((id: string) => {
    const el = bodyRef.current?.querySelector(`#${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    const body = bodyRef.current
    if (!body || !openPid || activeTab !== 'details') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id)
        }
      },
      { root: body, threshold: 0.3, rootMargin: '-40px 0px -50% 0px' },
    )
    const sections = body.querySelectorAll('[data-section]')
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [openPid, project, activeTab])

  const staticData = openPid ? (PID_DATA[openPid] ?? null) : null
  const isLoading = openPid !== null && (project === null || String(project.pid) !== openPid)
  const riskLevel = project?.overall_pid_risk ?? staticData?.statusLevel ?? null
  const days = daysUntil(project?.event_start_date ?? null)
  const riskColor = levelColor(riskLevel)

  const hasAnalysis = !!(staticData?.analysis?.length || project?.current_summary || project?.ai_notes_summary)
  const navItems = [
    { id: 'section-status', label: 'Status', always: true },
    { id: 'section-analysis', label: 'Analysis', always: hasAnalysis },
    { id: 'section-team', label: 'Team', always: !!staticData },
    { id: 'section-money', label: 'Money', always: true },
    { id: 'section-vendor', label: 'Vendor', always: !!staticData },
    { id: 'section-actions', label: 'Actions', always: !!staticData },
    { id: 'section-messages', label: 'Messages', always: !!staticData },
  ].filter((n) => n.always)

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
                  {project?.cx_name?.replace(' & ', ' · ') ?? staticData?.couple ?? '—'}
                </div>
                {project?.venue && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{project.venue}</div>
                )}
              </div>
              <button className="panel-close" onClick={close} type="button" aria-label="Close panel">
                <X style={{ width: 13, height: 13 }} />
              </button>
              <div
                className="panel-header-risk-bar"
                style={{ background: `linear-gradient(90deg, ${riskColor} 0%, ${riskColor}40 50%, transparent 100%)` }}
              />
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', paddingLeft: 20 }}>
              {(['brief', 'details'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: activeTab === tab ? 600 : 400,
                    color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                    background: 'none',
                    border: 'none',
                    borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
                    cursor: 'pointer',
                    marginBottom: -1,
                    fontFamily: 'inherit',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab === 'brief' ? 'Brief' : 'Details'}
                </button>
              ))}
            </div>

            {/* Section nav — Details tab only */}
            {activeTab === 'details' && !isLoading && project && (
              <nav className="panel-section-nav" aria-label="Panel sections">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`panel-nav-btn${activeSection === item.id ? ' active' : ''}`}
                    onClick={() => scrollToSection(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            )}

            <div className="panel-body" ref={bodyRef}>
              {/* ── Brief tab ── */}
              {activeTab === 'brief' && (
                <div style={{ padding: '16px 0' }}>
                  {briefLoading && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading brief…</div>
                  )}
                  {!briefLoading && brief && (
                    <>
                      <BriefBody brief={brief.json} briefDate={brief.date} isCatchup={brief.isCatchup} />
                      <BriefFeedback briefId={brief.id} pid={parseInt(openPid)} />
                    </>
                  )}
                  {!briefLoading && !brief && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      No brief generated yet for this PID.
                    </div>
                  )}
                </div>
              )}

              {/* ── Details tab ── */}
              {activeTab === 'details' && (
                <>
                  {isLoading && <PanelSkeleton />}
                  {!isLoading && project && (
                    <>
                      <div id="section-status" data-section className="panel-section-anchor">
                        <div className="panel-strip-row">
                          {days !== null && (
                            <div>
                              <div className="panel-days-countdown" style={{ color: riskColor }}>{days}</div>
                              <div className="panel-days-label">Days to event</div>
                            </div>
                          )}
                          <div className="panel-health-badge">
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: riskColor, boxShadow: `0 0 8px ${riskColor}40` }} />
                            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {riskLevel ?? 'unknown'}
                            </div>
                          </div>
                          {staticData && (
                            <div className="risk-pills">
                              {staticData.risk_vectors.map((r, i) => (
                                <span key={i} className={`risk-pill ${r.severity}`}>{r.label}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {hasAnalysis && (
                        <div id="section-analysis" data-section className="panel-section-anchor">
                          <SectionTitle ai>AI Analysis</SectionTitle>
                          <div className="panel-analysis">
                            {staticData?.analysis?.map((para, i) => (
                              <p key={i} dangerouslySetInnerHTML={{ __html: para }} />
                            ))}
                            {!staticData && project.current_summary && <p>{project.current_summary}</p>}
                            {!staticData && project.ai_notes_summary && <p>{project.ai_notes_summary}</p>}
                          </div>
                        </div>
                      )}

                      <div className="panel-2col">
                        <div className="panel-col">
                          {staticData && (
                            <div id="section-team" data-section className="panel-section-anchor">
                              <TeamSection s={staticData} />
                            </div>
                          )}
                          {staticData && <CommsSection s={staticData} />}
                          <div id="section-money" data-section className="panel-section-anchor">
                            <MoneySection p={project} s={staticData} />
                          </div>
                        </div>
                        <div className="panel-col">
                          {staticData && (
                            <div id="section-vendor" data-section className="panel-section-anchor">
                              <VendorSection s={staticData} />
                            </div>
                          )}
                          {staticData && <DecisionSection s={staticData} />}
                          {staticData && (
                            <div id="section-actions" data-section className="panel-section-anchor">
                              <ActionsSection s={staticData} />
                            </div>
                          )}
                        </div>
                      </div>

                      {staticData && (
                        <div id="section-messages" data-section className="panel-section-anchor">
                          <MessagesSection s={staticData} />
                        </div>
                      )}
                      {staticData && <TLDirectiveSection s={staticData} />}
                      {staticData && <SuggestedReplySection s={staticData} />}
                    </>
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
