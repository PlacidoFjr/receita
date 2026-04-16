import { clampNumber } from '../lib/format'

export type ChartDatum = {
  label: string
  value: number
  color: string
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`
}

export function PieChart(props: { data: ChartDatum[]; size?: number }) {
  const size = props.size ?? 220
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 8

  const total = props.data.reduce((acc, d) => acc + Math.max(0, d.value), 0)
  if (total <= 0) {
    return (
      <div className="chart-empty" style={{ width: size, height: size }}>
        Sem dados
      </div>
    )
  }

  const positive = props.data.map((d) => ({ ...d, value: Math.max(0, d.value) })).filter((d) => d.value > 0)
  const slices = positive.reduce<{ d: ChartDatum; start: number; end: number }[]>((acc, d) => {
    const startAngle = acc.length ? acc[acc.length - 1].end : 0
    const delta = (d.value / total) * 360
    const endAngle = startAngle + delta
    acc.push({ d, start: startAngle, end: endAngle })
    return acc
  }, [])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Gráfico de pizza">
      {slices.map((s) => (
        <path key={s.d.label} d={describeArc(cx, cy, r, s.start, s.end)} fill={s.d.color} />
      ))}
    </svg>
  )
}

export function BarChart(props: { data: ChartDatum[]; height?: number }) {
  const height = props.height ?? 220
  const width = 420
  const padding = 16
  const baseY = height - padding
  const max = Math.max(0, ...props.data.map((d) => d.value))
  const barCount = props.data.length || 1
  const barGap = 10
  const barW = (width - padding * 2 - barGap * (barCount - 1)) / barCount

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de barras">
      <line x1={padding} y1={baseY} x2={width - padding} y2={baseY} stroke="currentColor" opacity="0.2" />
      {props.data.map((d, idx) => {
        const value = Math.max(0, d.value)
        const h = max > 0 ? (value / max) * (height - padding * 2) : 0
        const x = padding + idx * (barW + barGap)
        const y = baseY - h
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={h} fill={d.color} rx={6} />
            <text x={x + barW / 2} y={height - 2} textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.75">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function ProgressBar(props: { value: number }) {
  const value = clampNumber(props.value, 0, 1)
  return (
    <div className="progress">
      <div className="progress__fill" style={{ width: `${value * 100}%` }} />
    </div>
  )
}
