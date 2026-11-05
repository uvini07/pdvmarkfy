// Registra o service worker (só na versão publicada: no `npm run dev` ele
// guardaria CSS antigo em cache e atrapalharia o desenvolvimento) e avisa a
// tela quando há uma versão nova esperando.

let esperando = null
let aoMudar = () => {}
let atualizando = false

export function aoTerVersaoNova(fn) {
  aoMudar = fn
  if (esperando) fn(true)
}

export function atualizarAgora() {
  if (!esperando) return
  atualizando = true
  esperando.postMessage('atualizar')
}

function avisar(worker) {
  esperando = worker
  aoMudar(true)
}

export function registrarPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // Pede ao navegador para não apagar os dados do PDV quando faltar espaço em disco.
  navigator.storage?.persist?.().catch(() => {})

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Só recarrega quando foi o usuário que pediu: na primeira instalação o
    // controle também muda, e recarregar ali no meio do uso seria ruim.
    if (atualizando) window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) avisar(reg.waiting)
        reg.addEventListener('updatefound', () => {
          const novo = reg.installing
          novo?.addEventListener('statechange', () => {
            if (novo.state === 'installed' && navigator.serviceWorker.controller) avisar(novo)
          })
        })
        // O caixa fica aberto o dia todo: procura versão nova de hora em hora.
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
      })
      .catch(() => {})
  })
}
