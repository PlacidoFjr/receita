import { useEffect, useMemo, useState } from 'react'
import { listLancamentos, listParcelamentos } from '../lib/api'
import { formatBRL } from '../lib/format'
import type { ClasseSaida, Lancamento } from '../lib/types'
import { BarChart, PieChart } from '../ui/Charts'

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthBounds(isoDate: string) {
  const [yStr, mStr] = isoDate.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const start = `${yStr}-${mStr}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

async function fetchAllLancamentos(filters: { startDate: string; endDate: string }) {
  const pageSize = 50
  let page = 1
  const all: Lancamento[] = []

  while (true) {
    const res = await listLancamentos({ page, pageSize, ...filters })
    all.push(...res.items)
    if (all.length >= res.total) break
    page += 1
    if (page > 200) break
  }

  return all
}

export function Dashboard() {
  const [refDate, setRefDate] = useState(() => todayIso())
  const { start, end } = useMemo(() => monthBounds(refDate), [refDate])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [totalMensalParcelas, setTotalMensalParcelas] = useState(0)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const [l, totalMensal] = await Promise.all([
          fetchAllLancamentos({ startDate: start, endDate: end }),
          (async () => {
            const res = await listParcelamentos({ page: 1, pageSize: 1 })
            return res.total_mensal
          })(),
        ])
        if (cancelled) return
        setLancamentos(l)
        setTotalMensalParcelas(totalMensal)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Erro ao carregar dados')
        setLoading(false)
      }
    }

    refresh()
    const intervalId = window.setInterval(refresh, 4000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [start, end])

  const receitaTotal = useMemo(
    () => lancamentos.filter((l) => l.tipo === 'Entrada').reduce((acc, l) => acc + l.valor, 0),
    [lancamentos],
  )
  const gastosLancamentos = useMemo(
    () => lancamentos.filter((l) => l.tipo === 'Saída').reduce((acc, l) => acc + l.valor, 0),
    [lancamentos],
  )
  const gastosTotais = gastosLancamentos + totalMensalParcelas
  const saldoLivre = receitaTotal - gastosTotais

  const gastosPorClasse = useMemo(() => {
    const acc: Record<ClasseSaida, number> = { Fixos: 0, Variáveis: 0 }
    for (const l of lancamentos) {
      if (l.tipo !== 'Saída') continue
      if (l.classe_saida === 'Fixos') acc.Fixos += l.valor
      else acc['Variáveis'] += l.valor
    }
    return acc
  }, [lancamentos])

  const chartData = useMemo(
    () => [
      { label: 'Fixos', value: gastosPorClasse.Fixos, color: 'rgb(59, 130, 246)' },
      { label: 'Variáveis', value: gastosPorClasse['Variáveis'], color: 'rgb(245, 158, 11)' },
      { label: 'Parcelas', value: totalMensalParcelas, color: 'rgb(168, 85, 247)' },
    ],
    [gastosPorClasse, totalMensalParcelas],
  )

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title">Período</div>
          <div className="panel__actions">
            <label className="field field--inline">
              <span>Mês</span>
              <input
                type="month"
                value={refDate.slice(0, 7)}
                onChange={(e) => {
                  setLoading(true)
                  setError(null)
                  setRefDate(`${e.target.value}-01`)
                }}
              />
            </label>
          </div>
        </div>
        {loading ? <div className="muted">Carregando…</div> : null}
        {error ? <div className="error">{error}</div> : null}
      </section>

      <section className="grid-kpis">
        <div className="kpi">
          <div className="kpi__label">Receita Total</div>
          <div className="kpi__value">{formatBRL(receitaTotal)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Gastos Totais</div>
          <div className="kpi__value">{formatBRL(gastosTotais)}</div>
          <div className="kpi__hint">Inclui parcelamentos ativos (mensal).</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Saldo Livre</div>
          <div className={saldoLivre >= 0 ? 'kpi__value kpi__value--pos' : 'kpi__value kpi__value--neg'}>
            {formatBRL(saldoLivre)}
          </div>
        </div>
      </section>

      <section className="grid-charts">
        <div className="panel">
          <div className="panel__header">
            <div className="panel__title">Gastos por Classe (Pizza)</div>
          </div>
          <div className="chart-row">
            <PieChart data={chartData} />
            <div className="legend">
              {chartData.map((d) => (
                <div key={d.label} className="legend__item">
                  <span className="legend__dot" style={{ background: d.color }} />
                  <span className="legend__label">{d.label}</span>
                  <span className="legend__value">{formatBRL(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <div className="panel__title">Gastos por Classe (Barras)</div>
          </div>
          <BarChart data={chartData} />
        </div>
      </section>
    </div>
  )
}
