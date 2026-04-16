import { useEffect, useState } from 'react'
import './App.css'
import { Auth } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { Lancamentos } from './pages/Lancamentos'
import { Parcelamentos } from './pages/Parcelamentos'
import { authMe, authLogout } from './lib/api'
import { clearAuthToken } from './lib/auth'
import { Layout } from './ui/Layout'
import { useHashRoute } from './ui/route'

function App() {
  const { route } = useHashRoute()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    authMe()
      .then((res) => {
        if (cancelled) return
        setUserEmail(res.user.email)
        setChecking(false)
      })
      .catch(() => {
        if (cancelled) return
        setUserEmail(null)
        setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const logout = async () => {
    try {
      await authLogout()
    } catch (e) {
      void e
    } finally {
      clearAuthToken()
      setUserEmail(null)
      window.location.hash = 'dashboard'
    }
  }

  const title =
    route === 'dashboard' ? 'Dashboard' : route === 'lancamentos' ? 'Lançamentos' : 'Parcelamentos'

  if (checking) {
    return (
      <div className="auth">
        <div className="muted">Carregando…</div>
      </div>
    )
  }

  if (!userEmail) {
    return <Auth onAuthed={(email) => setUserEmail(email)} />
  }

  return (
    <Layout title={title} route={route} userEmail={userEmail} onLogout={logout}>
      {route === 'dashboard' ? <Dashboard /> : null}
      {route === 'lancamentos' ? <Lancamentos /> : null}
      {route === 'parcelamentos' ? <Parcelamentos /> : null}
    </Layout>
  )
}

export default App
