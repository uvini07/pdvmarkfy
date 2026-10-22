// O salão de cada filial, montado na retaguarda: ambientes (Salão, Varanda,
// 2º andar…) com as mesas e os elementos que ajudam a se localizar no mapa
// (balcão, parede, porta, planta, área e texto).
//
//   ambientes: { filialId, nome, ordem, largura, altura, elementos: [...] }
//   elemento:  { id, tipo, x, y, w, h, rot, ... }
//     mesa →   { forma: 'quadrada' | 'retangular' | 'redonda' | 'banqueta', numero, lugares, ativa }
//     outros → { rotulo }
//
// Posições em unidades do desenho (1 unidade = 1 px no zoom de 100%), a
// partir do canto de cima à esquerda; o giro é em graus, em volta do centro.
// O id da mesa nunca muda: é ele que liga a mesa às contas abertas no caixa.

import { novoId } from '../lib/seguranca.js'
import { textoLimpo } from '../lib/validacao.js'

export const GRADE = 20
export const TAMANHO_PADRAO = { largura: 1200, altura: 800 }
export const TAMANHO_MIN = { largura: 400, altura: 300 }
export const TAMANHO_MAX = { largura: 4000, altura: 3000 }
export const LUGARES_MAX = 20

export const FORMAS_MESA = {
  quadrada: { nome: 'Quadrada', w: 80, h: 80, lugares: 4 },
  retangular: { nome: 'Retangular', w: 160, h: 80, lugares: 6 },
  redonda: { nome: 'Redonda', w: 80, h: 80, lugares: 4 },
  banqueta: { nome: 'Banqueta', w: 40, h: 40, lugares: 1 },
}

export const ELEMENTOS = {
  balcao: { nome: 'Balcão', w: 240, h: 60, rotulo: 'Balcão' },
  parede: { nome: 'Parede', w: 240, h: 12, rotulo: '' },
  porta: { nome: 'Porta', w: 80, h: 20, rotulo: 'Entrada' },
  planta: { nome: 'Planta', w: 40, h: 40, rotulo: '' },
  area: { nome: 'Área', w: 200, h: 140, rotulo: 'Cozinha' },
  texto: { nome: 'Texto', w: 140, h: 40, rotulo: 'Texto' },
}

// Formas que ficam sempre com largura = altura
export const sempreRedondo = (el) => (el.tipo === 'mesa' && (el.forma === 'redonda' || el.forma === 'banqueta')) || el.tipo === 'planta'

export const ehMesa = (el) => el.tipo === 'mesa'

// "12" vira "Mesa 12"; um nome escrito ("Varanda 3", "VIP") fica como está.
export const nomeMesa = (mesa) => {
  const n = String(mesa?.numero ?? '').trim()
  return /^\d+$/.test(n) ? `Mesa ${n}` : n || 'Mesa sem número'
}

const chaveNumero = (n) => String(n ?? '').trim().toLowerCase()

// Ordem natural: Mesa 2 antes da Mesa 10
export const compararMesas = (a, b) => String(a.numero).localeCompare(String(b.numero), 'pt-BR', { numeric: true, sensitivity: 'base' })

export const ambientesDaFilial = (ambientes, filialId) => ambientes.filter((a) => a.filialId === filialId).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

// Todas as mesas da filial, com o ambiente de cada uma
export function mesasDoSalao(ambientes, filialId) {
  return ambientesDaFilial(ambientes, filialId).flatMap((a) =>
    a.elementos.filter(ehMesa).map((m) => ({ ...m, ambienteId: a.id, ambienteNome: a.nome, nome: nomeMesa(m) })),
  )
}

export const encaixar = (v, passo = GRADE) => Math.round(v / passo) * passo

// Próximo número livre: um a mais que o maior número já usado
export function proximoNumero(ambientes, quantos = 1) {
  const usados = new Set(ambientes.flatMap((a) => a.elementos.filter(ehMesa).map((m) => chaveNumero(m.numero))))
  const maior = Math.max(0, ...[...usados].filter((n) => /^\d+$/.test(n)).map(Number))
  const lista = []
  for (let n = maior + 1; lista.length < quantos; n++) if (!usados.has(String(n))) lista.push(String(n))
  return lista
}

export function novaMesa(forma, { x = 0, y = 0, numero }) {
  const f = FORMAS_MESA[forma] || FORMAS_MESA.quadrada
  return { id: novoId(), tipo: 'mesa', forma, x, y, w: f.w, h: f.h, rot: 0, numero, lugares: f.lugares, ativa: true }
}

export function novoElemento(tipo, { x = 0, y = 0 }) {
  const e = ELEMENTOS[tipo]
  return { id: novoId(), tipo, x, y, w: e.w, h: e.h, rot: 0, rotulo: e.rotulo }
}

export const novoAmbiente = (filialId, nome, ordem = 0) => ({ id: novoId(), filialId, nome, ordem, ...TAMANHO_PADRAO, elementos: [] })

// Número já usado por outra mesa da filial (em qualquer ambiente)?
export function numeroRepetido(ambientes, numero, mesaId) {
  const k = chaveNumero(numero)
  return ambientes.some((a) => a.elementos.some((e) => ehMesa(e) && e.id !== mesaId && chaveNumero(e.numero) === k))
}

export function problemaNoNumero(ambientes, numero, mesaId) {
  const n = textoLimpo(numero, 12)
  if (!n) return 'Dê um número ou nome à mesa.'
  if (numeroRepetido(ambientes, n, mesaId)) return `Já existe a ${nomeMesa({ numero: n })} neste salão.`
  return null
}

// Caixa (sem giro) que envolve um elemento girado
export function caixaGirada(el) {
  const r = ((el.rot || 0) * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const w = el.w * c + el.h * s
  const h = el.w * s + el.h * c
  const cx = el.x + el.w / 2
  const cy = el.y + el.h / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

// Retângulo que envolve todos os elementos (para enquadrar o mapa)
export function caixaDosElementos(elementos) {
  if (!elementos.length) return null
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const el of elementos) {
    const c = caixaGirada(el)
    x1 = Math.min(x1, c.x)
    y1 = Math.min(y1, c.y)
    x2 = Math.max(x2, c.x + c.w)
    y2 = Math.max(y2, c.y + c.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

// Mesas com o tampo em cima de outra mesa (um engano comum ao arrastar).
// Encostar não conta: só sobrepor mais que alguns pontos.
export function mesasSobrepostas(elementos) {
  const caixas = elementos.filter(ehMesa).map((m) => ({ id: m.id, c: caixaGirada(m) }))
  const ids = new Set()
  const f = 4
  for (let i = 0; i < caixas.length; i++)
    for (let j = i + 1; j < caixas.length; j++) {
      const a = caixas[i].c
      const b = caixas[j].c
      if (a.x + f < b.x + b.w - f && a.x + a.w - f > b.x + f && a.y + f < b.y + b.h - f && a.y + a.h - f > b.y + f) {
        ids.add(caixas[i].id)
        ids.add(caixas[j].id)
      }
    }
  return ids
}

// Mantém o elemento dentro do ambiente (pelo centro, para elementos girados)
export function dentroDoAmbiente(el, amb) {
  const cx = Math.min(Math.max(el.x + el.w / 2, 0), amb.largura)
  const cy = Math.min(Math.max(el.y + el.h / 2, 0), amb.altura)
  const x = Math.round(cx - el.w / 2)
  const y = Math.round(cy - el.h / 2)
  // Sem mudança devolve o mesmo objeto: o editor só grava o que mudou
  return x === el.x && y === el.y ? el : { ...el, x, y }
}

// Lugar livre para um elemento novo, perto do ponto pedido: procura em
// espiral um espaço que não encoste em nada. Mesa pede folga maior, por
// causa das cadeiras em volta.
export function lugarLivre(elementos, w, h, amb, perto = { x: amb.largura / 2, y: amb.altura / 2 }, folga = GRADE / 2) {
  const bate = (x, y) => elementos.some((e) => {
    const c = caixaGirada(e)
    return x < c.x + c.w + folga && x + w + folga > c.x && y < c.y + c.h + folga && y + h + folga > c.y
  })
  const x0 = encaixar(perto.x - w / 2)
  const y0 = encaixar(perto.y - h / 2)
  for (let raio = 0; raio < 40; raio++) {
    for (let dx = -raio; dx <= raio; dx++)
      for (let dy = -raio; dy <= raio; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue
        const x = x0 + dx * GRADE * 2
        const y = y0 + dy * GRADE * 2
        if (x < 0 || y < 0 || x + w > amb.largura || y + h > amb.altura) continue
        if (!bate(x, y)) return { x, y }
      }
  }
  return { x: Math.max(0, Math.min(x0, amb.largura - w)), y: Math.max(0, Math.min(y0, amb.altura - h)) }
}

// Cadeiras em volta da mesa, em coordenadas da própria mesa (sem giro).
// Nas retangulares os lugares vão primeiro para os lados compridos.
export function cadeirasDaMesa(mesa) {
  const n = Math.max(0, Math.min(LUGARES_MAX, mesa.lugares || 0))
  if (!n || mesa.forma === 'banqueta') return []
  const prof = 12
  const folga = 5
  if (mesa.forma === 'redonda') {
    const r = mesa.w / 2
    const largura = Math.min(26, ((2 * Math.PI * (r + folga + prof / 2)) / n) * 0.7)
    return Array.from({ length: n }, (_, i) => {
      const ang = (i / n) * 360 - 90
      const a = (ang * Math.PI) / 180
      const d = r + folga + prof / 2
      return { cx: r + Math.cos(a) * d, cy: r + Math.sin(a) * d, w: largura, h: prof, rot: ang + 90 }
    })
  }
  const lados = [
    { lado: 'topo', len: mesa.w, k: 0 },
    { lado: 'base', len: mesa.w, k: 0 },
    { lado: 'esq', len: mesa.h, k: 0 },
    { lado: 'dir', len: mesa.h, k: 0 },
  ]
  for (let i = 0; i < n; i++) {
    let melhor = lados[0]
    for (const l of lados) if (l.len / (l.k + 1) > melhor.len / (melhor.k + 1) + 0.001) melhor = l
    melhor.k++
  }
  const cadeiras = []
  for (const l of lados) {
    for (let i = 0; i < l.k; i++) {
      const p = ((i + 0.5) / l.k) * l.len
      const largura = Math.min(28, (l.len / l.k) * 0.72)
      if (l.lado === 'topo') cadeiras.push({ cx: p, cy: -folga - prof / 2, w: largura, h: prof, rot: 0 })
      if (l.lado === 'base') cadeiras.push({ cx: p, cy: mesa.h + folga + prof / 2, w: largura, h: prof, rot: 0 })
      if (l.lado === 'esq') cadeiras.push({ cx: -folga - prof / 2, cy: p, w: largura, h: prof, rot: 90 })
      if (l.lado === 'dir') cadeiras.push({ cx: mesa.w + folga + prof / 2, cy: p, w: largura, h: prof, rot: 90 })
    }
  }
  return cadeiras
}

// ---------------------------------------------------------------------------
// Alinhar e distribuir vários elementos (pela caixa sem giro)

export function alinhar(elementos, como) {
  if (elementos.length < 2) return elementos
  const x1 = Math.min(...elementos.map((e) => e.x))
  const y1 = Math.min(...elementos.map((e) => e.y))
  const x2 = Math.max(...elementos.map((e) => e.x + e.w))
  const y2 = Math.max(...elementos.map((e) => e.y + e.h))
  return elementos.map((e) => {
    if (como === 'esquerda') return { ...e, x: x1 }
    if (como === 'direita') return { ...e, x: x2 - e.w }
    if (como === 'centro') return { ...e, x: Math.round((x1 + x2) / 2 - e.w / 2) }
    if (como === 'topo') return { ...e, y: y1 }
    if (como === 'base') return { ...e, y: y2 - e.h }
    if (como === 'meio') return { ...e, y: Math.round((y1 + y2) / 2 - e.h / 2) }
    return e
  })
}

// Espaços iguais entre os elementos, do primeiro ao último
export function distribuir(elementos, eixo) {
  if (elementos.length < 3) return elementos
  const pos = eixo === 'h' ? 'x' : 'y'
  const tam = eixo === 'h' ? 'w' : 'h'
  const ordem = [...elementos].sort((a, b) => a[pos] - b[pos])
  const inicio = ordem[0][pos]
  const fim = ordem[ordem.length - 1][pos] + ordem[ordem.length - 1][tam]
  const ocupado = ordem.reduce((t, e) => t + e[tam], 0)
  const espaco = (fim - inicio - ocupado) / (ordem.length - 1)
  let atual = inicio
  const novos = new Map()
  for (const e of ordem) {
    novos.set(e.id, { ...e, [pos]: Math.round(atual) })
    atual += e[tam] + espaco
  }
  return elementos.map((e) => novos.get(e.id))
}

// Várias mesas iguais de uma vez, em fileiras, a partir de um canto
export function gradeDeMesas({ quantidade, forma, lugares, colunas, numeros, inicio, espaco = GRADE * 2 }) {
  const f = FORMAS_MESA[forma]
  const passoX = f.w + espaco + (forma === 'banqueta' ? 0 : 24)
  const passoY = f.h + espaco + (forma === 'banqueta' ? 0 : 24)
  return Array.from({ length: quantidade }, (_, i) => ({
    ...novaMesa(forma, { x: inicio.x + (i % colunas) * passoX, y: inicio.y + Math.floor(i / colunas) * passoY, numero: numeros[i] }),
    lugares,
  }))
}

// ---------------------------------------------------------------------------
// Diferença entre duas versões do salão, para o registro de segurança: só o
// que importa para o dinheiro (mesas novas, apagadas e renomeadas). Mover
// mesa de lugar não vai para o registro.

export function diferencaSalao(antes, depois) {
  const mesas = (lista) => new Map(lista.flatMap((a) => a.elementos.filter(ehMesa).map((m) => [m.id, m])))
  const ambs = (lista) => new Map(lista.map((a) => [a.id, a]))
  const ma = mesas(antes)
  const md = mesas(depois)
  const aa = ambs(antes)
  const ad = ambs(depois)
  const partes = []
  const novas = [...md.values()].filter((m) => !ma.has(m.id)).map(nomeMesa)
  const apagadas = [...ma.values()].filter((m) => !md.has(m.id)).map(nomeMesa)
  const renomeadas = [...md.values()].filter((m) => ma.has(m.id) && chaveNumero(ma.get(m.id).numero) !== chaveNumero(m.numero)).map((m) => `${nomeMesa(ma.get(m.id))} → ${nomeMesa(m)}`)
  const ambNovos = [...ad.values()].filter((a) => !aa.has(a.id)).map((a) => a.nome)
  const ambApagados = [...aa.values()].filter((a) => !ad.has(a.id)).map((a) => a.nome)
  const ambRenomeados = [...ad.values()].filter((a) => aa.has(a.id) && aa.get(a.id).nome !== a.nome).map((a) => `${aa.get(a.id).nome} → ${a.nome}`)
  if (ambNovos.length) partes.push(`ambiente novo: ${ambNovos.join(', ')}`)
  if (ambApagados.length) partes.push(`ambiente apagado: ${ambApagados.join(', ')}`)
  if (ambRenomeados.length) partes.push(`ambiente renomeado: ${ambRenomeados.join(', ')}`)
  if (novas.length) partes.push(`mesas novas: ${novas.join(', ')}`)
  if (apagadas.length) partes.push(`mesas apagadas: ${apagadas.join(', ')}`)
  if (renomeadas.length) partes.push(`mesas renomeadas: ${renomeadas.join(', ')}`)
  return partes.join('; ')
}

// ---------------------------------------------------------------------------
// Modelos prontos, para não começar do zero. Ids novos a cada uso.

const m = (forma, x, y, numero, extra = {}) => ({ ...novaMesa(forma, { x, y, numero }), ...extra })
const e = (tipo, x, y, extra = {}) => ({ ...novoElemento(tipo, { x, y }), ...extra })

export const MODELOS = [
  {
    id: 'lanchonete',
    nome: 'Lanchonete',
    descricao: '6 mesas e o balcão, num ambiente só.',
    montar: () => [
      {
        nome: 'Salão',
        largura: 1000,
        altura: 640,
        elementos: [
          e('parede', 0, 0, { w: 1000, h: 12 }),
          e('balcao', 60, 60, { w: 360, h: 60 }),
          e('area', 640, 40, { w: 300, h: 140, rotulo: 'Cozinha' }),
          m('quadrada', 100, 240, '1'),
          m('quadrada', 300, 240, '2'),
          m('quadrada', 500, 240, '3'),
          m('redonda', 100, 420, '4', { lugares: 2, w: 60, h: 60 }),
          m('redonda', 300, 420, '5', { lugares: 2, w: 60, h: 60 }),
          m('retangular', 480, 420, '6'),
          e('planta', 900, 560),
          e('porta', 820, 616, { rotulo: 'Entrada', w: 120 }),
        ],
      },
    ],
  },
  {
    id: 'salao-varanda',
    nome: 'Salão e varanda',
    descricao: '10 mesas no salão e 4 na varanda.',
    montar: () => [
      {
        nome: 'Salão',
        largura: 1200,
        altura: 760,
        elementos: [
          e('parede', 0, 0, { w: 1200, h: 12 }),
          e('balcao', 60, 60, { w: 440, h: 60 }),
          e('area', 860, 40, { w: 300, h: 160, rotulo: 'Cozinha' }),
          e('area', 1000, 560, { w: 160, h: 160, rotulo: 'Banheiros' }),
          m('quadrada', 100, 220, '1'),
          m('quadrada', 280, 220, '2'),
          m('quadrada', 460, 220, '3'),
          m('quadrada', 640, 220, '4'),
          m('retangular', 100, 400, '5'),
          m('retangular', 360, 400, '6'),
          m('redonda', 640, 400, '7', { lugares: 5, w: 100, h: 100 }),
          m('redonda', 100, 600, '8', { lugares: 2, w: 60, h: 60 }),
          m('redonda', 280, 600, '9', { lugares: 2, w: 60, h: 60 }),
          m('redonda', 460, 600, '10', { lugares: 2, w: 60, h: 60 }),
          e('porta', 820, 736, { w: 140, rotulo: 'Entrada' }),
          e('planta', 1100, 260),
        ],
      },
      {
        nome: 'Varanda',
        largura: 900,
        altura: 480,
        elementos: [
          e('parede', 0, 0, { w: 900, h: 12 }),
          e('texto', 340, 420, { rotulo: 'Rua', w: 200 }),
          m('quadrada', 100, 120, '11'),
          m('quadrada', 300, 120, '12'),
          m('quadrada', 500, 120, '13'),
          m('retangular', 260, 280, '14', { lugares: 8, w: 240 }),
          e('planta', 60, 380),
          e('planta', 800, 380),
        ],
      },
    ],
  },
  {
    id: 'balcao',
    nome: 'Balcão com banquetas',
    descricao: '8 banquetas no balcão e 2 mesas altas.',
    montar: () => [
      {
        nome: 'Balcão',
        largura: 1000,
        altura: 520,
        elementos: [
          e('area', 60, 40, { w: 880, h: 100, rotulo: 'Cozinha e chapa' }),
          e('balcao', 120, 160, { w: 760, h: 50, rotulo: 'Balcão' }),
          ...Array.from({ length: 8 }, (_, i) => m('banqueta', 150 + i * 92, 240, `B${i + 1}`)),
          m('redonda', 260, 360, '1', { w: 70, h: 70, lugares: 3 }),
          m('redonda', 660, 360, '2', { w: 70, h: 70, lugares: 3 }),
          e('porta', 440, 500, { w: 120, rotulo: 'Entrada' }),
        ],
      },
    ],
  },
]

export function aplicarModelo(modeloId, filialId, ordemInicial = 0) {
  const modelo = MODELOS.find((x) => x.id === modeloId)
  return modelo.montar().map((a, i) => ({ id: novoId(), filialId, ordem: ordemInicial + i, ...a }))
}

// Cópia do salão de outra filial: mesmos ambientes e números, ids novos
export function copiarSalao(ambientesOrigem, filialId) {
  return ambientesOrigem.map((a, i) => ({
    id: novoId(),
    filialId,
    nome: a.nome,
    ordem: i,
    largura: a.largura,
    altura: a.altura,
    elementos: a.elementos.map((el) => ({ ...el, id: novoId() })),
  }))
}
