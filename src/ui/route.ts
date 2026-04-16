import { useEffect, useMemo, useState } from 'react'

export type RouteKey = 'dashboard' | 'lancamentos' | 'parcelamentos'

function routeFromHash(hash: string): RouteKey {
  const h = hash.replace('#', '').trim()
  if (h === 'lancamentos' || h === 'parcelamentos' || h === 'dashboard') return h
  return 'dashboard'
}

export function useHashRoute() {
  const [route, setRoute] = useState<RouteKey>(() => routeFromHash(window.location.hash))

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (next: RouteKey) => {
    window.location.hash = next
  }

  return useMemo(() => ({ route, navigate }), [route])
}
