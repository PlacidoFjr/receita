import { deleteSession } from '../_auth.js'
import { json } from '../_utils.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const raw = req.headers?.authorization || req.headers?.Authorization
  const m = typeof raw === 'string' ? raw.match(/^Bearer\s+(.+)$/i) : null
  const token = m?.[1]?.trim()
  if (token) await deleteSession(token)
  return json(res, 200, { ok: true })
}

