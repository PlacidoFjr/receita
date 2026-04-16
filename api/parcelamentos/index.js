import { ensureSchema, sql } from '../_db.js'
import { coerceMoney, computeParcelamento, json, parsePageParams, readJsonBody } from '../_utils.js'
import { getUserFromAuthHeader } from '../_auth.js'

function buildWhere(searchParams) {
  const clauses = []
  const values = []

  const q = searchParams.get('q')
  if (q) {
    values.push(`%${q}%`)
    clauses.push(`item ILIKE $${values.length}`)
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return { whereSql, values }
}

export default async function handler(req, res) {
  await ensureSchema()
  if (req.method === 'OPTIONS') return json(res, 204, {})
  const user = await getUserFromAuthHeader(req)
  if (!user) return json(res, 401, { error: 'Não autenticado' })

  if (!req.url) return json(res, 400, { error: 'Bad request' })
  const url = new URL(req.url, `http://${req.headers.host}`)
  const searchParams = url.searchParams

  if (req.method === 'GET') {
    const { whereSql, values } = buildWhere(searchParams)
    const whereWithUser = whereSql ? `${whereSql} AND user_id = $${values.length + 1}` : `WHERE user_id = $1`
    const valuesWithUser = [...values, user.id]
    const { page, pageSize, offset } = parsePageParams(searchParams)

    const totalRows = await sql.query(`SELECT COUNT(*)::int AS total FROM parcelamentos ${whereWithUser}`, valuesWithUser)
    const total = totalRows[0]?.total ?? 0

    const listValues = [...valuesWithUser, pageSize, offset]
    const rows = await sql.query(
      `SELECT id,
              item,
              valor_total::float8 AS valor_total,
              qtd_parcelas,
              parcela_atual
       FROM parcelamentos
       ${whereWithUser}
       ORDER BY id DESC
       LIMIT $${valuesWithUser.length + 1} OFFSET $${valuesWithUser.length + 2}`,
      listValues,
    )

    const items = rows.map((r) => ({ ...r, ...computeParcelamento(r) }))

    const totalMensalRows = await sql`
      SELECT COALESCE(SUM(valor_total / qtd_parcelas), 0)::float8 AS total_mensal
      FROM parcelamentos
      WHERE parcela_atual < qtd_parcelas AND user_id = ${user.id}
    `
    const total_mensal = Math.round((totalMensalRows[0]?.total_mensal ?? 0) * 100) / 100

    return json(res, 200, { items, total, page, pageSize, total_mensal })
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req)
    const item = body?.item
    const valor_total = coerceMoney(body?.valor_total)
    const qtd_parcelas = Number(body?.qtd_parcelas)
    const parcela_atual = Number(body?.parcela_atual)

    if (typeof item !== 'string' || !item.trim()) return json(res, 400, { error: 'Item inválido' })
    if (valor_total === null || valor_total < 0) return json(res, 400, { error: 'Valor total inválido' })
    if (!Number.isInteger(qtd_parcelas) || qtd_parcelas <= 0)
      return json(res, 400, { error: 'Quantidade de parcelas inválida' })
    if (!Number.isInteger(parcela_atual) || parcela_atual < 0 || parcela_atual > qtd_parcelas)
      return json(res, 400, { error: 'Parcela atual inválida' })

    const rows = await sql`
      INSERT INTO parcelamentos (item, valor_total, qtd_parcelas, parcela_atual, user_id)
      VALUES (${item.trim()}, ${valor_total}, ${qtd_parcelas}, ${parcela_atual}, ${user.id})
      RETURNING id
    `
    return json(res, 201, { id: rows[0].id })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
