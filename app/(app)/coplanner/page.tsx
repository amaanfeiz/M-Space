export default function CoplannerPage() {
  return (
    <>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--text-primary)', marginBottom: 4 }}>
        Coplanner
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        AI co-planning assistant — Phase 2.
      </div>
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Ask the coplanner</div>
        <textarea
          disabled
          placeholder="Phase 2 feature — the AI co-planner will be available once chat data access is in place."
          style={{
            width: '100%',
            height: 120,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-btn)',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            padding: 12,
            resize: 'none',
            cursor: 'not-allowed',
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
          Phase 2 — requires live chat data integration.
        </div>
      </div>
    </>
  )
}
