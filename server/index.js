import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PORT = Number(process.env.PORT ?? 5001)
const DB_PATH = join(__dirname, '..', 'data', 'receita.sqlite')

mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lancamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
  valor REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pago', 'Pendente', 'Recebido')),
  classe_saida TEXT CHECK (classe_saida IN ('Fixos', 'Variáveis'))
);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos (data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo ON lancamentos (tipo);

CREATE TABLE IF NOT EXISTS parcelamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item TEXT NOT NULL,
  valor_total REAL NOT NULL,
  qtd_parcelas INTEGER NOT NULL,
  parcela_atual INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_parcelamentos_item ON parcelamentos (item);
`)

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(body))
}

function text(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(body)
}

async function readJsonBody(req) {
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

function parseId(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  const idStr = parts[parts.length - 1]
  const id = Number(idStr)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function coerceMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function computeParcelamento({ valor_total, qtd_parcelas, parcela_atual }) {
  const valor_mensal = qtd_parcelas > 0 ? valor_total / qtd_parcelas : 0
  const pago = valor_mensal * parcela_atual
  const valor_restante = valor_total - pago
  const progresso = qtd_parcelas > 0 ? parcela_atual / qtd_parcelas : 0
  return {
    valor_mensal: Math.round(valor_mensal * 100) / 100,
    valor_restante: Math.round(valor_restante * 100) / 100,
    progresso: Math.max(0, Math.min(1, progresso)),
  }
}

function buildWhere(params, allowed) {
  const clauses = []
  const values = []

  for (const [key, column] of Object.entries(allowed)) {
    const v = params.get(key)
    if (v) {
      clauses.push(`${column} = ?`)
      values.push(v)
    }
  }

  const q = params.get('q')
  if (q) {
    clauses.push(`(descricao LIKE ? OR categoria LIKE ?)`)
    values.push(`%${q}%`, `%${q}%`)
  }

  const startDate = params.get('startDate')
  if (startDate && isIsoDate(startDate)) {
    clauses.push(`data >= ?`)
    values.push(startDate)
  }

  const endDate = params.get('endDate')
  if (endDate && isIsoDate(endDate)) {
    clauses.push(`data <= ?`)
    values.push(endDate)
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return { whereSql, values }
}

function parsePageParams(params) {
  const page = Math.max(1, Number(params.get('page') ?? 1))
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? 10)))
  const offset = (page - 1) * pageSize
  return { page, pageSize, offset }
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      text(res, 400, 'Bad Request')
      return
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }

    const url = new URL(req.url, `http://${req.headers.host}`)
    const { pathname, searchParams } = url

    if (pathname === '/api/health' && req.method === 'GET') {
      json(res, 200, { ok: true })
      return
    }

    if (pathname === '/api/lancamentos' && req.method === 'GET') {
      const { whereSql, values } = buildWhere(searchParams, {
        tipo: 'tipo',
        status: 'status',
        categoria: 'categoria',
        classe_saida: 'classe_saida',
      })
      const { page, pageSize, offset } = parsePageParams(searchParams)

      const totalRow = db
        .prepare(`SELECT COUNT(*) AS total FROM lancamentos ${whereSql}`)
        .get(...values)

      const rows = db
        .prepare(
          `SELECT id, data, descricao, categoria, tipo, valor, status, classe_saida
           FROM lancamentos
           ${whereSql}
           ORDER BY data DESC, id DESC
           LIMIT ? OFFSET ?`,
        )
        .all(...values, pageSize, offset)

      json(res, 200, { items: rows, total: totalRow.total, page, pageSize })
      return
    }

    if (pathname === '/api/lancamentos' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const data = body?.data
      const descricao = body?.descricao
      const categoria = body?.categoria
      const tipo = body?.tipo
      const valor = coerceMoney(body?.valor)
      const status = body?.status
      const classe_saida = body?.classe_saida ?? null

      if (!isIsoDate(data)) return json(res, 400, { error: 'Data inválida' })
      if (typeof descricao !== 'string' || !descricao.trim())
        return json(res, 400, { error: 'Descrição inválida' })
      if (typeof categoria !== 'string' || !categoria.trim())
        return json(res, 400, { error: 'Categoria inválida' })
      if (tipo !== 'Entrada' && tipo !== 'Saída')
        return json(res, 400, { error: 'Tipo inválido' })
      if (valor === null || valor < 0) return json(res, 400, { error: 'Valor inválido' })
      if (!['Pago', 'Pendente', 'Recebido'].includes(status))
        return json(res, 400, { error: 'Status inválido' })
      if (tipo === 'Saída' && !['Fixos', 'Variáveis'].includes(classe_saida))
        return json(res, 400, { error: 'Classe da saída inválida' })

      const info = db
        .prepare(
          `INSERT INTO lancamentos (data, descricao, categoria, tipo, valor, status, classe_saida)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          data,
          descricao.trim(),
          categoria.trim(),
          tipo,
          valor,
          status,
          tipo === 'Saída' ? classe_saida : null,
        )

      json(res, 201, { id: Number(info.lastInsertRowid) })
      return
    }

    if (pathname.startsWith('/api/lancamentos/') && req.method === 'PUT') {
      const id = parseId(pathname)
      if (!id) return json(res, 400, { error: 'ID inválido' })

      const body = await readJsonBody(req)
      const data = body?.data
      const descricao = body?.descricao
      const categoria = body?.categoria
      const tipo = body?.tipo
      const valor = coerceMoney(body?.valor)
      const status = body?.status
      const classe_saida = body?.classe_saida ?? null

      if (!isIsoDate(data)) return json(res, 400, { error: 'Data inválida' })
      if (typeof descricao !== 'string' || !descricao.trim())
        return json(res, 400, { error: 'Descrição inválida' })
      if (typeof categoria !== 'string' || !categoria.trim())
        return json(res, 400, { error: 'Categoria inválida' })
      if (tipo !== 'Entrada' && tipo !== 'Saída')
        return json(res, 400, { error: 'Tipo inválido' })
      if (valor === null || valor < 0) return json(res, 400, { error: 'Valor inválido' })
      if (!['Pago', 'Pendente', 'Recebido'].includes(status))
        return json(res, 400, { error: 'Status inválido' })
      if (tipo === 'Saída' && !['Fixos', 'Variáveis'].includes(classe_saida))
        return json(res, 400, { error: 'Classe da saída inválida' })

      const info = db
        .prepare(
          `UPDATE lancamentos
           SET data = ?, descricao = ?, categoria = ?, tipo = ?, valor = ?, status = ?, classe_saida = ?
           WHERE id = ?`,
        )
        .run(
          data,
          descricao.trim(),
          categoria.trim(),
          tipo,
          valor,
          status,
          tipo === 'Saída' ? classe_saida : null,
          id,
        )

      if (info.changes === 0) return json(res, 404, { error: 'Não encontrado' })
      json(res, 200, { ok: true })
      return
    }

    if (pathname.startsWith('/api/lancamentos/') && req.method === 'DELETE') {
      const id = parseId(pathname)
      if (!id) return json(res, 400, { error: 'ID inválido' })

      const info = db.prepare(`DELETE FROM lancamentos WHERE id = ?`).run(id)
      if (info.changes === 0) return json(res, 404, { error: 'Não encontrado' })
      json(res, 200, { ok: true })
      return
    }

    if (pathname === '/api/parcelamentos' && req.method === 'GET') {
      const q = searchParams.get('q')
      const clauses = []
      const values = []
      if (q) {
        clauses.push(`item LIKE ?`)
        values.push(`%${q}%`)
      }
      const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      const { page, pageSize, offset } = parsePageParams(searchParams)

      const totalRow = db
        .prepare(`SELECT COUNT(*) AS total FROM parcelamentos ${whereSql}`)
        .get(...values)

      const rows = db
        .prepare(
          `SELECT id, item, valor_total, qtd_parcelas, parcela_atual
           FROM parcelamentos
           ${whereSql}
           ORDER BY id DESC
           LIMIT ? OFFSET ?`,
        )
        .all(...values, pageSize, offset)

      const items = rows.map((r) => ({
        ...r,
        ...computeParcelamento(r),
      }))

      const totalMensalRow = db
        .prepare(
          `SELECT SUM(valor_total * 1.0 / qtd_parcelas) AS total_mensal
           FROM parcelamentos
           WHERE parcela_atual < qtd_parcelas`,
        )
        .get()

      json(res, 200, {
        items,
        total: totalRow.total,
        page,
        pageSize,
        total_mensal: Math.round((totalMensalRow.total_mensal ?? 0) * 100) / 100,
      })
      return
    }

    if (pathname === '/api/parcelamentos' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const item = body?.item
      const valor_total = coerceMoney(body?.valor_total)
      const qtd_parcelas = Number(body?.qtd_parcelas)
      const parcela_atual = Number(body?.parcela_atual)

      if (typeof item !== 'string' || !item.trim())
        return json(res, 400, { error: 'Item inválido' })
      if (valor_total === null || valor_total < 0)
        return json(res, 400, { error: 'Valor total inválido' })
      if (!Number.isInteger(qtd_parcelas) || qtd_parcelas <= 0)
        return json(res, 400, { error: 'Quantidade de parcelas inválida' })
      if (!Number.isInteger(parcela_atual) || parcela_atual < 0 || parcela_atual > qtd_parcelas)
        return json(res, 400, { error: 'Parcela atual inválida' })

      const info = db
        .prepare(
          `INSERT INTO parcelamentos (item, valor_total, qtd_parcelas, parcela_atual)
           VALUES (?, ?, ?, ?)`,
        )
        .run(item.trim(), valor_total, qtd_parcelas, parcela_atual)

      json(res, 201, { id: Number(info.lastInsertRowid) })
      return
    }

    if (pathname.startsWith('/api/parcelamentos/') && req.method === 'PUT') {
      const id = parseId(pathname)
      if (!id) return json(res, 400, { error: 'ID inválido' })

      const body = await readJsonBody(req)
      const item = body?.item
      const valor_total = coerceMoney(body?.valor_total)
      const qtd_parcelas = Number(body?.qtd_parcelas)
      const parcela_atual = Number(body?.parcela_atual)

      if (typeof item !== 'string' || !item.trim())
        return json(res, 400, { error: 'Item inválido' })
      if (valor_total === null || valor_total < 0)
        return json(res, 400, { error: 'Valor total inválido' })
      if (!Number.isInteger(qtd_parcelas) || qtd_parcelas <= 0)
        return json(res, 400, { error: 'Quantidade de parcelas inválida' })
      if (!Number.isInteger(parcela_atual) || parcela_atual < 0 || parcela_atual > qtd_parcelas)
        return json(res, 400, { error: 'Parcela atual inválida' })

      const info = db
        .prepare(
          `UPDATE parcelamentos
           SET item = ?, valor_total = ?, qtd_parcelas = ?, parcela_atual = ?
           WHERE id = ?`,
        )
        .run(item.trim(), valor_total, qtd_parcelas, parcela_atual, id)

      if (info.changes === 0) return json(res, 404, { error: 'Não encontrado' })
      json(res, 200, { ok: true })
      return
    }

    if (pathname.startsWith('/api/parcelamentos/') && req.method === 'DELETE') {
      const id = parseId(pathname)
      if (!id) return json(res, 400, { error: 'ID inválido' })

      const info = db.prepare(`DELETE FROM parcelamentos WHERE id = ?`).run(id)
      if (info.changes === 0) return json(res, 404, { error: 'Não encontrado' })
      json(res, 200, { ok: true })
      return
    }

    json(res, 404, { error: 'Rota não encontrada' })
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : 'Erro interno' })
  }
})

server.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}`)
})
