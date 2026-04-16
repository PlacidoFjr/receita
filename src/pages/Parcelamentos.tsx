import { useCallback, useEffect, useMemo, useState } from 'react'
import { createParcelamento, deleteParcelamento, listParcelamentos, updateParcelamento } from '../lib/api'
import { formatBRL } from '../lib/format'
import type { Parcelamento } from '../lib/types'
import { ProgressBar } from '../ui/Charts'

function initialForm() {
  return {
    item: '',
    valor_total: 0,
    qtd_parcelas: 12,
    parcela_atual: 0,
  }
}

function compute(valor_total: number, qtd_parcelas: number, parcela_atual: number) {
  const valor_mensal = qtd_parcelas > 0 ? valor_total / qtd_parcelas : 0
  const valor_restante = valor_total - valor_mensal * parcela_atual
  const progresso = qtd_parcelas > 0 ? parcela_atual / qtd_parcelas : 0
  return {
    valor_mensal: Math.round(valor_mensal * 100) / 100,
    valor_restante: Math.round(valor_restante * 100) / 100,
    progresso: Math.max(0, Math.min(1, progresso)),
  }
}

export function Parcelamentos() {
  const [form, setForm] = useState(initialForm)
  const [editId, setEditId] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [items, setItems] = useState<Parcelamento[]>([])
  const [total, setTotal] = useState(0)
  const [totalMensal, setTotalMensal] = useState(0)

  const [page, setPage] = useState(1)
  const pageSize = 10
  const [q, setQ] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const computed = useMemo(
    () => compute(form.valor_total, form.qtd_parcelas, form.parcela_atual),
    [form.valor_total, form.qtd_parcelas, form.parcela_atual],
  )

  const load = useCallback(async (nextPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listParcelamentos({ page: nextPage, pageSize, q: q || undefined })
      setItems(res.items)
      setTotal(res.total)
      setTotalMensal(res.total_mensal)
      setPage(res.page)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar parcelamentos')
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    load(1)
  }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(1), 250)
    return () => clearTimeout(t)
  }, [load])

  const resetForm = () => {
    setForm(initialForm())
    setEditId(null)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      if (editId) {
        await updateParcelamento(editId, form)
      } else {
        await createParcelamento(form)
      }
      resetForm()
      await load(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  const onEdit = (row: Parcelamento) => {
    setEditId(row.id)
    setForm({
      item: row.item,
      valor_total: row.valor_total,
      qtd_parcelas: row.qtd_parcelas,
      parcela_atual: row.parcela_atual,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onDelete = async (id: number) => {
    if (!confirm('Excluir este parcelamento?')) return
    setError(null)
    try {
      await deleteParcelamento(id)
      await load(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title">{editId ? `Editar #${editId}` : 'Novo Parcelamento'}</div>
        </div>
        <form className="form" onSubmit={onSubmit}>
          <label className="field field--grow">
            <span>Item</span>
            <input value={form.item} onChange={(e) => setForm((s) => ({ ...s, item: e.target.value }))} required />
          </label>
          <label className="field">
            <span>Valor Total</span>
            <input
              type="number"
              step="0.01"
              value={String(form.valor_total)}
              onChange={(e) => setForm((s) => ({ ...s, valor_total: Number(e.target.value) }))}
              required
            />
          </label>
          <label className="field">
            <span>Qtd. Parcelas</span>
            <input
              type="number"
              min={1}
              value={String(form.qtd_parcelas)}
              onChange={(e) => setForm((s) => ({ ...s, qtd_parcelas: Number(e.target.value) }))}
              required
            />
          </label>
          <label className="field">
            <span>Parcela Atual</span>
            <input
              type="number"
              min={0}
              value={String(form.parcela_atual)}
              onChange={(e) => setForm((s) => ({ ...s, parcela_atual: Number(e.target.value) }))}
              required
            />
          </label>
          <div className="panel__hint">
            <div>Valor Mensal: {formatBRL(computed.valor_mensal)}</div>
            <div>Restante: {formatBRL(computed.valor_restante)}</div>
            <div>Progresso: {Math.round(computed.progresso * 100)}%</div>
          </div>
          <div className="form__actions">
            <button className="btn btn--primary" type="submit">
              {editId ? 'Salvar' : 'Adicionar'}
            </button>
            {editId ? (
              <button className="btn" type="button" onClick={resetForm}>
                Cancelar
              </button>
            ) : null}
          </div>
          {error ? <div className="error">{error}</div> : null}
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div className="panel__title">Parcelamentos</div>
          <div className="panel__actions">
            <div className="totals">Total mensal: {formatBRL(totalMensal)}</div>
          </div>
        </div>

        <div className="filters">
          <label className="field field--grow">
            <span>Buscar</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item" />
          </label>
        </div>

        {loading ? <div className="muted">Carregando…</div> : null}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="right">Total</th>
                <th className="right">Mensal</th>
                <th className="right">Restante</th>
                <th>Parcelas</th>
                <th>Progresso</th>
                <th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.item}</td>
                  <td className="right">{formatBRL(p.valor_total)}</td>
                  <td className="right">{formatBRL(p.valor_mensal)}</td>
                  <td className="right">{formatBRL(p.valor_restante)}</td>
                  <td>
                    {p.parcela_atual}/{p.qtd_parcelas}
                  </td>
                  <td>
                    <div className="progress-row">
                      <ProgressBar value={p.progresso} />
                      <span className="muted">{Math.round(p.progresso * 100)}%</span>
                    </div>
                  </td>
                  <td className="right">
                    <button className="btn btn--small" onClick={() => onEdit(p)}>
                      Editar
                    </button>
                    <button className="btn btn--small btn--danger" onClick={() => onDelete(p.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Nenhum parcelamento encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <button className="btn btn--small" disabled={page <= 1} onClick={() => load(page - 1)}>
            Anterior
          </button>
          <div className="muted">
            Página {page} de {totalPages} ({total} itens)
          </div>
          <button className="btn btn--small" disabled={page >= totalPages} onClick={() => load(page + 1)}>
            Próxima
          </button>
        </div>
      </section>
    </div>
  )
}
