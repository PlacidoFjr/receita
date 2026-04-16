export type TipoLancamento = 'Entrada' | 'Saída'
export type StatusLancamento = 'Pago' | 'Pendente' | 'Recebido'
export type ClasseSaida = 'Fixos' | 'Variáveis'

export type Lancamento = {
  id: number
  data: string
  descricao: string
  categoria: string
  tipo: TipoLancamento
  valor: number
  status: StatusLancamento
  classe_saida: ClasseSaida | null
}

export type Parcelamento = {
  id: number
  item: string
  valor_total: number
  qtd_parcelas: number
  parcela_atual: number
  valor_mensal: number
  valor_restante: number
  progresso: number
}

export type PageResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}
