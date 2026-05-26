import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const body = await request.json() as { pid: number; date?: string }

  if (!body.pid) {
    return NextResponse.json({ error: 'Missing pid' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!anthropicKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Import and run the brief generation for this single PID
  // For now, use a simplified approach: call the external script via a child process
  // This keeps the generation logic in one place (generate-brief.ts)
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  const scriptsDir = process.cwd() + '/scripts/whatsapp-scraper'
  const dateFlag = body.date ? `--date=${body.date}` : ''

  try {
    const start = Date.now()
    await execAsync(
      `npx tsx generate-brief.ts --pid=${body.pid} ${dateFlag}`,
      { cwd: scriptsDir, timeout: 120_000, env: { ...process.env } },
    )

    // Fetch the newly generated brief
    const { data: newBrief } = await supabase
      .from('briefs')
      .select('id, brief_json, brief_date, is_catchup')
      .eq('pid', body.pid)
      .eq('is_catchup', false)
      .order('brief_date', { ascending: false })
      .limit(1)
      .single()

    await supabase.from('cron_runs').insert({
      tier: 't1_manual',
      started_at: new Date(start).toISOString(),
      finished_at: new Date().toISOString(),
      status: 'completed',
      rows_written: 1,
    })

    if (!newBrief) {
      return NextResponse.json({ error: 'Brief generated but not found in DB' }, { status: 500 })
    }

    return NextResponse.json({
      id: newBrief.id,
      brief: newBrief.brief_json,
      brief_date: newBrief.brief_date,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
