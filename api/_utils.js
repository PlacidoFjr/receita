export function json(res, statusCode, body) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export async function readJsonBody(req) {
  const maxBytes = 1_000_000
  let received = 0
  const chunks = []

  for await (const chunk of req) {
    received += chunk.length
    if (received > maxBytes) throw new Error('Payload too large')
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return null
  return JSON.parse(raw)
}

export function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function coerceMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

export function parsePageParams(searchParams) {
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 10)))
  const offset = (page - 1) * pageSize
  return { page, pageSize, offset }
}

export function computeParcelamento({ valor_total, qtd_parcelas, parcela_atual }) {
  const valorTotal = Number(valor_total)
  const valor_mensal = qtd_parcelas > 0 ? valorTotal / qtd_parcelas : 0
  const pago = valor_mensal * parcela_atual
  const valor_restante = valorTotal - pago
  const progresso = qtd_parcelas > 0 ? parcela_atual / qtd_parcelas : 0
  return {
    valor_mensal: Math.round(valor_mensal * 100) / 100,
    valor_restante: Math.round(valor_restante * 100) / 100,
    progresso: Math.max(0, Math.min(1, progresso)),
  }
}

export function normalizeDateField(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value.slice(0, 10)
  return String(value)
}
