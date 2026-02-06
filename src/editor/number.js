export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function toNumber(value, fallback = 0) {
  const next = Number(value)
  if (Number.isFinite(next)) {
    return next
  }
  return fallback
}
