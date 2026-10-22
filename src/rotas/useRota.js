// Rotas pelo hash (#/caixa, #/admin/produtos…). Funciona em qualquer
// hospedagem estática e não depende de biblioteca.

import { useSyncExternalStore } from 'react'

const ler = () => window.location.hash.replace(/^#/, '') || '/'

const assinar = (fn) => {
  window.addEventListener('hashchange', fn)
  return () => window.removeEventListener('hashchange', fn)
}

export function useRota() {
  const caminho = useSyncExternalStore(assinar, ler)
  const [semBusca, busca = ''] = caminho.split('?')
  const partes = semBusca.split('/').filter(Boolean)
  return { caminho: semBusca, partes, parametros: new URLSearchParams(busca) }
}

export function ir(caminho, { substituir = false } = {}) {
  const alvo = `#${caminho}`
  if (substituir) window.location.replace(alvo)
  else window.location.hash = caminho
}
