'use client'

import { useEffect, useRef, useState } from 'react'

export function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)
  const start = useRef<number | null>(null)
  const duration = 700

  useEffect(() => {
    if (value === 0) return
    start.current = null
    function step(ts: number) {
      if (!start.current) start.current = ts
      const progress = Math.min((ts - start.current) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(ease * value))
      if (progress < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [value])

  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{display}</span>
}
