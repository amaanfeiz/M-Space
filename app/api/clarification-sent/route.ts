import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { pid: number; brief_date: string; edited_text: string }

  if (!body.pid || !body.brief_date || !body.edited_text?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Upsert into clarification_evaluations — keyed on (pid, brief_date)
  const { error } = await supabase.from('clarification_evaluations').upsert(
    {
      pid: body.pid,
      brief_date: body.brief_date,
      actual_sent: body.edited_text.trim(),
      match_method: 'manual',
      match_confidence: 'high',
      matched_at: new Date().toISOString(),
    },
    { onConflict: 'pid,brief_date' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
