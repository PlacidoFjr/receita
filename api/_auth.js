import crypto from 'node:crypto'
import { ensureSchema, sql } from './_db.js'

function base64Url(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(String(password), salt, 32)
  return `${base64Url(salt)}.${base64Url(hash)}`
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const [saltB64, hashB64] = stored.split('.')
  if (!saltB64 || !hashB64) return false
  const salt = Buffer.from(saltB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const expected = Buffer.from(hashB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const actual = crypto.scryptSync(String(password), salt, expected.length)
  return crypto.timingSafeEqual(expected, actual)
}

export async function createUser({ email, password }) {
  await ensureSchema()
  const e = normalizeEmail(email)
  if (!e || !e.includes('@')) throw new Error('Email inválido')
  if (typeof password !== 'string' || password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres')

  const password_hash = hashPassword(password)
  try {
    const rows = await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${e}, ${password_hash})
      RETURNING id, email
    `
    const user = rows[0]

    const countRows = await sql`SELECT COUNT(*)::int AS total FROM users`
    const total = countRows[0]?.total ?? 0
    if (total === 1) {
      await sql`UPDATE lancamentos SET user_id = ${user.id} WHERE user_id IS NULL`
      await sql`UPDATE parcelamentos SET user_id = ${user.id} WHERE user_id IS NULL`
    }

    return user
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('unique')) throw new Error('Email já cadastrado')
    throw err
  }
}

export async function createSessionForUser(userId) {
  await ensureSchema()
  const token = base64Url(crypto.randomBytes(32))
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt}::timestamptz)
  `
  return token
}

export async function getUserFromAuthHeader(req) {
  await ensureSchema()
  const raw = req.headers?.authorization || req.headers?.Authorization
  if (!raw || typeof raw !== 'string') return null
  const m = raw.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const token = m[1].trim()
  if (!token) return null

  const rows = await sql`
    SELECT u.id, u.email
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token}
      AND s.expires_at > NOW()
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function deleteSession(token) {
  await ensureSchema()
  await sql`DELETE FROM sessions WHERE token = ${token}`
}

export async function login({ email, password }) {
  await ensureSchema()
  const e = normalizeEmail(email)
  if (!e || !e.includes('@')) throw new Error('Email inválido')
  if (typeof password !== 'string') throw new Error('Senha inválida')

  const rows = await sql`SELECT id, email, password_hash FROM users WHERE email = ${e} LIMIT 1`
  if (!rows.length) throw new Error('Email ou senha inválidos')
  const user = rows[0]

  if (!verifyPassword(password, user.password_hash)) throw new Error('Email ou senha inválidos')
  const token = await createSessionForUser(user.id)
  return { token, user: { id: user.id, email: user.email } }
}

