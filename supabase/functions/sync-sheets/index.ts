import { createClient } from 'jsr:@supabase/supabase-js@2'

const RISK_TRACKER_ID = '1NczQ85_5pZAHKQW_Ctie5pc2I16xrew1fTchb1HF6y0'
const LIVE_TRACKER_ID = '1ThBvoiszNBrA6jHBENqknUMcI3gZTwMmvtb_GAxNXOM'

// Risk Tracker: headers in row 2 (row 1 is refresh timestamp)
const RISK_RANGE = 'Raw_Data!A2:ZZ500'
// Live Tracker: headers in row 1, data starts col B (col A is refresh button)
const LIVE_RANGE = "'Live Tracker'!A1:ZZ500"

// ── Google auth ───────────────────────────────────────────────────────────────

async function getAccessToken(saKey: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: saKey.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signingInput = `${encode(header)}.${encode(payload)}`
  const keyData = saKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt = `${signingInput}.${sig}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`)
  return data.access_token
}

async function fetchSheet(sheetId: string, range: string, token: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.values ?? []
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function buildHeaderMap(headerRow: string[]): Map<string, number> {
  const m = new Map<string, number>()
  headerRow.forEach((h, i) => {
    // normalise: lowercase, collapse whitespace and newlines, trim
    const key = h.replace(/[\r\n]+/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ')
    if (key && !m.has(key)) m.set(key, i) // first occurrence wins
  })
  return m
}

function col(row: string[], headers: Map<string, number>, name: string): string {
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ')
  const idx = headers.get(key)
  return idx !== undefined ? (row[idx] ?? '').trim() : ''
}

function parsePid(raw: string): number | null {
  const n = parseInt(raw.replace(/,/g, '').trim(), 10)
  return isNaN(n) ? null : n
}

function parseNum(raw: string | undefined): number | null {
  if (!raw) return null
  const n = parseFloat(raw.replace(/,/g, '').replace(/%/g, '').trim())
  return isNaN(n) ? null : n
}

function parseDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()
  const parts = s.split(/[\/\-]/)
  if (parts.length !== 3) return null
  if (parts[0].length === 4) return s // already YYYY-MM-DD
  const [d, m, y] = parts
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: logRow } = await supabase
    .from('sync_log').insert({ status: 'running' }).select('id').single()
  const logId = logRow?.id

  async function finishLog(status: 'success' | 'error', rowsUpserted?: number, errorMessage?: string) {
    await supabase.from('sync_log').update({
      status, finished_at: new Date().toISOString(),
      rows_upserted: rowsUpserted ?? null,
      error_message: errorMessage ?? null,
    }).eq('id', logId)
  }

  try {
    const saKeyRaw = Deno.env.get('GOOGLE_SHEETS_SA_KEY')
    if (!saKeyRaw) throw new Error('GOOGLE_SHEETS_SA_KEY secret not set')
    const saKey = JSON.parse(saKeyRaw)
    const token = await getAccessToken(saKey)

    const [riskRows, liveRows] = await Promise.all([
      fetchSheet(RISK_TRACKER_ID, RISK_RANGE, token),
      fetchSheet(LIVE_TRACKER_ID, LIVE_RANGE, token),
    ])

    if (riskRows.length < 2) throw new Error('Risk Tracker: no data rows found')
    if (liveRows.length < 2) throw new Error('Live Tracker: no data rows found')

    const rh = buildHeaderMap(riskRows[0])
    const lh = buildHeaderMap(liveRows[0])

    // Build Live Tracker index: pid → row
    const liveByPid = new Map<number, string[]>()
    for (const row of liveRows.slice(1)) {
      const pid = parsePid(col(row, lh, 'pid no'))
      if (pid) liveByPid.set(pid, row)
    }

    const upsertRows: Record<string, unknown>[] = []

    for (const row of riskRows.slice(1)) {
      const pid = parsePid(col(row, rh, 'pid'))
      if (!pid) continue

      const live = liveByPid.get(pid)

      upsertRows.push({
        pid,
        // ── Live Tracker fields (source of truth for CRM) ──
        cx_name:           live ? col(live, lh, 'cx name') || null : null,
        cx_name_studio:    live ? col(live, lh, 'cx name (studio)') || null : null,
        status:            live ? col(live, lh, 'status') || null : col(row, rh, 'status') || null,
        planning_status:   live ? col(live, lh, 'planning status') || null : null,
        state:             live ? col(live, lh, 'state') || null : null,
        city:              live ? col(live, lh, 'city') || null : null,
        region:            col(row, rh, 'region') || null,
        booking_date:      parseDate(live ? col(live, lh, 'booking date') : col(row, rh, 'booking date')),
        event_start_date:  parseDate(live ? col(live, lh, 'event start time') : col(row, rh, 'first event date')),
        event_end_date:    parseDate(live ? col(live, lh, 'event end time') : col(row, rh, 'last event date')),
        event_month:       live ? col(live, lh, 'event month') || null : null,
        venue:             live ? col(live, lh, 'venue') || col(row, rh, 'venue_name') || null : col(row, rh, 'venue_name') || null,
        venue_gmv:         live ? parseNum(col(live, lh, 'venue gmv')) : parseNum(col(row, rh, 'venue_bgmv')),
        team_lead:         live ? col(live, lh, 'team lead') || null : col(row, rh, 'tl') || null,
        planner:           live ? col(live, lh, 'planner') || null : col(row, rh, 'planner') || null,
        designer:          live ? col(live, lh, 'designer') || null : null,
        project_manager:   live ? col(live, lh, 'project manager') || null : null,
        rm:                live ? col(live, lh, 'rm') || null : col(row, rh, 'rm') || null,
        vendor_manager:    live ? col(live, lh, 'vendor manager') || null : null,
        hospitality_vendor:live ? col(live, lh, 'hospitality vendor') || null : null,
        decor_vendor:      live ? col(live, lh, 'decor vendor') || null : null,
        venue_poc:         live ? col(live, lh, 'venue poc') || null : null,
        vd_status:         live ? col(live, lh, 'vd / vnd status') || null : col(row, rh, 'vd status') || null,
        package_link:      live ? col(live, lh, 'package link') || null : null,
        infinity_link:     live ? col(live, lh, 'infinity link') || null : null,
        // ── Risk Tracker fields ──
        bgmv:                    parseNum(col(row, rh, 'gmv')),
        package_price_eff:       parseNum(col(row, rh, 'package price eff.')),
        collection:              parseNum(col(row, rh, 'collection')),
        collection_pct:          parseNum(col(row, rh, 'collection %')),
        sentiment:               col(row, rh, 'sentiment') || null,
        cancellation_risk:       parseNum(col(row, rh, 'cancellation_risk')) as number | null,
        cancellation_risk_reason:col(row, rh, 'cancellation_risk_reason') || null,
        project_health:          parseNum(col(row, rh, 'project_health')) as number | null,
        project_health_reason:   col(row, rh, 'project_health_reason') || null,
        current_summary:         col(row, rh, 'current_summary') || null,
        ai_notes_summary:        col(row, rh, 'ai_notes_summary') || null,
        no_of_whatsapp_groups:   parseNum(col(row, rh, 'no of whatsapp groups')) as number | null,
        planner_assigned_date:   parseDate(col(row, rh, 'planner assigned date')),
        last_message_date:       parseDate(col(row, rh, 'last message date')),
        t_days:                  parseNum(col(row, rh, 't-days')) as number | null,
        d_days:                  parseNum(col(row, rh, 'd-days')) as number | null,
        communication_days:      parseNum(col(row, rh, 'communication days')) as number | null,
        collection_risk:         col(row, rh, 'collection risk') || null,
        collection_risk_summary: col(row, rh, 'collection risk summary') || null,
        communication_risk:      col(row, rh, 'communication risk') || null,
        sentiment_risk:          col(row, rh, 'sentiment risk') || null,
        overall_pid_risk:        col(row, rh, 'overall pid risk') || null,
        overall_risk_summary:    col(row, rh, 'overall risk summary') || null,
        synced_at:               new Date().toISOString(),
      })
    }

    // Upsert in batches of 100
    let totalUpserted = 0
    for (let i = 0; i < upsertRows.length; i += 100) {
      const batch = upsertRows.slice(i, i + 100)
      const { error } = await supabase.from('projects').upsert(batch, { onConflict: 'pid' })
      if (error) throw new Error(`Upsert batch ${i}: ${error.message}`)
      totalUpserted += batch.length
    }

    // Rebuild user_pids from team columns
    // Maps the exact name in the Live Tracker's TEAM LEAD column → email
    const NAME_TO_EMAIL: Record<string, string> = {
      'amaan abdul kader': 'amaan.kader@meragi.com',
      // PHASE-1.5: add other TL/planner/designer/PM names here
    }

    const emailToPids = new Map<string, Set<number>>()
    for (const r of upsertRows) {
      const pid = r.pid as number
      for (const field of ['team_lead', 'planner', 'designer', 'project_manager']) {
        const name = (r[field] as string | null)?.toLowerCase().trim()
        if (!name) continue
        const email = NAME_TO_EMAIL[name]
        if (!email) continue
        if (!emailToPids.has(email)) emailToPids.set(email, new Set())
        emailToPids.get(email)!.add(pid)
      }
    }

    if (emailToPids.size > 0) {
      const userPidRows = Array.from(emailToPids.entries()).map(([user_email, pids]) => ({
        user_email,
        pids: Array.from(pids),
        refreshed_at: new Date().toISOString(),
      }))
      const { error } = await supabase.from('user_pids').upsert(userPidRows, { onConflict: 'user_email' })
      if (error) throw new Error(`user_pids upsert: ${error.message}`)
    }

    await finishLog('success', totalUpserted)
    return new Response(JSON.stringify({ ok: true, rows: totalUpserted }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await finishLog('error', undefined, message)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
