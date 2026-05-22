// POST /api/clarification-answer
//
// Persist Amaan's answer to an AI-generated clarification question. Amaan
// types the answer in the detail panel "What I don't know" section; this
// route stores it. The next T1 brief run loads recent answers as authoritative
// context, so the system learns from Amaan's input.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    clarification_id: string
    amaan_answer: string
  }

  if (!body.clarification_id || !body.amaan_answer?.trim()) {
    return NextResponse.json({ error: 'Missing clarification_id or amaan_answer' }, { status: 400 })
  }

  const { error } = await supabase
    .from('brief_clarifications')
    .update({
      amaan_answer: body.amaan_answer.trim(),
      answered_at: new Date().toISOString(),
    })
    .eq('id', body.clarification_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
