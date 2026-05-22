export type CurrencyDensity = 'full' | 'compact'

export function formatInr(amount: number | null | undefined, density: CurrencyDensity = 'compact'): string {
  if (amount == null || amount === 0) return '—'

  if (density === 'full') {
    return `₹${amount.toLocaleString('en-IN')}/-`
  }

  // compact — keep 1 decimal when non-zero, never round up
  if (amount >= 10_000_000) {
    const val = amount / 10_000_000
    return `₹${trimDecimal(val)}Cr`
  }
  if (amount >= 100_000) {
    const val = amount / 100_000
    return `₹${trimDecimal(val)}L`
  }
  if (amount >= 1_000) {
    const val = amount / 1_000
    return `₹${trimDecimal(val)}K`
  }
  return `₹${amount}`
}

function trimDecimal(val: number): string {
  const fixed = val.toFixed(1)
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
}
