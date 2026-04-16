import type { Lancamento, PageResult, Parcelamento } from './types'

async function request<T>(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || `Erro HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function listLancamentos(params: {
  page: number
  pageSize: number
  startDate?: string
  endDate?: string
  q?: string
  tipo?: string
  status?: string
  categoria?: string
  classe_saida?: string
}) {
  const usp = new URLSearchParams()
  usp.set('page', String(params.page))
  usp.set('pageSize', String(params.pageSize))
  if (params.startDate) usp.set('startDate', params.startDate)
  if (params.endDate) usp.set('endDate', params.endDate)
  if (params.q) usp.set('q', params.q)
  if (params.tipo) usp.set('tipo', params.tipo)
  if (params.status) usp.set('status', params.status)
  if (params.categoria) usp.set('categoria', params.categoria)
  if (params.classe_saida) usp.set('classe_saida', params.classe_saida)
  return request<PageResult<Lancamento>>(`/api/lancamentos?${usp.toString()}`)
}

export async function createLancamento(input: Omit<Lancamento, 'id'>) {
  return request<{ id: number }>(`/api/lancamentos`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateLancamento(id: number, input: Omit<Lancamento, 'id'>) {
  return request<{ ok: true }>(`/api/lancamentos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteLancamento(id: number) {
  return request<{ ok: true }>(`/api/lancamentos/${id}`, {
    method: 'DELETE',
  })
}

export async function listParcelamentos(params: { page: number; pageSize: number; q?: string }) {
  const usp = new URLSearchParams()
  usp.set('page', String(params.page))
  usp.set('pageSize', String(params.pageSize))
  if (params.q) usp.set('q', params.q)
  return request<
    PageResult<Parcelamento> & {
      total_mensal: number
    }
  >(`/api/parcelamentos?${usp.toString()}`)
}

export async function createParcelamento(input: Omit<Parcelamento, 'id' | 'valor_mensal' | 'valor_restante' | 'progresso'>) {
  return request<{ id: number }>(`/api/parcelamentos`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateParcelamento(
  id: number,
  input: Omit<Parcelamento, 'id' | 'valor_mensal' | 'valor_restante' | 'progresso'>,
) {
  return request<{ ok: true }>(`/api/parcelamentos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteParcelamento(id: number) {
  return request<{ ok: true }>(`/api/parcelamentos/${id}`, {
    method: 'DELETE',
  })
}
