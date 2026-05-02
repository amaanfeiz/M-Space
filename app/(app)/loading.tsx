export default function Loading() {
  return (
    <>
      <div className="skeleton-banner" />
      <div className="skeleton-strip">
        <div className="skeleton-line w-40" />
        <div className="skeleton-line w-60" />
        <div className="skeleton-line w-50" />
      </div>
      <div className="skeleton-card briefing" />
      <div className="skeleton-metrics">
        <div className="skeleton-metric" />
        <div className="skeleton-metric" />
        <div className="skeleton-metric" />
        <div className="skeleton-metric" />
      </div>
      <div className="skeleton-panels">
        <div className="skeleton-card tall" />
        <div className="skeleton-card tall" />
      </div>
      <div className="skeleton-team">
        <div className="skeleton-card squat" />
        <div className="skeleton-card squat" />
        <div className="skeleton-card squat" />
        <div className="skeleton-card squat" />
      </div>
    </>
  )
}
