import type { ReactNode } from 'react'
import type { RouteKey } from './route'

export function Layout(props: {
  title: string
  route: RouteKey
  userEmail: string
  onLogout: () => void
  children: ReactNode
}) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Receita</div>
        <nav className="nav">
          <a className={props.route === 'dashboard' ? 'nav__item nav__item--active' : 'nav__item'} href="#dashboard">
            Dashboard
          </a>
          <a className={props.route === 'lancamentos' ? 'nav__item nav__item--active' : 'nav__item'} href="#lancamentos">
            Lançamentos
          </a>
          <a className={props.route === 'parcelamentos' ? 'nav__item nav__item--active' : 'nav__item'} href="#parcelamentos">
            Parcelamentos
          </a>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <h1 className="page-title">{props.title}</h1>
          <div className="topbar__right">
            <div className="muted">{props.userEmail}</div>
            <button className="btn btn--small" onClick={props.onLogout} type="button">
              Sair
            </button>
          </div>
        </header>
        <div className="content">{props.children}</div>
      </main>
    </div>
  )
}
