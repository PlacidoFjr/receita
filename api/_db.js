import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL (ou POSTGRES_URL) não configurada')
}

export const sql = neon(DATABASE_URL)

let schemaReady = false

export async function ensureSchema() {
  if (schemaReady) return

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);`

  await sql`
    CREATE TABLE IF NOT EXISTS lancamentos (
      id SERIAL PRIMARY KEY,
      data DATE NOT NULL,
      descricao TEXT NOT NULL,
      categoria TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
      valor NUMERIC(12, 2) NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Pago', 'Pendente', 'Recebido')),
      classe_saida TEXT CHECK (classe_saida IN ('Fixos', 'Variáveis'))
    );
  `
  await sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`
  await sql`CREATE INDEX IF NOT EXISTS idx_lancamentos_user_id ON lancamentos (user_id);`
  await sql`CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos (data);`
  await sql`CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo ON lancamentos (tipo);`

  await sql`
    CREATE TABLE IF NOT EXISTS parcelamentos (
      id SERIAL PRIMARY KEY,
      item TEXT NOT NULL,
      valor_total NUMERIC(12, 2) NOT NULL,
      qtd_parcelas INTEGER NOT NULL,
      parcela_atual INTEGER NOT NULL
    );
  `
  await sql`ALTER TABLE parcelamentos ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`
  await sql`CREATE INDEX IF NOT EXISTS idx_parcelamentos_user_id ON parcelamentos (user_id);`
  await sql`CREATE INDEX IF NOT EXISTS idx_parcelamentos_item ON parcelamentos (item);`

  schemaReady = true
}
