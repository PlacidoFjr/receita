import { ensureSchema, sql } from '../_db.js'
import { coerceMoney, json, readJsonBody } from '../_utils.js'

function parseId(req) {
  const raw = req.query?.id ?? req.query?.['id']
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export default async function handler(req, res) {
  await ensureSchema()

  const id = parseId(req)
  if (!id) return json(res, 400, { error: 'ID inválido' })

  if (req.method === 'PUT') {
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
      UPDATE parcelamentos
      SET item = ${item.trim()},
          valor_total = ${valor_total},
          qtd_parcelas = ${qtd_parcelas},
          parcela_atual = ${parcela_atual}
      WHERE id = ${id}
      RETURNING id
    `
    if (!rows.length) return json(res, 404, { error: 'Não encontrado' })
    return json(res, 200, { ok: true })
  }

  if (req.method === 'DELETE') {
    const rows = await sql`DELETE FROM parcelamentos WHERE id = ${id} RETURNING id`
    if (!rows.length) return json(res, 404, { error: 'Não encontrado' })
    return json(res, 200, { ok: true })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
