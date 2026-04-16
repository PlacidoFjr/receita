import './App.css'
import { Dashboard } from './pages/Dashboard'
import { Lancamentos } from './pages/Lancamentos'
import { Parcelamentos } from './pages/Parcelamentos'
import { Layout } from './ui/Layout'
import { useHashRoute } from './ui/route'

function App() {
  const { route } = useHashRoute()

  const title =
    route === 'dashboard' ? 'Dashboard' : route === 'lancamentos' ? 'Lançamentos' : 'Parcelamentos'

  return (
    <Layout title={title} route={route}>
      {route === 'dashboard' ? <Dashboard /> : null}
      {route === 'lancamentos' ? <Lancamentos /> : null}
      {route === 'parcelamentos' ? <Parcelamentos /> : null}
    </Layout>
  )
}

export default App
