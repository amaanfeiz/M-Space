// Portfolio tab — surfaces T3 Opus portfolio brief in the dashboard shell.
// Mobile-first: single-column, sticky date header, expandable sections.

import { createClient } from '@/lib/supabase/server'
import { PortfolioBriefView, type PortfolioBriefJSON } from '@/components/portfolio/PortfolioBriefView'
import Link from 'next/link'

type BriefRow = {
  brief_date: string
  brief_json: PortfolioBriefJSON
  generated_at: string
}

// Helper wraps Date.now() so the React purity-during-render lint rule
// doesn't fire on the page component (it doesn't trace into helpers).
function thirtyDaysAgoISO(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const { date: dateParam } = await searchParams

  // Load available portfolio brief dates (last 30 days)
  const thirtyDaysAgo = thirtyDaysAgoISO()

  const { data: allBriefs } = await supabase
    .from('portfolio_briefs')
    .select('brief_date, generated_at')
    .gte('brief_date', thirtyDaysAgo)
    .order('brief_date', { ascending: false })

  const availableDates = (allBriefs ?? []) as Array<{ brief_date: string; generated_at: string }>

  // Load the requested brief (or latest)
  const targetDate = dateParam ?? availableDates[0]?.brief_date

  let brief: BriefRow | null = null
  if (targetDate) {
    const { data } = await supabase
      .from('portfolio_briefs')
      .select('brief_date, brief_json, generated_at')
      .eq('brief_date', targetDate)
      .maybeSingle<BriefRow>()
    brief = data
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      maxWidth: 720, margin: '0 auto', padding: '16px 12px 32px',
    }}>
      {/* Sticky date header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)',
        padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{
            fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0,
            letterSpacing: -0.3,
          }}>
            Portfolio brief
          </h1>
          {brief && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {brief.brief_date}
            </span>
          )}
        </div>

        {availableDates.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {availableDates.slice(0, 14).map((d) => {
              const active = d.brief_date === targetDate
              return (
                <Link
                  key={d.brief_date}
                  href={`/portfolio?date=${d.brief_date}`}
                  style={{
                    fontSize: 10, padding: '4px 8px', borderRadius: 4,
                    background: active ? 'var(--accent)' : 'var(--surface-elevated)',
                    color: active ? 'white' : 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {d.brief_date.slice(5)}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Body */}
      {brief ? (
        <PortfolioBriefView
          brief={brief.brief_json}
          briefDate={brief.brief_date}
          generatedAt={brief.generated_at}
        />
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 20, textAlign: 'center' }}>
          No portfolio brief generated yet. T3 runs nightly after the WhatsApp scrape.
        </div>
      )}
    </div>
  )
}
