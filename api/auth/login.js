import { ensureSchema } from '../_db.js'
import { json, readJsonBody } from '../_utils.js'
import { login } from '../_auth.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  await ensureSchema()
  try {
    const body = await readJsonBody(req)
    const result = await login({ email: body?.email, password: body?.password })
    return json(res, 200, result)
  } catch (e) {
    return json(res, 400, { error: e instanceof Error ? e.message : 'Erro ao entrar' })
  }
}

