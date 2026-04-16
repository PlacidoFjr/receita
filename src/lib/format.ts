export function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDateBR(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
