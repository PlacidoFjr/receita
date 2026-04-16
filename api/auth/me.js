import { getUserFromAuthHeader } from '../_auth.js'
import { json } from '../_utils.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })

  const user = await getUserFromAuthHeader(req)
  if (!user) return json(res, 401, { error: 'Não autenticado' })
  return json(res, 200, { user })
}

