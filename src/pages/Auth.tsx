import { useState } from 'react'
import { authLogin, authRegister } from '../lib/api'
import { setAuthToken } from '../lib/auth'

export function Auth(props: { onAuthed: (email: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = mode === 'login' ? await authLogin({ email, password }) : await authRegister({ email, password })
      setAuthToken(res.token)
      props.onAuthed(res.user.email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="brand">Receita</div>
        <div className="auth__tabs">
          <button className={mode === 'login' ? 'tab tab--active' : 'tab'} onClick={() => setMode('login')} type="button">
            Entrar
          </button>
          <button
            className={mode === 'register' ? 'tab tab--active' : 'tab'}
            onClick={() => setMode('register')}
            type="button"
          >
            Cadastrar
          </button>
        </div>
        <form className="auth__form" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" required />
          </label>
          <label className="field">
            <span>Senha</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <button className="btn btn--primary" disabled={loading} type="submit">
            {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
          {error ? <div className="error">{error}</div> : null}
        </form>
        <div className="muted auth__hint">Cada usuário vê apenas os próprios lançamentos e parcelamentos.</div>
      </div>
    </div>
  )
}

