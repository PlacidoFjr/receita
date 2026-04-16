import { ensureSchema } from './_db.js'
import { json } from './_utils.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  await ensureSchema()
  return json(res, 200, { ok: true })
}
