// Service worker do PDV. Este arquivo é um modelo: no `npm run build` o Vite
// preenche a versão e a lista de arquivos e grava o resultado em dist/sw.js.
//
// Por que o visual não quebra: o HTML, o CSS, o JavaScript, as fontes e as
// fotos de UMA versão ficam juntos no mesmo cache e são servidos sempre juntos.
// Uma versão nova só entra quando o usuário toca em "Atualizar" (ou fecha
// todas as janelas do PDV) — nunca um HTML novo com o CSS velho, ou o contrário.

const VERSAO = '__VERSAO__'
const ARQUIVOS = __ARQUIVOS__
const CACHE = `pdv-${VERSAO}`

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      // cache: 'reload' pula o cache HTTP do navegador: baixa a versão nova de verdade.
      cache.addAll(ARQUIVOS.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('pdv-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (evento) => {
  if (evento.data === 'atualizar') self.skipWaiting()
})

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  if (pedido.method !== 'GET') return
  const url = new URL(pedido.url)
  if (url.origin !== self.location.origin) return

  // As rotas são pelo hash (#/caixa), então toda abertura de página é o index.html.
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      caches.open(CACHE).then((cache) => cache.match('/index.html', { ignoreVary: true })).then((r) => r || fetch(pedido)),
    )
    return
  }

  // ignoreVary: o JS, o CSS e as fontes são pedidos com `crossorigin` (levam o
  // cabeçalho Origin) e o servidor responde com "Vary: Origin"; sem isso a
  // cópia guardada não casaria e o PDV abriria sem estilo quando sem internet.
  evento.respondWith(
    caches.open(CACHE).then((cache) => cache.match(pedido, { ignoreSearch: true, ignoreVary: true })).then((r) => r || fetch(pedido)),
  )
})
