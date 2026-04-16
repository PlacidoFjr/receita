import { useCallback, useEffect, useMemo, useState } from 'react'
import { createLancamento, deleteLancamento, listLancamentos, updateLancamento } from '../lib/api'
import { formatBRL, formatDateBR } from '../lib/format'
import type { ClasseSaida, Lancamento, StatusLancamento, TipoLancamento } from '../lib/types'

const CATEGORIAS_SUGERIDAS = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Salário', 'Investimento']

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function initialForm(): Omit<Lancamento, 'id'> {
  return {
    data: todayIso(),
    descricao: '',
    categoria: '',
    tipo: 'Saída',
    valor: 0,
    status: 'Pago',
    classe_saida: 'Variáveis',
  }
}

export function Lancamentos() {
  const [form, setForm] = useState<Omit<Lancamento, 'id'>>(initialForm)
  const [editId, setEditId] = useState<number | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [items, setItems] = useState<Lancamento[]>([])
  const [total, setTotal] = useState(0)

  const [page, setPage] = useState(1)
  const pageSize = 10

  const [q, setQ] = useState('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [tipo, setTipo] = useState<TipoLancamento | ''>('')
  const [status, setStatus] = useState<StatusLancamento | ''>('')
  const [classeSaida, setClasseSaida] = useState<ClasseSaida | ''>('')

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const totals = useMemo(() => {
    const entradas = items.filter((l) => l.tipo === 'Entrada').reduce((acc, l) => acc + l.valor, 0)
    const saidas = items.filter((l) => l.tipo === 'Saída').reduce((acc, l) => acc + l.valor, 0)
    return { entradas, saidas }
  }, [items])

  const load = useCallback(async (nextPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listLancamentos({
        page: nextPage,
        pageSize,
        q: q || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        tipo: tipo || undefined,
        status: status || undefined,
        classe_saida: classeSaida || undefined,
      })
      setItems(res.items)
      setTotal(res.total)
      setPage(res.page)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar lançamentos')
    } finally {
      setLoading(false)
    }
  }, [classeSaida, endDate, q, startDate, status, tipo])

  useEffect(() => {
    load(1)
  }, [load])

  useEffect(() => {
    const t = setTimeout(() => {
      load(1)
    }, 250)
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
        await updateLancamento(editId, form)
      } else {
        await createLancamento(form)
      }
      resetForm()
      await load(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  const onEdit = (row: Lancamento) => {
    setEditId(row.id)
    setForm({
      data: row.data,
      descricao: row.descricao,
      categoria: row.categoria,
      tipo: row.tipo,
      valor: row.valor,
      status: row.status,
      classe_saida: row.classe_saida,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onDelete = async (id: number) => {
    if (!confirm('Excluir este lançamento?')) return
    setError(null)
    try {
      await deleteLancamento(id)
      await load(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const tipoAtual = form.tipo
  const statusOptions: StatusLancamento[] =
    tipoAtual === 'Entrada' ? ['Recebido', 'Pendente'] : ['Pago', 'Pendente']

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title">{editId ? `Editar #${editId}` : 'Novo Lançamento'}</div>
        </div>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>Data</span>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm((s) => ({ ...s, data: e.target.value }))}
              required
            />
          </label>
          <label className="field field--grow">
            <span>Descrição</span>
            <input
              value={form.descricao}
              onChange={(e) => setForm((s) => ({ ...s, descricao: e.target.value }))}
              placeholder="Ex: Supermercado"
              required
            />
          </label>
          <label className="field">
            <span>Tipo</span>
            <select
              value={form.tipo}
              onChange={(e) => {
                const next = e.target.value as TipoLancamento
                setForm((s) => ({
                  ...s,
                  tipo: next,
                  status: next === 'Entrada' ? 'Recebido' : 'Pago',
                  classe_saida: next === 'Saída' ? (s.classe_saida ?? 'Variáveis') : null,
                }))
              }}
            >
              <option value="Entrada">Entrada</option>
              <option value="Saída">Saída</option>
            </select>
          </label>
          <label className="field">
            <span>Categoria</span>
            <input
              list="categorias"
              value={form.categoria}
              onChange={(e) => setForm((s) => ({ ...s, categoria: e.target.value }))}
              placeholder="Ex: Alimentação"
              required
            />
            <datalist id="categorias">
              {CATEGORIAS_SUGERIDAS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          {form.tipo === 'Saída' ? (
            <label className="field">
              <span>Classe</span>
              <select
                value={form.classe_saida ?? 'Variáveis'}
                onChange={(e) => setForm((s) => ({ ...s, classe_saida: e.target.value as ClasseSaida }))}
              >
                <option value="Fixos">Fixos</option>
                <option value="Variáveis">Variáveis</option>
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>Valor</span>
            <input
              type="number"
              step="0.01"
              value={String(form.valor)}
              onChange={(e) => setForm((s) => ({ ...s, valor: Number(e.target.value) }))}
              required
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as StatusLancamento }))}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
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
          <div className="panel__title">Filtros</div>
        </div>
        <div className="filters">
          <label className="field">
            <span>Buscar</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Descrição ou categoria" />
          </label>
          <label className="field">
            <span>Início</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Fim</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoLancamento | '')}>
              <option value="">Todos</option>
              <option value="Entrada">Entrada</option>
              <option value="Saída">Saída</option>
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusLancamento | '')}>
              <option value="">Todos</option>
              <option value="Pago">Pago</option>
              <option value="Pendente">Pendente</option>
              <option value="Recebido">Recebido</option>
            </select>
          </label>
          <label className="field">
            <span>Classe</span>
            <select value={classeSaida} onChange={(e) => setClasseSaida(e.target.value as ClasseSaida | '')}>
              <option value="">Todas</option>
              <option value="Fixos">Fixos</option>
              <option value="Variáveis">Variáveis</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div className="panel__title">Lançamentos</div>
          <div className="panel__actions">
            <div className="totals">
              <span>Entradas: {formatBRL(totals.entradas)}</span>
              <span>Saídas: {formatBRL(totals.saidas)}</span>
            </div>
          </div>
        </div>

        {loading ? <div className="muted">Carregando…</div> : null}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Classe</th>
                <th className="right">Valor</th>
                <th>Status</th>
                <th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id}>
                  <td>{formatDateBR(l.data)}</td>
                  <td>{l.descricao}</td>
                  <td>{l.categoria}</td>
                  <td>{l.tipo}</td>
                  <td>{l.classe_saida ?? '—'}</td>
                  <td className="right">{formatBRL(l.valor)}</td>
                  <td>{l.status}</td>
                  <td className="right">
                    <button className="btn btn--small" onClick={() => onEdit(l)}>
                      Editar
                    </button>
                    <button className="btn btn--small btn--danger" onClick={() => onDelete(l.id)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="muted">
                    Nenhum lançamento encontrado.
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
