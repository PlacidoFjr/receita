import { ensureSchema, sql } from '../_db.js'
import { coerceMoney, isIsoDate, json, readJsonBody } from '../_utils.js'

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
      UPDATE lancamentos
      SET data = ${data}::date,
          descricao = ${descricao.trim()},
          categoria = ${categoria.trim()},
          tipo = ${tipo},
          valor = ${valor},
          status = ${status},
          classe_saida = ${tipo === 'Saída' ? classe_saida : null}
      WHERE id = ${id}
      RETURNING id
    `
    if (!rows.length) return json(res, 404, { error: 'Não encontrado' })
    return json(res, 200, { ok: true })
  }

  if (req.method === 'DELETE') {
    const rows = await sql`DELETE FROM lancamentos WHERE id = ${id} RETURNING id`
    if (!rows.length) return json(res, 404, { error: 'Não encontrado' })
    return json(res, 200, { ok: true })
  }

  return json(res, 405, { error: 'Method not allowed' })
}
