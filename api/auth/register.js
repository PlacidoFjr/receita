import { createSessionForUser, createUser } from '../_auth.js'
import { ensureSchema } from '../_db.js'
import { json, readJsonBody } from '../_utils.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  await ensureSchema()
  try {
    const body = await readJsonBody(req)
    const user = await createUser({ email: body?.email, password: body?.password })
    const token = await createSessionForUser(user.id)
    return json(res, 201, { token, user })
  } catch (e) {
    return json(res, 400, { error: e instanceof Error ? e.message : 'Erro ao cadastrar' })
  }
}

