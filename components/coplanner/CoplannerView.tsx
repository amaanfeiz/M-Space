'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Check, ArrowUp, ChevronDown } from 'lucide-react'

type Message = { role: 'user' | 'ai'; text: string; time: string }

const CANNED = [
  "I'd need a moment to pull that. This is a demo instance — the live Coplanner connects to your trained knowledge base and can actually action that. Let me know what you'd like me to do here.",
  "Good question. In the full version I'd cross-reference your case patterns and surface a direct answer. This is a placeholder demo — the real connection is coming.",
  "Noted. I'd normally run that against your portfolio context and give you a specific read. Demo mode for now — but this is exactly the kind of query the trained model handles well.",
]

function nowTime(): string {
  const d = new Date()
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

function pidLink(pid: string) {
  return (
    <span className="cp-pid-link" onClick={() => { window.location.hash = `#pid=${pid}` }}>{pid}</span>
  )
}

export function CoplannerView() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [thinking, setThinking] = useState(false)
  const [cannedIndex, setCannedIndex] = useState(0)
  const messagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, thinking])

  function send() {
    const text = input.trim()
    if (!text) return
    setMessages((m) => [...m, { role: 'user', text, time: nowTime() }])
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setThinking(true)
    setTimeout(() => {
      const reply = CANNED[cannedIndex % CANNED.length]
      setMessages((m) => [...m, { role: 'ai', text: reply, time: nowTime() }])
      setCannedIndex((i) => i + 1)
      setThinking(false)
    }, 1200)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function onTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  return (
    <div className="cp-shell">
      {/* Demo notice */}
      <div style={{
        flexShrink: 0,
        background: 'var(--accent-dim)',
        borderBottom: '1px solid var(--accent)',
        padding: '6px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>
          Demo — seeded conversation only. Full Coplanner ships in Phase 12.
        </span>
      </div>
      {/* Header */}
      <div className="cp-header">
        <div className="cp-header-left">
          <div className="cp-title">Coplanner</div>
          <div className="cp-subtitle">
            <div className="cp-active-dot" />
            <span className="cp-subtitle-text">Trained on Amaan&apos;s wedding planning frameworks · 12 sessions logged · 47 case patterns indexed</span>
          </div>
        </div>
        <button className="cp-session-btn">
          <ChevronDown size={12} /> Session history
        </button>
      </div>

      {/* Context bar */}
      <div className="cp-context-bar">
        <div className="cp-context-inner">
          <div className="cp-context-eyebrow">Currently helping with</div>
          <div className="cp-context-text">
            Drafting team brief for {pidLink('24292')} morning standup. Awaiting Bhavika&apos;s confirmation on Installment 2 status.
          </div>
        </div>
        <div className="cp-context-link">View context →</div>
      </div>

      {/* Messages */}
      <div className="cp-messages" ref={messagesRef}>

        {/* ── April 26, Sunday ── */}
        <div className="cp-date-divider"><span className="cp-date-label">April 26, Sunday</span></div>

        <div className="cp-msg-user">
          <div className="cp-bubble-user">Quick check — what&apos;s brewing this week I should know about before standup tomorrow?</div>
          <div className="cp-msg-meta-user">
            <span className="cp-time">9:14 AM</span>
            <div className="cp-avatar-user">AA</div>
          </div>
        </div>

        <div className="cp-msg-ai">
          <div className="cp-ai-label"><Sparkles size={11} /><span className="cp-ai-label-text">Coplanner</span></div>
          <div className="cp-bubble-ai">
            <p>Four things worth flagging before you walk into standup.</p>
            <ul>
              <li><strong>{pidLink('24292')} — Aayushi &amp; Dhruv:</strong> Installment 2 (₹7.55L) is now 3 days overdue. Decor vendor advances are gated on this. Bhavika&apos;s been chasing but no transfer confirmed yet. This is the critical path item for the week.</li>
              <li><strong>{pidLink('28172')} — Navya &amp; Ashmann:</strong> No designer or PM assigned. Amit Syngle raised a direct question about team structure on Feb 15. That question was never formally closed. The family tracks things.</li>
              <li><strong>{pidLink('25210')} — Vienna &amp; Ishan:</strong> 14 days of silence since the group was set up. 0.84% collection on a ₹29.75L SP. Bhavika is stretched — this one risks drifting unless it gets a push this week.</li>
              <li><strong>{pidLink('24401')} — Shubhangi &amp; Vinay:</strong> Tapasya was introduced in February, but no formal planning call has happened. The Vendor Manager Lead flagged the collection gap on April 2. It&apos;s been stalled since.</li>
            </ul>
            <p>Everything else is either healthy or far enough out that it can wait until Thursday&apos;s check-in.</p>
          </div>
          <span className="cp-time" style={{ marginTop: 5 }}>9:14 AM</span>
        </div>

        <div className="cp-msg-user">
          <div className="cp-bubble-user">On 28172 — was the bride&apos;s father question on Feb 15 ever properly addressed?</div>
          <div className="cp-msg-meta-user">
            <span className="cp-time">9:19 AM</span>
            <div className="cp-avatar-user">AA</div>
          </div>
        </div>

        <div className="cp-msg-ai">
          <div className="cp-ai-label"><Sparkles size={11} /><span className="cp-ai-label-text">Coplanner</span></div>
          <div className="cp-bubble-ai">
            <p>Sharp call. No — it wasn&apos;t. Amit Syngle asked: <em>&ldquo;Could you clarify approximately the number of people on ground and dedicated for the event? This is the most important info to know for a wedding of 300 guests.&rdquo;</em> Ananth responded with a manpower framework from a prior Novotel event, but there was no follow-up confirmation that the family accepted that answer. The thread went quiet.</p>
            <p>I&apos;d recommend Ananth proactively reopens this with a clear, written team structure before the end of this week. In a comparable case — <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: 'var(--text-muted)' }}>PID 23804</span>, Dec 2025 — a similar unanswered structural question sat for 6 weeks before the family&apos;s tone shifted. That one came within a week of cancellation before a direct call from the TL stabilised it. ₹43.5L and no confirmed team is the same setup.</p>
          </div>
          <span className="cp-time" style={{ marginTop: 5 }}>9:19 AM</span>
        </div>

        <div className="cp-msg-user">
          <div className="cp-bubble-user">Note that down as a follow-up for me. And draft me a one-liner I can send Ananth tomorrow — calm, not urgent.</div>
          <div className="cp-msg-meta-user">
            <span className="cp-time">9:22 AM</span>
            <div className="cp-avatar-user">AA</div>
          </div>
        </div>

        <div className="cp-msg-ai">
          <div className="cp-ai-label"><Sparkles size={11} /><span className="cp-ai-label-text">Coplanner</span></div>
          <div className="cp-bubble-ai">
            <p>Noted. Here&apos;s a draft — reads as a routine check-in, not a flag:</p>
            <div className="cp-data-block" style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6, letterSpacing: 0 }}>
              &ldquo;Ananth — quick one on 28172. Amit Syngle raised a team structure question on Feb 15. Worth sending a short written update to the family this week confirming the on-ground team composition. Keeps them warm before the planning phase kicks in.&rdquo;
            </div>
          </div>
          <span className="cp-time" style={{ marginTop: 5 }}>9:22 AM</span>
        </div>

        <div className="cp-msg-user">
          <div className="cp-bubble-user">Good. Send.</div>
          <div className="cp-msg-meta-user">
            <span className="cp-time">9:23 AM</span>
            <div className="cp-avatar-user">AA</div>
          </div>
        </div>

        <div className="cp-msg-ai">
          <div className="cp-ai-label"><Sparkles size={11} /><span className="cp-ai-label-text">Coplanner</span></div>
          <div className="cp-bubble-ai">
            <p>Queued. Will deliver to Ananth Monday 9 AM.</p>
            <span className="cp-system-pill"><Check size={10} style={{ color: 'var(--healthy)' }} /> Scheduled · Mon Apr 28 · 9:00 AM</span>
          </div>
          <span className="cp-time" style={{ marginTop: 5 }}>9:23 AM</span>
        </div>

        {/* ── Yesterday ── */}
        <div className="cp-date-divider"><span className="cp-date-label">Yesterday</span></div>

        <div className="cp-msg-user">
          <div className="cp-bubble-user">24292 update. Bhavika says Dhruv confirmed Installment 2 by Wednesday. Mandap revision still open though.</div>
          <div className="cp-msg-meta-user">
            <span className="cp-time">11:06 AM</span>
            <div className="cp-avatar-user">AA</div>
          </div>
        </div>

        <div className="cp-msg-ai">
          <div className="cp-ai-label"><Sparkles size={11} /><span className="cp-ai-label-text">Coplanner</span></div>
          <div className="cp-bubble-ai">
            <p>Updated the {pidLink('24292')} context. Wednesday is 7 days to event — that&apos;s the last realistic window for the transfer to release vendor advances without compressing the prep timeline. I&apos;ll flag if it doesn&apos;t land by Wednesday EOD.</p>
            <p>On the mandap revision: the 6-chair reconfiguration is the higher-risk item. At 7 days out, venue ops teams typically freeze layout briefs 3-4 days before setup. If Jaishree hasn&apos;t pushed an updated brief to The Manor by tomorrow, there&apos;s a real chance the change doesn&apos;t make it into the on-ground setup. That one needs to close today, not by Wednesday.</p>
          </div>
          <span className="cp-time" style={{ marginTop: 5 }}>11:07 AM</span>
        </div>

        <div className="cp-msg-user">
          <div className="cp-bubble-user">Yes, track the Wednesday deadline. Also — pattern-match for me: what&apos;s our average days-overdue on installments across the team this quarter?</div>
          <div className="cp-msg-meta-user">
            <span className="cp-time">11:09 AM</span>
            <div className="cp-avatar-user">AA</div>
          </div>
        </div>

        <div className="cp-msg-ai">
          <div className="cp-ai-label"><Sparkles size={11} /><span className="cp-ai-label-text">Coplanner</span></div>
          <div className="cp-bubble-ai">
            <p>Tracking set for Wed Apr 30 EOD. Here&apos;s the installment data:</p>
            <div className="cp-data-block">
              <div className="dbl-row"><span className="dbl-label">Portfolio avg delay (Q1 2026)</span><span className="dbl-value warn">4.2 days</span></div>
              <div className="dbl-row"><span className="dbl-label">Team BSV</span><span className="dbl-value good">3.1 days (best)</span></div>
              <div className="dbl-row"><span className="dbl-label">Team TSN</span><span className="dbl-value warn">4.8 days</span></div>
              <div className="dbl-row"><span className="dbl-label">Team AJN</span><span className="dbl-value warn">4.6 days</span></div>
              <div className="dbl-row"><span className="dbl-label">Team Anant</span><span className="dbl-value" style={{ color: 'var(--text-dim)' }}>— (no 2nd installments yet)</span></div>
              <div className="dbl-row"><span className="dbl-label">2nd installments due (last 60d)</span><span className="dbl-value">11 total · 7 paid late</span></div>
              <div className="dbl-row"><span className="dbl-label">24292 current overdue</span><span className="dbl-value bad">3 days (worst active)</span></div>
            </div>
            <p>Worth noting: 7 of 11 is a 64% late-payment rate on second installments. If the pattern holds, installment plan structures might be worth revisiting in next week&apos;s TL sync — earlier trigger dates, smaller tranches, or milestone-linked releases.</p>
          </div>
          <span className="cp-time" style={{ marginTop: 5 }}>11:10 AM</span>
        </div>

        <div className="cp-msg-user">
          <div className="cp-bubble-user">Hmm. Add that to next week&apos;s TL sync agenda.</div>
          <div className="cp-msg-meta-user">
            <span className="cp-time">11:12 AM</span>
            <div className="cp-avatar-user">AA</div>
          </div>
        </div>

        <div className="cp-msg-ai">
          <div className="cp-ai-label"><Sparkles size={11} /><span className="cp-ai-label-text">Coplanner</span></div>
          <div className="cp-bubble-ai">
            <p>Added to the TL sync doc under &ldquo;Operations.&rdquo; Item reads: <em>&ldquo;Review installment plan structure — 64% late-payment rate on 2nd installments Q1 2026. Consider earlier trigger dates or milestone-linked releases.&rdquo;</em></p>
            <span className="cp-system-pill"><Check size={10} style={{ color: 'var(--healthy)' }} /> Added to TL Sync · Week of May 4</span>
          </div>
          <span className="cp-time" style={{ marginTop: 5 }}>11:12 AM</span>
        </div>

        {/* ── Today ── */}
        <div className="cp-date-divider"><span className="cp-date-label">Today</span></div>

        <div className="cp-msg-user">
          <div className="cp-bubble-user">Morning. What&apos;s the read on 24401 today?</div>
          <div className="cp-msg-meta-user">
            <span className="cp-time">8:47 AM</span>
            <div className="cp-avatar-user">AA</div>
          </div>
        </div>

        <div className="cp-msg-ai">
          <div className="cp-ai-label"><Sparkles size={11} /><span className="cp-ai-label-text">Coplanner</span></div>
          <div className="cp-bubble-ai">
            <p>The group rename and Ankit Singh addition two days ago is the first real signal of life on {pidLink('24401')} in weeks — the PM is now in the chat, which is a good sign. But the couple hasn&apos;t been contacted since February and no intro planning call has happened. The team being active internally doesn&apos;t close that gap.</p>
            <p>Pattern note: across 7 comparable stalled cases in the last 12 months where an intro call went more than 90 days from booking, 3 resulted in cancellation — all 3 had the same signature: quiet client group, internal team active, no formal re-engagement. I&apos;d put a 15-minute discovery call on Tapasya&apos;s calendar for this week before the pattern sets.</p>
          </div>
          <span className="cp-time" style={{ marginTop: 5 }}>8:48 AM</span>
        </div>

        <div className="cp-msg-user">
          <div className="cp-bubble-user">Set up a nudge for Tapasya on Wednesday. Anything else before standup?</div>
          <div className="cp-msg-meta-user">
            <span className="cp-time">8:50 AM</span>
            <div className="cp-avatar-user">AA</div>
          </div>
        </div>

        <div className="cp-msg-ai">
          <div className="cp-ai-label"><Sparkles size={11} /><span className="cp-ai-label-text">Coplanner</span></div>
          <div className="cp-bubble-ai">
            <p>Nudge set for Tapasya, Wednesday 9 AM. Three things for standup:</p>
            <ul>
              <li><strong>24292:</strong> Installment 2 tracking active. Mandap revision needs to close today — push Bhavika to confirm Jaishree has updated the Manor brief.</li>
              <li><strong>28172:</strong> Ananth&apos;s team structure message went out this morning. Watch for Amit Syngle&apos;s response before EOD.</li>
              <li><strong>19935:</strong> Designer and PM still unassigned. This is a 3-day Kerala event 228 days out with no design resource. It&apos;s been on the list for two weeks — worth escalating today rather than carrying it another cycle.</li>
            </ul>
            <p>Standup brief ready. Want me to render the team-facing version?</p>
          </div>
          <span className="cp-time" style={{ marginTop: 5 }}>8:51 AM</span>
        </div>

        {/* Waiting indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8, paddingLeft: 2 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', opacity: 0.35 }} />
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>Waiting for your reply…</span>
        </div>

        {/* Dynamic messages */}
        {messages.map((msg, i) =>
          msg.role === 'user' ? (
            <div key={i} className="cp-msg-user">
              <div className="cp-bubble-user">{msg.text}</div>
              <div className="cp-msg-meta-user">
                <span className="cp-time">{msg.time}</span>
                <div className="cp-avatar-user">AA</div>
              </div>
            </div>
          ) : (
            <div key={i} className="cp-msg-ai">
              <div className="cp-ai-label"><Sparkles size={11} /><span className="cp-ai-label-text">Coplanner</span></div>
              <div className="cp-bubble-ai"><p>{msg.text}</p></div>
              <span className="cp-time" style={{ marginTop: 5 }}>{msg.time}</span>
            </div>
          )
        )}

        {/* Thinking dots */}
        {thinking && (
          <div className="cp-thinking visible">
            <div className="cp-thinking-dots">
              <span /><span /><span />
            </div>
            <span className="cp-thinking-label">Thinking…</span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="cp-input-bar">
        <div className="cp-input-row">
          <textarea
            ref={textareaRef}
            className="cp-textarea"
            placeholder="Ask the coplanner…"
            value={input}
            onChange={onTextareaChange}
            onKeyDown={onKeyDown}
            rows={1}
          />
          <button className="cp-send-btn" onClick={send} aria-label="Send">
            <ArrowUp size={15} />
          </button>
        </div>
        <div className="cp-input-disclaimer">
          Demo mode — canned responses only. Live Coplanner connects to your trained knowledge base.
        </div>
      </div>
    </div>
  )
}
