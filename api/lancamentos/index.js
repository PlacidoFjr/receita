import { ensureSchema, sql } from '../_db.js'
import { coerceMoney, isIsoDate, json, normalizeDateField, parsePageParams, readJsonBody } from '../_utils.js'

function buildWhere(searchParams) {
  const clauses = []
  const values = []

  const allowed = {
    tipo: 'tipo',
    status: 'status',
    categoria: 'categoria',
    classe_saida: 'classe_saida',
  }

  for (const [key, col] of Object.entries(allowed)) {
    const v = searchParams.get(key)
    if (v) {
      values.push(v)
      clauses.push(`${col} = $${values.length}`)
    }
  }

  const q = searchParams.get('q')
  if (q) {
    values.push(`%${q}%`)
    values.push(`%${q}%`)
    clauses.push(`(descricao ILIKE $${values.length - 1} OR categoria ILIKE $${values.length})`)
  }

  const startDate = searchParams.get('startDate')
  if (startDate && isIsoDate(startDate)) {
    values.push(startDate)
    clauses.push(`data >= $${values.length}`)
  }

  const endDate = searchParams.get('endDate')
  if (endDate && isIsoDate(endDate)) {
    values.push(endDate)
    clauses.push(`data <= $${values.length}`)
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return { whereSql, values }
}

export default async function handler(req, res) {
  await ensureSchema()

  if (!req.url) return json(res, 400, { error: 'Bad request' })
  const url = new URL(req.url, `http://${req.headers.host}`)
  const searchParams = url.searchParams

  if (req.method === 'GET') {
    const { whereSql, values } = buildWhere(searchParams)
    const { page, pageSize, offset } = parsePageParams(searchParams)

    const totalRows = await sql.query(`SELECT COUNT(*)::int AS total FROM lancamentos ${whereSql}`, values)
    const total = totalRows[0]?.total ?? 0

    const listValues = [...values, pageSize, offset]
    const rows = await sql.query(
      `SELECT id, data, descricao, categoria, tipo, valor::float8 AS valor, status, classe_saida
       FROM lancamentos
       ${whereSql}
       ORDER BY data DESC, id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      listValues,
    )

    const items = rows.map((r) => ({ ...r, data: normalizeDateField(r.data) }))
    return json(res, 200, { items, total, page, pageSize })
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    const data = body?.data
    const descricao = body?.descricao
    const categoria = body?.categoria
    const tipo = body?.tipo
    const valor = coerceMoney(body?.valor)
    const status = body?.status
    const classe_saida = body?.classe_saida ?? null

    if (!isIsoDate(data)) return json(res, 400, { error: 'Data inválida' })
    if (typeof descricao !== 'string' || !descricao.trim()) return json(res, 400, { error: 'Descrição inválida' })
    if (typeof categoria !== 'string' || !categoria.trim()) return json(res, 400, { error: 'Categoria inválida' })
    if (tipo !== 'Entrada' && tipo !== 'Saída') return json(res, 400, { error: 'Tipo inválido' })
    if (valor === null || valor < 0) return json(res, 400, { error: 'Valor inválido' })
    if (!['Pago', 'Pendente', 'Recebido'].includes(status)) return json(res, 400, { error: 'Status inválido' })
    if (tipo === 'Saída' && !['Fixos', 'Variáveis'].includes(classe_saida))
      return json(res, 400, { error: 'Classe da saída inválida' })

    const rows = await sql`
      INSERT INTO lancamentos (data, descricao, categoria, tipo, valor, status, classe_saida)
      VALUES (${data}::date, ${descricao.trim()}, ${categoria.trim()}, ${tipo}, ${valor}, ${status}, ${
        tipo === 'Saída' ? classe_saida : null
      })
      RETURNING id
    `

    return json(res, 201, { id: rows[0].id })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
