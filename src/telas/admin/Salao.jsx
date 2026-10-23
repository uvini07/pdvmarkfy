// Montar o salão: o cliente desenha a loja como ela é — ambientes (Salão,
// Varanda, 2º andar…) com as mesas e as referências que ajudam a se localizar
// (balcão, parede, porta, planta, área, texto). O caixa usa este mapa para
// abrir as contas das mesas.
//
// Arrastar move, os cantos mudam o tamanho e a bolinha de cima gira. Tudo é
// salvo sozinho pouco depois de cada mudança, e dá para desfazer. O desenho é
// um SVG em unidades próprias (1 unidade = 1 px no zoom 100%), com grade de 20.

import { useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { banco, useColecao, useDoc } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { contaAtiva } from '../../dados/mesas.js'
import {
  ELEMENTOS,
  ESPACOS,
  FORMAS_MESA,
  GRADE,
  LUGARES_MAX,
  MODELOS,
  TAMANHO_MAX,
  TAMANHO_MIN,
  acharMesa,
  alinhar,
  ambientesDaFilial,
  aplicarModelo,
  caixaDosElementos,
  caixaGirada,
  copiarSalao,
  dentroDoAmbiente,
  diferencaSalao,
  distribuir,
  ehMesa,
  encaixar,
  gradeDeMesas,
  lugarLivre,
  mesasSobrepostas,
  nomeMesa,
  novaMesa,
  novoAmbiente,
  novoElemento,
  numerosOcupados,
  ordemDeLeitura,
  problemaNoNumero,
  proximoNumero,
  renumerar,
  sempreRedondo,
  sequenciaDeNumeros,
} from '../../dados/salao.js'
import { useSessao } from '../../estado/sessao.js'
import { Pagina, Cartao } from '../../componentes/Pagina.jsx'
import { Modal } from '../../componentes/Modal.jsx'
import { Menu } from '../../componentes/Menu.jsx'
import { Alternador, Botao, BotaoIcone, Campo, Entrada, Segmentos, Selecao, Vazio } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { Decoracao, MapaSalao, MesaDesenho } from '../../componentes/Salao.jsx'
import { novoId } from '../../lib/seguranca.js'
import { textoLimpo } from '../../lib/validacao.js'

// Ordem de desenho: áreas embaixo de tudo, mesas por cima
const CAMADA = { area: 0, parede: 1, balcao: 1, porta: 1, planta: 2, texto: 3, mesa: 4 }
const MINIMO = { mesa: 30, balcao: 20, parede: 4, porta: 10, planta: 16, area: 40, texto: 20 }
const SUGESTOES_AMBIENTE = ['Salão', 'Varanda', '2º andar', 'Área externa', 'Mezanino', 'Deck', 'Reservado']

const limitar = (v, min, max) => Math.min(max, Math.max(min, v))

function rotuloElemento(el) {
  if (ehMesa(el)) return `${nomeMesa(el)} (${FORMAS_MESA[el.forma]?.nome.toLowerCase()}, ${el.lugares} lugar${el.lugares === 1 ? '' : 'es'})`
  return `${ELEMENTOS[el.tipo]?.nome}${el.rotulo ? `: ${el.rotulo}` : ''}`
}

// Miniatura das formas na barra de ferramentas
function MiniForma({ tipo, forma }) {
  const t = tipo === 'mesa' ? forma : tipo
  return (
    <svg className="mini-forma" width="30" height="22" viewBox="0 0 30 22" aria-hidden="true">
      {t === 'quadrada' && (
        <>
          <rect className="mini-forma__cadeira" x="11" y="1" width="8" height="3" rx="1.5" />
          <rect className="mini-forma__cadeira" x="11" y="18" width="8" height="3" rx="1.5" />
          <rect className="mini-forma__cadeira" x="5" y="7" width="3" height="8" rx="1.5" />
          <rect className="mini-forma__cadeira" x="22" y="7" width="3" height="8" rx="1.5" />
          <rect className="mini-forma__tampo" x="9.5" y="5.5" width="11" height="11" rx="2" />
        </>
      )}
      {t === 'retangular' && (
        <>
          <rect className="mini-forma__cadeira" x="6" y="1" width="7" height="3" rx="1.5" />
          <rect className="mini-forma__cadeira" x="17" y="1" width="7" height="3" rx="1.5" />
          <rect className="mini-forma__cadeira" x="6" y="18" width="7" height="3" rx="1.5" />
          <rect className="mini-forma__cadeira" x="17" y="18" width="7" height="3" rx="1.5" />
          <rect className="mini-forma__tampo" x="3.5" y="5.5" width="23" height="11" rx="2" />
        </>
      )}
      {t === 'redonda' && (
        <>
          <rect className="mini-forma__cadeira" x="11" y="0.5" width="8" height="3" rx="1.5" />
          <rect className="mini-forma__cadeira" x="11" y="18.5" width="8" height="3" rx="1.5" />
          <rect className="mini-forma__cadeira" x="5" y="7" width="3" height="8" rx="1.5" />
          <rect className="mini-forma__cadeira" x="22" y="7" width="3" height="8" rx="1.5" />
          <circle className="mini-forma__tampo" cx="15" cy="11" r="6.5" />
        </>
      )}
      {t === 'banqueta' && <circle className="mini-forma__tampo" cx="15" cy="11" r="5" />}
      {t === 'balcao' && <rect className="mini-forma__balcao" x="2" y="7" width="26" height="8" rx="2" />}
      {t === 'parede' && <rect className="mini-forma__parede" x="2" y="9.5" width="26" height="3" rx="1" />}
      {t === 'porta' && (
        <>
          <rect className="mini-forma__porta" x="6" y="15" width="18" height="4" rx="1" />
          <path className="mini-forma__linha" d="M6 15a12 12 0 0 1 12-12" />
        </>
      )}
      {t === 'planta' && (
        <>
          <circle className="mini-forma__planta" cx="15" cy="11" r="7" />
          <circle className="mini-forma__miolo" cx="15" cy="11" r="2.5" />
        </>
      )}
      {t === 'area' && <rect className="mini-forma__area" x="3" y="3" width="24" height="16" rx="2" />}
      {t === 'texto' && (
        <text className="mini-forma__texto" x="15" y="15" textAnchor="middle" fontSize="13">
          Aa
        </text>
      )}
    </svg>
  )
}

// Contorno, alças de tamanho e a bolinha de girar do elemento escolhido
const TOQUE = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)

function Alcas({ el, zoom, sozinho, aoApertarAlca, aoApertarGiro }) {
  // No dedo as alças precisam ser maiores
  const t = (TOQUE ? 20 : 10) / zoom
  const folga = 3 / zoom
  const redondo = sempreRedondo(el)
  const fino = el.h * zoom < 26
  const estreito = el.w * zoom < 26
  const alcas = []
  if (sozinho) {
    if (!fino && !estreito) alcas.push('nw', 'ne', 'sw', 'se')
    if (!redondo && !estreito) alcas.push('e', 'w')
    if (!redondo && !fino) alcas.push('n', 's')
  }
  const pos = {
    nw: [0, 0],
    n: [el.w / 2, 0],
    ne: [el.w, 0],
    e: [el.w, el.h / 2],
    se: [el.w, el.h],
    s: [el.w / 2, el.h],
    sw: [0, el.h],
    w: [0, el.h / 2],
  }
  const haste = 26 / zoom
  return (
    <g transform={`translate(${el.x} ${el.y}) rotate(${el.rot || 0} ${el.w / 2} ${el.h / 2})`}>
      <rect className="salao-selecao" x={-folga} y={-folga} width={el.w + folga * 2} height={el.h + folga * 2} rx={4 / zoom} />
      {sozinho && (
        <>
          <line className="salao-selecao__haste" x1={el.w / 2} y1={-folga} x2={el.w / 2} y2={-haste} />
          <circle className="salao-alca salao-alca--girar" cx={el.w / 2} cy={-haste} r={t * 0.7} onPointerDown={(e) => aoApertarGiro(e, el)}>
            <title>Arraste para girar</title>
          </circle>
        </>
      )}
      {alcas.map((a) => (
        <rect key={a} className={`salao-alca salao-alca--${a}`} x={pos[a][0] - t / 2} y={pos[a][1] - t / 2} width={t} height={t} rx={2 / zoom} onPointerDown={(e) => aoApertarAlca(e, el, a)} />
      ))}
    </g>
  )
}

export function Salao() {
  const { filial } = useSessao()
  if (!filial) return <Pagina titulo="Montar o salão" descricao="Escolha uma filial no topo da tela." />
  // Trocar de filial no topo recomeça o editor, já com o salão da outra loja
  return <EditorSalao key={filial.id} filial={filial} />
}

function EditorSalao({ filial }) {
  const { usuario, pode } = useSessao()
  const todos = useColecao('ambientes')
  const contas = useColecao('contasMesa')
  const filiais = useColecao('filiais')
  const config = useDoc('config')
  const idGrade = useId().replace(/:/g, '')

  // Cópia de trabalho do salão desta filial. Cada mudança cria uma lista nova
  // (o que não mudou continua o mesmo objeto), entra no histórico e é gravada
  // sozinha um pouco depois.
  const estado = useRef(null)
  if (estado.current === null) estado.current = ambientesDaFilial(todos, filial.id)
  const salvo = useRef(estado.current)
  const historia = useRef({ passado: [], futuro: [], chave: null, em: 0 })
  const temporizador = useRef(null)
  const [, redesenhar] = useReducer((x) => x + 1, 0)
  const [gravacao, setGravacao] = useState('salvo')
  const ambientes = estado.current

  const [ambienteId, setAmbienteId] = useState(() => ambientes[0]?.id || null)
  const ambiente = ambientes.find((a) => a.id === ambienteId) || ambientes[0] || null
  const [selecao, setSelecao] = useState([])
  const [zoom, setZoom] = useState(1)
  const [grade, setGrade] = useState(true)
  const [janela, setJanela] = useState(null)
  const [laco, setLaco] = useState(null)
  const areaRef = useRef(null)
  const svgRef = useRef(null)
  const arraste = useRef(null)
  const copiados = useRef([])

  const abertas = useMemo(() => contas.filter((c) => c.filialId === filial.id && contaAtiva(c)), [contas, filial.id])
  const mesasComConta = (ids) => abertas.filter((c) => ids.includes(c.mesaId))

  // ---------- Gravação ----------

  const gravar = () => {
    clearTimeout(temporizador.current)
    const atual = estado.current
    const antes = salvo.current
    if (atual === antes) return
    const anteriores = new Map(antes.map((a) => [a.id, a]))
    for (const a of atual) {
      const velho = anteriores.get(a.id)
      if (!velho) banco.inserir('ambientes', a)
      else if (velho !== a) {
        const { id, criadoEm, atualizadoEm, ...resto } = a
        banco.atualizar('ambientes', id, resto)
      }
    }
    const ids = new Set(atual.map((a) => a.id))
    for (const a of antes) if (!ids.has(a.id)) banco.remover('ambientes', a.id)
    const texto = diferencaSalao(antes, atual)
    if (texto) registrar('salao.alterado', `${filial.nome}: ${texto}`, { usuario, filialId: filial.id })
    salvo.current = atual
    setGravacao('salvo')
  }
  const gravarRef = useRef(gravar)
  gravarRef.current = gravar

  const agendar = () => {
    setGravacao('pendente')
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => gravarRef.current(), 700)
  }

  // Sair da tela, trocar de filial ou fechar a aba grava o que estiver pendente
  useEffect(() => {
    const sair = () => gravarRef.current()
    window.addEventListener('pagehide', sair)
    const oculto = () => document.visibilityState === 'hidden' && sair()
    document.addEventListener('visibilitychange', oculto)
    return () => {
      window.removeEventListener('pagehide', sair)
      document.removeEventListener('visibilitychange', oculto)
      sair()
    }
  }, [])

  // ---------- Mudanças e histórico ----------

  const mudar = (fn, chave) => {
    const antes = estado.current
    const depois = fn(antes)
    if (!depois || depois === antes) return
    const h = historia.current
    const agora = Date.now()
    if (!(chave && h.chave === chave && agora - h.em < 1500)) {
      h.passado.push(antes)
      if (h.passado.length > 100) h.passado.shift()
    }
    h.chave = chave || null
    h.em = agora
    h.futuro = []
    estado.current = depois
    redesenhar()
    agendar()
  }

  // Durante o arraste a tela acompanha o dedo, mas só entra no histórico ao soltar
  const previa = (fn) => {
    estado.current = fn(estado.current)
    redesenhar()
  }
  const confirmarArraste = (antes) => {
    if (estado.current === antes) return
    const h = historia.current
    h.passado.push(antes)
    if (h.passado.length > 100) h.passado.shift()
    h.futuro = []
    h.chave = null
    agendar()
  }

  const voltarNoTempo = (de, para) => {
    const h = historia.current
    if (!h[de].length) return
    h[para].push(estado.current)
    estado.current = h[de].pop()
    h.chave = null
    const amb = estado.current.find((a) => a.id === ambienteId) || estado.current[0]
    setAmbienteId(amb?.id || null)
    setSelecao((s) => s.filter((id) => amb?.elementos.some((e) => e.id === id)))
    redesenhar()
    agendar()
  }
  const desfazer = () => voltarNoTempo('passado', 'futuro')
  const refazer = () => voltarNoTempo('futuro', 'passado')

  const mudarElementos = (fn, chave) => mudar((lista) => lista.map((a) => (a.id === ambiente.id ? { ...a, elementos: fn(a.elementos) } : a)), chave)
  const mudarSelecionados = (fn, chave) => mudarElementos((els) => els.map((e) => (selecao.includes(e.id) ? fn(e) : e)), chave)
  const mudarAmbiente = (id, mudanca, chave) =>
    mudar((lista) => {
      const atual = lista.find((a) => a.id === id)
      if (!atual || Object.keys(mudanca).every((k) => atual[k] === mudanca[k])) return lista
      return lista.map((a) => (a.id === id ? { ...a, ...mudanca } : a))
    }, chave)

  const selecionados = ambiente ? ambiente.elementos.filter((e) => selecao.includes(e.id)) : []
  const unico = selecionados.length === 1 ? selecionados[0] : null

  // ---------- Coordenadas e zoom ----------

  const ponto = (e) => {
    const svg = svgRef.current
    const p = svg.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    return p.matrixTransform(svg.getScreenCTM().inverse())
  }

  const centroVisivel = () => {
    const area = areaRef.current?.getBoundingClientRect()
    if (!area || !svgRef.current) return { x: ambiente.largura / 2, y: ambiente.altura / 2 }
    const p = ponto({ clientX: area.left + area.width / 2, clientY: area.top + area.height / 2 })
    return { x: limitar(p.x, 0, ambiente.largura), y: limitar(p.y, 0, ambiente.altura) }
  }

  const enquadrar = () => {
    const area = areaRef.current
    const amb = ambiente && (estado.current.find((a) => a.id === ambiente.id) || ambiente)
    if (!area || !amb) return
    const z = Math.min((area.clientWidth - 32) / amb.largura, (area.clientHeight - 32) / amb.altura, 1.5)
    setZoom(limitar(Math.floor(z * 20) / 20, 0.25, 2))
  }

  // Abrir um ambiente mostra ele inteiro (ou vai direto à mesa que foi buscada)
  const focar = useRef(null)
  const mostrarElemento = (id) =>
    requestAnimationFrame(() => svgRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }))
  useLayoutEffect(() => {
    enquadrar()
    setSelecao(focar.current ? [focar.current] : [])
    if (focar.current) mostrarElemento(focar.current)
    focar.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambiente?.id])

  const mudarZoom = (fator) => setZoom((z) => limitar(Math.round(z * fator * 20) / 20, 0.25, 2))

  // Ctrl + roda do mouse (ou pinça no touchpad) muda o zoom
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const roda = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((z) => limitar(Math.round(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1) * 100) / 100, 0.25, 2))
    }
    area.addEventListener('wheel', roda, { passive: false })
    return () => area.removeEventListener('wheel', roda)
  }, [ambiente?.id])

  // ---------- Arrastar, mudar tamanho e girar ----------

  const aoApertarElemento = (e, el) => {
    if (e.button > 0) return
    e.stopPropagation()
    const multi = e.shiftKey || e.ctrlKey || e.metaKey
    let sel = selecao
    if (multi) sel = selecao.includes(el.id) ? selecao : [...selecao, el.id]
    else if (!selecao.includes(el.id)) sel = [el.id]
    setSelecao(sel)
    svgRef.current.setPointerCapture(e.pointerId)
    arraste.current = {
      tipo: 'mover',
      pointerId: e.pointerId,
      inicio: ponto(e),
      antes: estado.current,
      alvo: el.id,
      originais: new Map(ambiente.elementos.filter((x) => sel.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y }])),
      moveu: false,
      tirar: multi && selecao.includes(el.id),
    }
  }

  const aoApertarAlca = (e, el, alca) => {
    if (e.button > 0) return
    e.stopPropagation()
    svgRef.current.setPointerCapture(e.pointerId)
    arraste.current = { tipo: 'tamanho', pointerId: e.pointerId, alca, original: { ...el }, antes: estado.current, inicio: ponto(e), moveu: false }
  }

  const aoApertarGiro = (e, el) => {
    if (e.button > 0) return
    e.stopPropagation()
    svgRef.current.setPointerCapture(e.pointerId)
    arraste.current = { tipo: 'girar', pointerId: e.pointerId, original: { ...el }, antes: estado.current, inicio: ponto(e), moveu: false }
  }

  const aoApertarFundo = (e) => {
    if (e.button > 0) return
    // No toque, arrastar o fundo rola a tela; tocar sem arrastar tira a seleção
    if (e.pointerType === 'touch') {
      arraste.current = { tipo: 'toque', pointerId: e.pointerId, inicio: ponto(e), moveu: false }
      return
    }
    svgRef.current.setPointerCapture(e.pointerId)
    arraste.current = { tipo: 'laco', pointerId: e.pointerId, inicio: ponto(e), moveu: false, base: e.shiftKey ? selecao : [] }
    if (!e.shiftKey) setSelecao([])
  }

  const trocarElemento = (lista, el) => lista.map((a) => (a.id !== ambiente.id ? a : { ...a, elementos: a.elementos.map((x) => (x.id === el.id ? el : x)) }))

  const aoMover = (e) => {
    const a = arraste.current
    if (!a || e.pointerId !== a.pointerId) return
    const p = ponto(e)
    const dx = p.x - a.inicio.x
    const dy = p.y - a.inicio.y
    if (!a.moveu && Math.hypot(dx, dy) * zoom < 4) return
    a.moveu = true
    const passo = grade && !e.altKey ? GRADE : 1

    if (a.tipo === 'mover') {
      const base = a.originais.get(a.alvo)
      const ddx = Math.round((base.x + dx) / passo) * passo - base.x
      const ddy = Math.round((base.y + dy) / passo) * passo - base.y
      previa((lista) =>
        lista.map((amb) =>
          amb.id !== ambiente.id
            ? amb
            : { ...amb, elementos: amb.elementos.map((el) => (a.originais.has(el.id) ? dentroDoAmbiente({ ...el, x: a.originais.get(el.id).x + ddx, y: a.originais.get(el.id).y + ddy }, amb) : el)) },
        ),
      )
    } else if (a.tipo === 'tamanho') {
      const o = a.original
      const r = ((o.rot || 0) * Math.PI) / 180
      const cx = o.x + o.w / 2
      const cy = o.y + o.h / 2
      const vx = p.x - cx
      const vy = p.y - cy
      const lx = vx * Math.cos(r) + vy * Math.sin(r)
      const ly = -vx * Math.sin(r) + vy * Math.cos(r)
      const fino = passo === 1 ? 1 : GRADE / 2
      const minimo = o.forma === 'banqueta' ? 24 : MINIMO[o.tipo] || 20
      let esq = -o.w / 2
      let dir = o.w / 2
      let topo = -o.h / 2
      let base = o.h / 2
      const medir = (v) => Math.max(minimo, Math.round(v / fino) * fino)
      if (a.alca.includes('e')) dir = esq + medir(lx - esq)
      if (a.alca.includes('w')) esq = dir - medir(dir - lx)
      if (a.alca.includes('s')) base = topo + medir(ly - topo)
      if (a.alca.includes('n')) topo = base - medir(base - ly)
      if (sempreRedondo(o)) {
        const lado = Math.max(dir - esq, base - topo)
        if (a.alca.includes('w')) esq = dir - lado
        else dir = esq + lado
        if (a.alca.includes('n')) topo = base - lado
        else base = topo + lado
      }
      const w = Math.min(dir - esq, TAMANHO_MAX.largura)
      const h = Math.min(base - topo, TAMANHO_MAX.altura)
      const lcx = (esq + dir) / 2
      const lcy = (topo + base) / 2
      const ncx = cx + lcx * Math.cos(r) - lcy * Math.sin(r)
      const ncy = cy + lcx * Math.sin(r) + lcy * Math.cos(r)
      previa((lista) => trocarElemento(lista, { ...o, w, h, x: Math.round(ncx - w / 2), y: Math.round(ncy - h / 2) }))
    } else if (a.tipo === 'girar') {
      const o = a.original
      const ang = (Math.atan2(p.y - (o.y + o.h / 2), p.x - (o.x + o.w / 2)) * 180) / Math.PI + 90
      const passoGiro = e.shiftKey ? 1 : 15
      const rot = (((Math.round(ang / passoGiro) * passoGiro) % 360) + 360) % 360
      previa((lista) => trocarElemento(lista, { ...o, rot }))
    } else if (a.tipo === 'laco') {
      setLaco({ x: Math.min(a.inicio.x, p.x), y: Math.min(a.inicio.y, p.y), w: Math.abs(dx), h: Math.abs(dy) })
    }
  }

  const aoSoltar = (e) => {
    const a = arraste.current
    if (!a || e.pointerId !== a.pointerId) return
    arraste.current = null
    if (a.tipo === 'toque') {
      if (!a.moveu && e.type === 'pointerup') setSelecao([])
      return
    }
    if (a.tipo === 'laco') {
      if (laco && a.moveu) {
        const dentro = ambiente.elementos.filter((el) => {
          const c = caixaGirada(el)
          return c.x < laco.x + laco.w && c.x + c.w > laco.x && c.y < laco.y + laco.h && c.y + c.h > laco.y
        })
        setSelecao([...new Set([...a.base, ...dentro.map((el) => el.id)])])
      }
      setLaco(null)
      return
    }
    if (!a.moveu) {
      if (a.tirar) setSelecao((s) => s.filter((id) => id !== a.alvo))
      return
    }
    confirmarArraste(a.antes)
  }

  // ---------- Criar, duplicar, apagar ----------

  const adicionar = (tipo, forma, onde) => {
    if (!ambiente) return
    const novo = tipo === 'mesa' ? novaMesa(forma, { numero: proximoNumero(estado.current)[0] }) : novoElemento(tipo, {})
    const folga = tipo === 'mesa' ? 40 : GRADE / 2
    const pos = onde ? { x: encaixar(onde.x - novo.w / 2), y: encaixar(onde.y - novo.h / 2) } : lugarLivre(ambiente.elementos, novo.w, novo.h, ambiente, centroVisivel(), folga)
    const el = dentroDoAmbiente({ ...novo, ...pos }, ambiente)
    mudarElementos((els) => [...els, el])
    setSelecao([el.id])
  }

  const colar = (modelos, deslocar = GRADE * 2) => {
    if (!modelos.length || !ambiente) return
    const numeros = proximoNumero(estado.current, modelos.filter(ehMesa).length)
    let k = 0
    const novos = modelos.map((m) => dentroDoAmbiente({ ...m, id: novoId(), x: m.x + deslocar, y: m.y + deslocar, ...(ehMesa(m) ? { numero: numeros[k++] } : {}) }, ambiente))
    mudarElementos((els) => [...els, ...novos])
    setSelecao(novos.map((n) => n.id))
  }

  const duplicar = () => colar(selecionados)

  // ---------- Salões grandes: achar e renumerar ----------

  const [busca, setBusca] = useState('')
  const acharNoSalao = (e) => {
    e.preventDefault()
    const m = acharMesa(mesasDoSalaoTodo(), busca)
    if (!m) return avisar(`Não achei a mesa “${busca.trim()}” em nenhum ambiente.`, 'erro')
    setBusca('')
    if (m.ambienteId !== ambiente.id) {
      focar.current = m.id
      setAmbienteId(m.ambienteId)
    } else {
      setSelecao([m.id])
      mostrarElemento(m.id)
    }
  }
  const mesasDoSalaoTodo = () => estado.current.flatMap((a) => a.elementos.filter(ehMesa).map((m) => ({ ...m, ambienteId: a.id })))

  const aplicarNumeros = ({ inicio, prefixo, como }) => {
    const mesas = selecionados.filter(ehMesa)
    const novos = renumerar(mesas, { inicio, prefixo, como })
    const repetidos = numerosOcupados(estado.current, [...novos.values()], mesas.map((m) => m.id))
    if (repetidos.length) return avisar(`Já existem mesas com ${repetidos.slice(0, 4).map((n) => nomeMesa({ numero: n })).join(', ')}${repetidos.length > 4 ? '…' : ''} fora da seleção. Comece de outro número ou use um prefixo.`, 'erro')
    mudarElementos((els) => els.map((e) => (novos.has(e.id) ? { ...e, numero: novos.get(e.id) } : e)))
    setJanela(null)
    const lista = [...novos.values()]
    avisar(`${lista.length} mesa(s) renumerada(s): ${nomeMesa({ numero: lista[0] })} até ${nomeMesa({ numero: lista[lista.length - 1] })}. Ctrl+Z desfaz.`)
  }

  const apagar = () => {
    if (!selecionados.length) return
    const ocupadas = mesasComConta(selecionados.map((e) => e.id))
    if (ocupadas.length) return avisar(`${ocupadas.map((c) => c.mesaNome).join(', ')} está com a conta aberta no caixa. Feche ou transfira a conta antes de apagar.`, 'erro')
    const ids = new Set(selecao)
    mudarElementos((els) => els.filter((e) => !ids.has(e.id)))
    setSelecao([])
  }

  const girar = (graus) => mudarSelecionados((e) => ({ ...e, rot: (((Math.round(((e.rot || 0) + graus) / 15) * 15) % 360) + 360) % 360 }))

  const moverComTeclado = (dx, dy) =>
    mudarElementos((els) => els.map((e) => (selecao.includes(e.id) ? dentroDoAmbiente({ ...e, x: e.x + dx, y: e.y + dy }, ambiente) : e)), 'teclado')

  // ---------- Atalhos ----------

  useEffect(() => {
    const tecla = (e) => {
      if (janela || document.querySelector('dialog[open]')) return
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (ctrl && k === 'z') {
        e.preventDefault()
        e.shiftKey ? refazer() : desfazer()
      } else if (ctrl && k === 'y') {
        e.preventDefault()
        refazer()
      } else if (!ambiente) {
        return
      } else if (ctrl && k === 'd') {
        e.preventDefault()
        duplicar()
      } else if (ctrl && k === 'c' && selecionados.length) {
        copiados.current = selecionados.map((x) => ({ ...x }))
        avisar(`${selecionados.length} item(ns) copiado(s)`, 'info', 1600)
      } else if (ctrl && k === 'v' && copiados.current.length) {
        e.preventDefault()
        colar(copiados.current)
      } else if (ctrl && k === 'a') {
        e.preventDefault()
        setSelecao(ambiente.elementos.map((x) => x.id))
      } else if (e.key === 'Escape') {
        setSelecao([])
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selecao.length) {
        e.preventDefault()
        apagar()
      } else if (k === 'r' && !ctrl && selecao.length) {
        girar(e.shiftKey ? -90 : 90)
      } else if (e.key.startsWith('Arrow') && selecao.length) {
        e.preventDefault()
        const passo = (grade ? GRADE : 2) * (e.shiftKey ? 5 : 1)
        const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key]
        moverComTeclado(...d)
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  // ---------- Ambientes ----------

  const criarAmbiente = (nome) => {
    const amb = novoAmbiente(filial.id, textoLimpo(nome, 30) || `Ambiente ${ambientes.length + 1}`, ambientes.length)
    mudar((lista) => [...lista, amb])
    setAmbienteId(amb.id)
    setJanela(null)
  }

  const apagarAmbiente = async (amb) => {
    const ocupadas = mesasComConta(amb.elementos.filter(ehMesa).map((m) => m.id))
    if (ocupadas.length) return avisar(`Há conta aberta em ${ocupadas.map((c) => c.mesaNome).join(', ')}. Feche as contas deste ambiente antes de apagá-lo.`, 'erro')
    const mesas = amb.elementos.filter(ehMesa).length
    const ok = await confirmar({ titulo: `Apagar ${amb.nome}?`, texto: mesas ? `As ${mesas} mesas deste ambiente saem do mapa. Dá para desfazer logo em seguida (Ctrl+Z).` : 'O ambiente sai do mapa.', botao: 'Apagar ambiente', perigo: true })
    if (!ok) return
    mudar((lista) => lista.filter((a) => a.id !== amb.id).map((a, i) => ({ ...a, ordem: i })))
    setAmbienteId(null)
  }

  const moverAmbiente = (amb, delta) => {
    const i = ambientes.indexOf(amb)
    const j = i + delta
    if (j < 0 || j >= ambientes.length) return
    mudar((lista) => {
      const nova = [...lista]
      ;[nova[i], nova[j]] = [nova[j], nova[i]]
      return nova.map((a, k) => (a.ordem === k ? a : { ...a, ordem: k }))
    })
  }

  // O espaço fica do tamanho do desenho, com uma folga em volta
  const ajustarAoDesenho = () => {
    const c = caixaDosElementos(ambiente.elementos)
    if (!c) return
    const folga = 60
    const dx = encaixar(folga - c.x)
    const dy = encaixar(folga - c.y)
    const largura = limitar(Math.ceil((c.w + folga * 2) / 100) * 100, TAMANHO_MIN.largura, TAMANHO_MAX.largura)
    const altura = limitar(Math.ceil((c.h + folga * 2) / 100) * 100, TAMANHO_MIN.altura, TAMANHO_MAX.altura)
    mudarAmbiente(ambiente.id, { largura, altura, elementos: ambiente.elementos.map((e) => ({ ...e, x: Math.round(e.x + dx), y: Math.round(e.y + dy) })) })
    setTimeout(enquadrar, 0)
  }

  const usarModelo = (modeloId) => {
    const novos = aplicarModelo(modeloId, filial.id, ambientes.length)
    // Num salão que já tem mesas, os números do modelo continuam depois delas
    const numericas = novos.flatMap((a) => a.elementos.filter((e) => ehMesa(e) && /^\d+$/.test(e.numero)))
    const numeros = proximoNumero(ambientes, numericas.length)
    for (const a of novos) {
      let nome = a.nome
      for (let n = 2; ambientes.some((x) => x.nome === nome); n++) nome = `${a.nome} ${n}`
      a.nome = nome
      a.elementos = a.elementos.map((e) => {
        if (!ehMesa(e)) return e
        if (/^\d+$/.test(e.numero)) return { ...e, numero: numeros.shift() }
        let numero = e.numero
        for (let n = 2; problemaNoNumero(ambientes, numero, e.id); n++) numero = `${e.numero}-${n}`
        return { ...e, numero }
      })
    }
    mudar((lista) => [...lista, ...novos])
    setAmbienteId(novos[0].id)
    setJanela(null)
    avisar(`Modelo aplicado: ${novos.map((a) => a.nome).join(' e ')}. Agora ajuste ao jeito da loja.`)
  }

  const copiarDe = async (origemId) => {
    const origem = ambientesDaFilial(todos, origemId)
    if (!origem.length) return
    if (ambientes.length) {
      if (abertas.length) return avisar('Há contas de mesa abertas nesta loja. Feche as contas antes de trocar o salão inteiro.', 'erro')
      const ok = await confirmar({ titulo: 'Trocar o salão desta loja?', texto: `O salão de ${filial.nome} fica igual ao de ${filiais.find((f) => f.id === origemId)?.nome}. Dá para desfazer logo em seguida (Ctrl+Z).`, botao: 'Copiar o salão', perigo: true })
      if (!ok) return
    }
    const copia = copiarSalao(origem, filial.id)
    mudar(() => copia)
    setAmbienteId(copia[0].id)
    setJanela(null)
    avisar('Salão copiado')
  }

  // ---------- Tela ----------

  const outrasComSalao = filiais.filter((f) => f.id !== filial.id && todos.some((a) => a.filialId === f.id && a.elementos.length))
  const totalMesas = ambientes.reduce((t, a) => t + a.elementos.filter(ehMesa).length, 0)
  const totalLugares = ambientes.reduce((t, a) => t + a.elementos.filter(ehMesa).reduce((s, m) => s + (m.ativa === false ? 0 : m.lugares || 0), 0), 0)
  const h = historia.current

  const acoes = (
    <>
      <span className={`salao-gravacao salao-gravacao--${gravacao}`} role="status">
        <Icone nome={gravacao === 'salvo' ? 'check-circulo' : 'relogio'} tamanho={16} /> {gravacao === 'salvo' ? 'Tudo salvo' : 'Salvando…'}
      </span>
      <BotaoIcone icone="desfazer" rotulo="Desfazer (Ctrl+Z)" onClick={desfazer} disabled={!h.passado.length} />
      <BotaoIcone icone="refazer" rotulo="Refazer (Ctrl+Shift+Z)" onClick={refazer} disabled={!h.futuro.length} />
      {ambientes.length > 0 && (
        <Menu
          rotulo="Mais opções do salão"
          icone="menu"
          itens={[
            { rotulo: 'Usar um modelo pronto', icone: 'grade', acao: () => setJanela('modelos') },
            ...(outrasComSalao.length ? [{ rotulo: 'Copiar o salão de outra filial', icone: 'copiar', acao: () => setJanela('copiar') }] : []),
            { rotulo: 'Ver como fica no caixa', icone: 'monitor', acao: () => setJanela('previa') },
          ]}
        />
      )}
    </>
  )

  if (!ambientes.length) {
    return (
      <Pagina titulo="Montar o salão" descricao={`Desenhe ${filial.nome} como ela é. No caixa, o atendente toca na mesa para abrir a conta e lançar os pedidos, e a cozinha sabe para qual mesa vai cada prato.`} acoes={acoes}>
        <Cartao className="salao-comeco">
          <Vazio
            mascote
            titulo={`${filial.nome} ainda não tem salão`}
            texto="Comece de um modelo parecido com a loja e ajuste, ou desenhe do zero. Separe por ambientes se a loja tiver varanda, segundo andar ou área externa."
            acao={
              <div className="linha linha--quebra" style={{ justifyContent: 'center' }}>
                <Botao icone="mais" onClick={() => criarAmbiente('Salão')}>
                  Começar do zero
                </Botao>
                {outrasComSalao.length > 0 && (
                  <Botao variante="secundario" icone="copiar" onClick={() => setJanela('copiar')}>
                    Copiar de outra filial
                  </Botao>
                )}
              </div>
            }
          />
          <h2 className="salao-comeco__titulo">Ou comece de um modelo</h2>
          <ModelosSalao aoEscolher={usarModelo} />
        </Cartao>
        {janela === 'copiar' && <CopiarSalao filiais={outrasComSalao} aoCopiar={copiarDe} aoFechar={() => setJanela(null)} />}
      </Pagina>
    )
  }

  const ordenados = [...ambiente.elementos].sort((a, b) => (CAMADA[a.tipo] ?? 1) - (CAMADA[b.tipo] ?? 1))
  const mesasAqui = ambiente.elementos.filter(ehMesa)
  const sobrepostas = mesasSobrepostas(ambiente.elementos)

  return (
    <Pagina titulo="Montar o salão" descricao={`${filial.nome}: ${totalMesas} mesa(s) e ${totalLugares} lugares em ${ambientes.length} ambiente(s). Tudo é salvo sozinho; o caixa já usa o mapa.`} acoes={acoes}>
      <div className="salao-ambientes">
        <div className="salao-ambientes__abas" role="tablist" aria-label="Ambientes">
          {ambientes.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={a.id === ambiente.id} className="salao-ambientes__aba" onClick={() => setAmbienteId(a.id)}>
              {a.nome}
              <small className="numero">{a.elementos.filter(ehMesa).length}</small>
            </button>
          ))}
          <button type="button" className="salao-ambientes__novo" onClick={() => setJanela('ambiente')}>
            <Icone nome="mais" tamanho={16} /> Ambiente
          </button>
        </div>
        <Menu
          rotulo={`Opções de ${ambiente.nome}`}
          icone="engrenagem"
          itens={[
            { rotulo: `Renomear ${ambiente.nome}`, icone: 'editar', acao: () => setJanela('renomear') },
            { rotulo: 'Mover para a esquerda', icone: 'seta-esq', acao: () => moverAmbiente(ambiente, -1), desabilitado: ambientes[0] === ambiente },
            { rotulo: 'Mover para a direita', icone: 'seta-dir', acao: () => moverAmbiente(ambiente, 1), desabilitado: ambientes[ambientes.length - 1] === ambiente },
            { rotulo: 'Ajustar o espaço ao desenho', icone: 'ajustar', acao: ajustarAoDesenho, desabilitado: !ambiente.elementos.length },
            { separador: true },
            { rotulo: `Apagar ${ambiente.nome}`, icone: 'lixeira', perigo: true, acao: () => apagarAmbiente(ambiente) },
          ]}
        />
      </div>

      <p className="salao-painel__nota salao-dica-celular">
        <Icone nome="monitor" tamanho={16} />
        <span>No celular dá para ajustar o salão; para montar do começo, o computador ou o tablet são mais confortáveis.</span>
      </p>

      <div className="salao-ferramentas" role="toolbar" aria-label="Adicionar ao salão">
        <div className="salao-ferramentas__grupo">
          <span className="salao-ferramentas__rotulo">Mesas</span>
          {Object.entries(FORMAS_MESA).map(([forma, f]) => (
            <button
              key={forma}
              type="button"
              className="ferramenta"
              onClick={() => adicionar('mesa', forma)}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/x-salao', JSON.stringify({ tipo: 'mesa', forma }))}
              title={`Mesa ${f.nome.toLowerCase()}: toque para pôr no meio da tela ou arraste até o lugar`}
            >
              <MiniForma tipo="mesa" forma={forma} />
              <span>{f.nome}</span>
            </button>
          ))}
          <button type="button" className="ferramenta ferramenta--texto" onClick={() => setJanela('varias')}>
            <Icone nome="grade" tamanho={18} />
            <span>Várias</span>
          </button>
        </div>
        <div className="salao-ferramentas__grupo">
          <span className="salao-ferramentas__rotulo">Referências</span>
          {Object.entries(ELEMENTOS).map(([tipo, info]) => (
            <button
              key={tipo}
              type="button"
              className="ferramenta"
              onClick={() => adicionar(tipo)}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/x-salao', JSON.stringify({ tipo }))}
              title={`${info.nome}: toque para pôr no meio da tela ou arraste até o lugar`}
            >
              <MiniForma tipo={tipo} />
              <span>{info.nome}</span>
            </button>
          ))}
        </div>
        {totalMesas > 0 && (
          <form className="salao-ferramentas__grupo salao-ferramentas__busca" onSubmit={acharNoSalao} role="search">
            <span className="salao-ferramentas__rotulo">Achar</span>
            <Entrada icone="busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Mesa nº" aria-label="Achar mesa pelo número, em qualquer ambiente" />
          </form>
        )}
      </div>

      <div className="salao-editor">
        <div className="salao-editor__palco">
          <div
            className="salao-editor__area rolagem"
            ref={areaRef}
            onDragOver={(e) => e.dataTransfer.types.includes('text/x-salao') && e.preventDefault()}
            onDrop={(e) => {
              const dados = e.dataTransfer.getData('text/x-salao')
              if (!dados) return
              e.preventDefault()
              const { tipo, forma } = JSON.parse(dados)
              adicionar(tipo, forma, ponto(e))
            }}
          >
            <svg
              ref={svgRef}
              className="salao-editor__svg"
              width={ambiente.largura * zoom}
              height={ambiente.altura * zoom}
              viewBox={`0 0 ${ambiente.largura} ${ambiente.altura}`}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={aoSoltar}
              aria-label={`Desenho de ${ambiente.nome}`}
              role="application"
            >
              <defs>
                <pattern id={idGrade} width={GRADE} height={GRADE} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRADE} 0 L 0 0 0 ${GRADE}`} className="salao-grade" />
                </pattern>
              </defs>
              <rect className="salao-chao" width={ambiente.largura} height={ambiente.altura} onPointerDown={aoApertarFundo} />
              {grade && <rect width={ambiente.largura} height={ambiente.altura} fill={`url(#${idGrade})`} pointerEvents="none" />}
              {ordenados.map((el) => (
                <g
                  key={el.id}
                  data-id={el.id}
                  className="salao-editor__item"
                  onPointerDown={(e) => aoApertarElemento(e, el)}
                  onDoubleClick={() => ehMesa(el) && document.getElementById('campo-numero-mesa')?.focus()}
                  tabIndex={0}
                  role="button"
                  aria-label={rotuloElemento(el)}
                  aria-pressed={selecao.includes(el.id)}
                  onFocus={() => !selecao.includes(el.id) && !arraste.current && setSelecao([el.id])}
                >
                  {ehMesa(el) ? <MesaDesenho el={el} editor escala={zoom} sobreposta={sobrepostas.has(el.id)} /> : <Decoracao el={el} editor />}
                </g>
              ))}
              {selecionados.map((el) => (
                <Alcas key={el.id} el={el} zoom={zoom} sozinho={selecionados.length === 1} aoApertarAlca={aoApertarAlca} aoApertarGiro={aoApertarGiro} />
              ))}
              {laco && <rect className="salao-laco" x={laco.x} y={laco.y} width={laco.w} height={laco.h} />}
            </svg>
          </div>
          <div className="salao-editor__rodape">
            <button type="button" className={`salao-chave ${grade ? 'salao-chave--ligada' : ''}`} aria-pressed={grade} onClick={() => setGrade((g) => !g)} title="Com a grade ligada, as mesas encaixam alinhadas. Segure Alt para soltar livre.">
              <Icone nome="grade" tamanho={16} /> Grade
            </button>
            <span className="salao-editor__dica">{selecao.length ? 'Setas movem · R gira · Ctrl+D duplica · Delete apaga' : 'Arraste para mover · Ctrl+roda dá zoom · Shift soma à seleção'}</span>
            <div className="salao-zoom" role="group" aria-label="Zoom">
              <BotaoIcone icone="menos" tamanho="p" rotulo="Diminuir o zoom" onClick={() => mudarZoom(1 / 1.25)} disabled={zoom <= 0.25} />
              <button type="button" className="salao-zoom__valor numero" onClick={() => setZoom(1)} title="Voltar ao tamanho real (100%)">
                {Math.round(zoom * 100)}%
              </button>
              <BotaoIcone icone="mais" tamanho="p" rotulo="Aumentar o zoom" onClick={() => mudarZoom(1.25)} disabled={zoom >= 2} />
              <BotaoIcone icone="ajustar" tamanho="p" rotulo="Mostrar o ambiente inteiro" onClick={enquadrar} />
            </div>
          </div>
        </div>

        <aside className="salao-painel" aria-label="Propriedades">
          {!selecionados.length && (
            <PainelAmbiente
              ambiente={ambiente}
              mesas={mesasAqui}
              config={config}
              podeConfigurar={pode('admin.config')}
              aoMudar={(mudanca, chave) => {
                // Espaço menor: o que ficaria de fora volta para dentro
                const amb = { ...ambiente, ...mudanca }
                const elementos = 'largura' in mudanca || 'altura' in mudanca ? ambiente.elementos.map((e) => dentroDoAmbiente(e, amb)) : ambiente.elementos
                mudarAmbiente(ambiente.id, elementos.some((e, i) => e !== ambiente.elementos[i]) ? { ...mudanca, elementos } : mudanca, chave)
              }}
              aoAjustar={ajustarAoDesenho}
            />
          )}
          {unico && (
            <PainelElemento
              key={unico.id}
              el={unico}
              ambientes={ambientes}
              ambiente={ambiente}
              comConta={mesasComConta([unico.id])[0]}
              sobreposta={sobrepostas.has(unico.id)}
              aoMudar={(fn, chave) => mudarSelecionados(fn, chave)}
              aoGirar={girar}
              aoDuplicar={duplicar}
              aoApagar={apagar}
            />
          )}
          {selecionados.length > 1 && (
            <PainelVarios
              selecionados={selecionados}
              aoMudarTodos={(lista) => {
                const novos = new Map(lista.map((e) => [e.id, dentroDoAmbiente(e, ambiente)]))
                mudarElementos((els) => els.map((e) => novos.get(e.id) || e))
              }}
              aoMudar={(fn, chave) => mudarSelecionados(fn, chave)}
              aoRenumerar={() => setJanela('renumerar')}
              aoDuplicar={duplicar}
              aoApagar={apagar}
              aoLimpar={() => setSelecao([])}
            />
          )}
        </aside>
      </div>

      {(janela === 'ambiente' || janela === 'renomear') && (
        <NomeAmbiente
          inicial={janela === 'renomear' ? ambiente.nome : ''}
          existentes={ambientes.map((a) => a.nome)}
          aoSalvar={(nome) => {
            if (janela === 'renomear') {
              mudarAmbiente(ambiente.id, { nome: textoLimpo(nome, 30) || ambiente.nome })
              setJanela(null)
            } else criarAmbiente(nome)
          }}
          aoFechar={() => setJanela(null)}
        />
      )}
      {janela === 'varias' && (
        <VariasMesas
          primeiro={proximoNumero(ambientes)[0]}
          ambientes={ambientes}
          aoCriar={({ quantidade, forma, lugares, colunas, numeros, espaco }) => {
            const c = caixaDosElementos(ambiente.elementos)
            const inicio = { x: 60, y: c ? encaixar(c.y + c.h + 60) : 60 }
            const mesas = gradeDeMesas({ quantidade, forma, lugares, colunas, numeros, inicio, espaco })
            const fundo = Math.max(...mesas.map((m) => m.y + m.h)) + 60
            const direita = Math.max(...mesas.map((m) => m.x + m.w)) + 60
            mudar((lista) =>
              lista.map((a) =>
                a.id !== ambiente.id
                  ? a
                  : {
                      ...a,
                      altura: limitar(Math.max(a.altura, Math.ceil(fundo / 100) * 100), TAMANHO_MIN.altura, TAMANHO_MAX.altura),
                      largura: limitar(Math.max(a.largura, Math.ceil(direita / 100) * 100), TAMANHO_MIN.largura, TAMANHO_MAX.largura),
                      elementos: [...a.elementos, ...mesas],
                    },
              ),
            )
            setSelecao(mesas.map((m) => m.id))
            setJanela(null)
            setTimeout(enquadrar, 0)
            avisar(`${quantidade} mesa(s) criada(s), da ${nomeMesa({ numero: numeros[0] })} à ${nomeMesa({ numero: numeros[numeros.length - 1] })}. Arraste o grupo inteiro para posicionar.`)
          }}
          aoFechar={() => setJanela(null)}
        />
      )}
      {janela === 'renumerar' && <Renumerar mesas={selecionados.filter(ehMesa)} aoAplicar={aplicarNumeros} aoFechar={() => setJanela(null)} />}
      {janela === 'modelos' && (
        <Modal aberto aoFechar={() => setJanela(null)} titulo="Modelos prontos" subtitulo="O modelo entra como ambiente novo, ao lado dos que já existem. Depois é só ajustar." largura="gg">
          <ModelosSalao aoEscolher={usarModelo} />
        </Modal>
      )}
      {janela === 'copiar' && <CopiarSalao filiais={outrasComSalao} aoCopiar={copiarDe} aoFechar={() => setJanela(null)} />}
      {janela === 'previa' && (
        <Modal aberto aoFechar={() => setJanela(null)} titulo={`${ambiente.nome} no caixa`} subtitulo="Assim o atendente vê o mapa. As cores mudam com a situação de cada mesa." largura="gg" className="tema-escuro">
          <MapaSalao ambiente={ambiente} situacoes={new Map()} />
        </Modal>
      )}
    </Pagina>
  )
}

// ---------------------------------------------------------------------------
// Painéis de propriedades

// Enquanto a pessoa digita, só valores dentro do limite valem (digitar "120"
// passa por "1" sem pular para o mínimo); ao sair do campo, ajusta ao limite.
function CampoNumero({ rotulo, valor, aoMudar, min, max, passo = 1 }) {
  const [texto, setTexto] = useState(String(valor))
  const [editando, setEditando] = useState(false)
  useEffect(() => {
    if (!editando) setTexto(String(valor))
  }, [valor, editando])
  const numero = (v) => (v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
  return (
    <Campo rotulo={rotulo}>
      {(p) => (
        <Entrada
          {...p}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={passo}
          value={texto}
          onFocus={() => setEditando(true)}
          onChange={(e) => {
            setTexto(e.target.value)
            const n = numero(e.target.value)
            if (n !== null && n >= min && n <= max && n !== valor) aoMudar(n)
          }}
          onBlur={() => {
            setEditando(false)
            const n = numero(texto)
            if (n !== null && limitar(n, min, max) !== valor) aoMudar(limitar(n, min, max))
          }}
        />
      )}
    </Campo>
  )
}

function Contador({ rotulo, valor, aoMudar, min = 1, max = LUGARES_MAX }) {
  return (
    <div className="contador-campo">
      <span className="campo__rotulo">{rotulo}</span>
      <div className="contador" role="group" aria-label={rotulo}>
        <button type="button" onClick={() => aoMudar(Math.max(min, valor - 1))} disabled={valor <= min} aria-label="Menos">
          <Icone nome="menos" tamanho={18} />
        </button>
        <span className="numero" aria-live="polite">
          {valor}
        </span>
        <button type="button" onClick={() => aoMudar(Math.min(max, valor + 1))} disabled={valor >= max} aria-label="Mais">
          <Icone nome="mais" tamanho={18} />
        </button>
      </div>
    </div>
  )
}

function PainelAmbiente({ ambiente, mesas, config, podeConfigurar, aoMudar, aoAjustar }) {
  const lugares = mesas.reduce((t, m) => t + (m.ativa === false ? 0 : m.lugares || 0), 0)
  const servico = config.servicoPercentual ?? 10
  return (
    <div className="pilha">
      <div>
        <p className="salao-painel__tipo">Ambiente</p>
        <h2 className="salao-painel__titulo">{ambiente.nome}</h2>
        <p className="mudo">
          {mesas.length} mesa(s), {lugares} lugares
        </p>
      </div>
      <Campo rotulo="Nome">
        {(p) => <Entrada {...p} value={ambiente.nome} maxLength={30} onChange={(e) => aoMudar({ nome: e.target.value.slice(0, 30) }, `nome-amb-${ambiente.id}`)} onBlur={(e) => aoMudar({ nome: textoLimpo(e.target.value, 30) || 'Ambiente' }, `nome-amb-${ambiente.id}`)} />}
      </Campo>
      <div>
        <p className="campo__rotulo">Tamanho do espaço</p>
        <div className="grade-2">
          <CampoNumero rotulo="Largura" valor={ambiente.largura} min={TAMANHO_MIN.largura} max={TAMANHO_MAX.largura} passo={100} aoMudar={(v) => aoMudar({ largura: v }, `larg-${ambiente.id}`)} />
          <CampoNumero rotulo="Altura" valor={ambiente.altura} min={TAMANHO_MIN.altura} max={TAMANHO_MAX.altura} passo={100} aoMudar={(v) => aoMudar({ altura: v }, `alt-${ambiente.id}`)} />
        </div>
        <Botao variante="contorno" tamanho="p" icone="ajustar" onClick={aoAjustar} disabled={!ambiente.elementos.length} className="salao-painel__botao">
          Ajustar ao desenho
        </Botao>
      </div>
      <div className="salao-painel__nota">
        <Icone nome="info" tamanho={16} />
        <p>
          Taxa de serviço das mesas: <strong>{servico ? `${servico}%` : 'não cobra'}</strong>. Aviso de mesa sem pedido depois de <strong>{config.alertaMesaMin || 20} min</strong>.
          {podeConfigurar && (
            <>
              {' '}
              <a href="#/admin/configuracoes">Mudar em Configurações</a>
            </>
          )}
        </p>
      </div>
      <details className="salao-painel__atalhos">
        <summary>Atalhos do teclado</summary>
        <dl>
          <dt>Setas</dt>
          <dd>movem o que está escolhido (Shift: 5×)</dd>
          <dt>Ctrl+D</dt>
          <dd>duplica</dd>
          <dt>Ctrl+C / Ctrl+V</dt>
          <dd>copia e cola, inclusive em outro ambiente</dd>
          <dt>R</dt>
          <dd>gira 90°</dd>
          <dt>Delete</dt>
          <dd>apaga</dd>
          <dt>Ctrl+Z</dt>
          <dd>desfaz (Ctrl+Shift+Z refaz)</dd>
          <dt>Ctrl+A</dt>
          <dd>escolhe tudo do ambiente</dd>
          <dt>Alt</dt>
          <dd>arrastando, solta fora da grade</dd>
        </dl>
      </details>
    </div>
  )
}

function CampoNumeroMesa({ el, ambientes, aoMudar }) {
  const [texto, setTexto] = useState(el.numero)
  const [erro, setErro] = useState(null)
  useEffect(() => setTexto(el.numero), [el.numero])
  return (
    <Campo rotulo="Número ou nome" erro={erro} ajuda={erro ? null : `No caixa aparece como “${nomeMesa({ numero: texto || el.numero })}”. Pode ser 12, B1, VIP, Varanda 3.`} id="campo-numero-mesa">
      {(p) => (
        <Entrada
          {...p}
          value={texto}
          maxLength={12}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value.slice(0, 12)
            setTexto(v)
            const problema = problemaNoNumero(ambientes, v, el.id)
            setErro(problema)
            if (!problema) aoMudar((x) => ({ ...x, numero: textoLimpo(v, 12) }), `numero-${el.id}`)
          }}
          onBlur={() => {
            setTexto(el.numero)
            setErro(null)
          }}
        />
      )}
    </Campo>
  )
}

function PainelElemento({ el, ambientes, ambiente, comConta, sobreposta, aoMudar, aoGirar, aoDuplicar, aoApagar }) {
  const mesa = ehMesa(el)
  const redondo = sempreRedondo(el)
  const trocarForma = (forma) =>
    aoMudar((x) => {
      const f = FORMAS_MESA[forma]
      const cx = x.x + x.w / 2
      const cy = x.y + x.h / 2
      const lugares = forma === 'banqueta' ? 1 : x.forma === 'banqueta' ? f.lugares : x.lugares
      return dentroDoAmbiente({ ...x, forma, w: f.w, h: f.h, x: Math.round(cx - f.w / 2), y: Math.round(cy - f.h / 2), lugares }, ambiente)
    })
  const tamanho = (campo) => (v) =>
    aoMudar((x) => {
      const w = campo === 'w' || redondo ? v : x.w
      const h = campo === 'h' || redondo ? v : x.h
      return { ...x, w, h, x: Math.round(x.x + (x.w - w) / 2), y: Math.round(x.y + (x.h - h) / 2) }
    }, `${campo}-${el.id}`)

  return (
    <div className="pilha">
      <div>
        <p className="salao-painel__tipo">{mesa ? `Mesa ${FORMAS_MESA[el.forma].nome.toLowerCase()}` : ELEMENTOS[el.tipo].nome}</p>
        <h2 className="salao-painel__titulo">{mesa ? nomeMesa(el) : el.rotulo || ELEMENTOS[el.tipo].nome}</h2>
        {comConta && (
          <p className="salao-painel__conta">
            <Icone nome="recibo" tamanho={15} /> Conta aberta no caixa agora
          </p>
        )}
        {sobreposta && (
          <p className="salao-painel__aviso" role="alert">
            <Icone nome="alerta" tamanho={15} /> Está em cima de outra mesa. Arraste para separar.
          </p>
        )}
      </div>

      {mesa && (
        <>
          <CampoNumeroMesa el={el} ambientes={ambientes} aoMudar={aoMudar} />
          <Contador rotulo="Lugares" valor={el.lugares} min={1} aoMudar={(v) => aoMudar((x) => ({ ...x, lugares: v }), `lugares-${el.id}`)} />
          <div>
            <p className="campo__rotulo">Formato</p>
            <Segmentos rotulo="Formato da mesa" tamanho="p" valor={el.forma} aoMudar={trocarForma} opcoes={Object.entries(FORMAS_MESA).map(([valor, f]) => ({ valor, rotulo: f.nome }))} />
          </div>
        </>
      )}

      {!mesa && el.tipo !== 'parede' && el.tipo !== 'planta' && (
        <Campo rotulo="Texto">
          {(p) => <Entrada {...p} value={el.rotulo || ''} maxLength={30} onChange={(e) => aoMudar((x) => ({ ...x, rotulo: e.target.value.slice(0, 30) }), `rotulo-${el.id}`)} placeholder={el.tipo === 'area' ? 'Cozinha, Banheiros, Caixa…' : ''} />}
        </Campo>
      )}

      <div className="grade-2">
        {redondo ? (
          <CampoNumero rotulo="Diâmetro" valor={el.w} min={el.forma === 'banqueta' ? 24 : MINIMO[el.tipo]} max={600} passo={10} aoMudar={tamanho('w')} />
        ) : (
          <>
            <CampoNumero rotulo="Largura" valor={el.w} min={MINIMO[el.tipo]} max={TAMANHO_MAX.largura} passo={10} aoMudar={tamanho('w')} />
            <CampoNumero rotulo={el.tipo === 'parede' ? 'Espessura' : 'Altura'} valor={el.h} min={MINIMO[el.tipo]} max={TAMANHO_MAX.altura} passo={el.tipo === 'parede' ? 2 : 10} aoMudar={tamanho('h')} />
          </>
        )}
      </div>

      {!redondo && (
        <div>
          <p className="campo__rotulo">Girar</p>
          <div className="linha">
            <BotaoIcone icone="girar" rotulo="Girar 45° para a esquerda" onClick={() => aoGirar(-45)} variante="contorno" />
            <BotaoIcone icone="atualizar" rotulo="Girar 45° para a direita" onClick={() => aoGirar(45)} variante="contorno" />
            <span className="numero salao-painel__angulo">{el.rot || 0}°</span>
            {Boolean(el.rot) && (
              <button type="button" className="link" onClick={() => aoMudar((x) => ({ ...x, rot: 0 }))}>
                endireitar
              </button>
            )}
          </div>
        </div>
      )}

      {mesa && (
        <Alternador
          rotulo="Em uso"
          descricao="Desligue se a mesa estiver quebrada ou guardada. No caixa ela fica apagada e não abre conta."
          ligado={el.ativa !== false}
          aoMudar={(v) => {
            if (!v && comConta) return avisar('Esta mesa está com a conta aberta. Feche a conta antes de tirá-la de uso.', 'erro')
            aoMudar((x) => ({ ...x, ativa: v }))
          }}
        />
      )}

      <div className="linha linha--quebra">
        <Botao variante="secundario" tamanho="p" icone="copiar" onClick={aoDuplicar}>
          Duplicar
        </Botao>
        <Botao variante="secundario" tamanho="p" icone="lixeira" onClick={aoApagar} className="salao-painel__apagar">
          Apagar
        </Botao>
      </div>
    </div>
  )
}

function PainelVarios({ selecionados, aoMudarTodos, aoMudar, aoRenumerar, aoDuplicar, aoApagar, aoLimpar }) {
  const mesas = selecionados.filter(ehMesa)
  const lugares = mesas.length && mesas.every((m) => m.lugares === mesas[0].lugares) ? mesas[0].lugares : null
  const forma = mesas.length && mesas.every((m) => m.forma === mesas[0].forma) ? mesas[0].forma : null
  const nomes = ordemDeLeitura(mesas).map(nomeMesa)
  const botao = (icone, rotulo, fn, desabilitado) => <BotaoIcone key={icone} icone={icone} rotulo={rotulo} variante="contorno" onClick={fn} disabled={desabilitado} />
  return (
    <div className="pilha">
      <div>
        <p className="salao-painel__tipo">Seleção</p>
        <h2 className="salao-painel__titulo">{selecionados.length} itens</h2>
        <p className="mudo">{mesas.length ? `${mesas.length} mesa(s): ${nomes.length > 8 ? `${nomes.slice(0, 6).join(', ')} … ${nomes[nomes.length - 1]}` : nomes.join(', ')}` : 'Nenhuma mesa'}</p>
      </div>
      <div>
        <p className="campo__rotulo">Alinhar</p>
        <div className="linha linha--quebra salao-painel__alinhar">
          {botao('alinhar-esquerda', 'Alinhar à esquerda', () => aoMudarTodos(alinhar(selecionados, 'esquerda')))}
          {botao('alinhar-centro', 'Centralizar na horizontal', () => aoMudarTodos(alinhar(selecionados, 'centro')))}
          {botao('alinhar-direita', 'Alinhar à direita', () => aoMudarTodos(alinhar(selecionados, 'direita')))}
          {botao('alinhar-topo', 'Alinhar em cima', () => aoMudarTodos(alinhar(selecionados, 'topo')))}
          {botao('alinhar-meio', 'Centralizar na vertical', () => aoMudarTodos(alinhar(selecionados, 'meio')))}
          {botao('alinhar-base', 'Alinhar embaixo', () => aoMudarTodos(alinhar(selecionados, 'base')))}
        </div>
      </div>
      <div>
        <p className="campo__rotulo">Distribuir com espaços iguais</p>
        <div className="linha">
          {botao('distribuir-h', 'Distribuir na horizontal', () => aoMudarTodos(distribuir(selecionados, 'h')), selecionados.length < 3)}
          {botao('distribuir-v', 'Distribuir na vertical', () => aoMudarTodos(distribuir(selecionados, 'v')), selecionados.length < 3)}
          {selecionados.length < 3 && <small className="mudo">escolha 3 ou mais</small>}
        </div>
      </div>
      {mesas.length > 0 && (
        <div>
          <p className="campo__rotulo">Formato das {mesas.length} mesa(s)</p>
          <Segmentos
            rotulo="Formato das mesas"
            tamanho="p"
            valor={forma}
            aoMudar={(f) =>
              aoMudar((x) => {
                if (!ehMesa(x)) return x
                const nova = FORMAS_MESA[f]
                // Troca pelo centro, para a mesa não "andar"
                return { ...x, forma: f, w: nova.w, h: nova.h, x: Math.round(x.x + x.w / 2 - nova.w / 2), y: Math.round(x.y + x.h / 2 - nova.h / 2), lugares: f === 'banqueta' ? 1 : x.forma === 'banqueta' ? nova.lugares : x.lugares }
              }, 'forma-varios')
            }
            opcoes={Object.entries(FORMAS_MESA).map(([valor, f]) => ({ valor, rotulo: f.nome }))}
          />
        </div>
      )}
      {mesas.length > 1 && (
        <Botao variante="secundario" tamanho="p" icone="lista" onClick={aoRenumerar}>
          Renumerar em ordem
        </Botao>
      )}
      {mesas.length > 0 && <Contador rotulo={lugares ? 'Lugares em cada mesa' : 'Lugares em cada mesa (diferentes agora)'} valor={lugares || mesas[0].lugares} aoMudar={(v) => aoMudar((x) => (ehMesa(x) ? { ...x, lugares: v } : x), 'lugares-varios')} />}
      <div className="linha linha--quebra">
        <Botao variante="secundario" tamanho="p" icone="copiar" onClick={aoDuplicar}>
          Duplicar
        </Botao>
        <Botao variante="secundario" tamanho="p" icone="lixeira" onClick={aoApagar} className="salao-painel__apagar">
          Apagar
        </Botao>
        <Botao variante="fantasma" tamanho="p" onClick={aoLimpar}>
          Tirar seleção
        </Botao>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Janelas

function NomeAmbiente({ inicial, existentes, aoSalvar, aoFechar }) {
  const [nome, setNome] = useState(inicial)
  const sugestoes = SUGESTOES_AMBIENTE.filter((s) => !existentes.includes(s))
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={inicial ? 'Renomear ambiente' : 'Novo ambiente'}
      subtitulo={inicial ? null : 'Cada ambiente é um mapa separado: varanda, segundo andar, área externa…'}
      largura="p"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={() => aoSalvar(nome)} disabled={!textoLimpo(nome, 30)}>
            {inicial ? 'Salvar' : 'Criar ambiente'}
          </Botao>
        </>
      }
    >
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault()
          if (textoLimpo(nome, 30)) aoSalvar(nome)
        }}
      >
        <Campo rotulo="Nome do ambiente">{(p) => <Entrada {...p} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={30} autoFocus placeholder="Ex.: Varanda" />}</Campo>
        {!inicial && sugestoes.length > 0 && (
          <div className="linha linha--quebra">
            {sugestoes.map((s) => (
              <button key={s} type="button" className="chip-valor" onClick={() => setNome(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </form>
    </Modal>
  )
}

// Prévia pequena de mesas com os números que vão ficar
function PreviaNumeros({ mesas, numeros }) {
  const c = caixaDosElementos(mesas)
  if (!c) return null
  const m = 20
  return (
    <svg className="salao-previa-numeros" viewBox={`${c.x - m} ${c.y - m} ${c.w + m * 2} ${c.h + m * 2}`} aria-hidden="true">
      {mesas.map((el) => (
        <g key={el.id} transform={`translate(${el.x} ${el.y})`}>
          {sempreRedondo(el) ? <ellipse cx={el.w / 2} cy={el.h / 2} rx={el.w / 2} ry={el.h / 2} /> : <rect width={el.w} height={el.h} rx={8} />}
          <text x={el.w / 2} y={el.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(28, Math.max(14, (el.w * 0.9) / Math.max(2, String(numeros.get(el.id)).length * 0.62)))}>
            {numeros.get(el.id)}
          </text>
        </g>
      ))}
    </svg>
  )
}

const ORDENS = [
  { valor: 'fileiras', rotulo: 'Por fileiras' },
  { valor: 'zigue', rotulo: 'Zigue-zague' },
  { valor: 'colunas', rotulo: 'Por colunas' },
]

// Campos de numeração usados ao criar e ao renumerar
function CamposNumeracao({ inicio, prefixo, aoMudarInicio, aoMudarPrefixo }) {
  return (
    <div className="grade-2">
      <Campo rotulo="Começar do número" ajuda="Ex.: 1, 101, 201">
        {(p) => <Entrada {...p} value={inicio} onChange={(e) => aoMudarInicio(e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" maxLength={5} />}
      </Campo>
      <Campo rotulo="Prefixo (opcional)" ajuda="Ex.: V para V1, V2… na varanda">
        {(p) => <Entrada {...p} value={prefixo} onChange={(e) => aoMudarPrefixo(e.target.value.replace(/\s/g, '').slice(0, 4))} maxLength={4} placeholder="Nenhum" />}
      </Campo>
    </div>
  )
}

function VariasMesas({ primeiro, ambientes, aoCriar, aoFechar }) {
  const [quantidade, setQuantidade] = useState(12)
  const [forma, setForma] = useState('quadrada')
  const [lugares, setLugares] = useState(4)
  const [colunas, setColunas] = useState(6)
  const [espaco, setEspaco] = useState('normal')
  const [inicio, setInicio] = useState(/^\d+$/.test(primeiro) ? primeiro : '1')
  const [prefixo, setPrefixo] = useState('')
  const numeros = sequenciaDeNumeros({ inicio: inicio || '1', prefixo, quantidade })
  const repetidos = numerosOcupados(ambientes, numeros)
  const porFileira = Math.min(colunas, quantidade)
  const previa = useMemo(() => {
    const mesas = gradeDeMesas({ quantidade, forma, lugares, colunas: porFileira, numeros, inicio: { x: 0, y: 0 }, espaco: ESPACOS[espaco].valor })
    return { mesas, numeros: new Map(mesas.map((m) => [m.id, m.numero])) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantidade, forma, porFileira, espaco, numeros.join()])
  const fileiras = Math.ceil(quantidade / porFileira)
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Várias mesas de uma vez"
      subtitulo="Para salões grandes: monte as fileiras aqui e depois arraste o bloco inteiro para o lugar."
      largura="g"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao icone="mais" disabled={repetidos.length > 0} onClick={() => aoCriar({ quantidade, forma, lugares: forma === 'banqueta' ? 1 : lugares, colunas: porFileira, numeros, espaco: ESPACOS[espaco].valor })}>
            Criar {quantidade} mesa(s)
          </Botao>
        </>
      }
    >
      <div className="varias-mesas">
        <div className="pilha">
          <div>
            <p className="campo__rotulo">Formato</p>
            <Segmentos
              rotulo="Formato"
              valor={forma}
              aoMudar={(f) => {
                setForma(f)
                setLugares(FORMAS_MESA[f].lugares)
              }}
              opcoes={Object.entries(FORMAS_MESA).map(([valor, f]) => ({ valor, rotulo: f.nome }))}
            />
          </div>
          <div className="grade-3">
            <CampoNumero rotulo="Quantas mesas" valor={quantidade} min={1} max={200} aoMudar={setQuantidade} />
            <CampoNumero rotulo="Por fileira" valor={colunas} min={1} max={30} aoMudar={setColunas} />
            {forma !== 'banqueta' && <Contador rotulo="Lugares em cada" valor={lugares} aoMudar={setLugares} />}
          </div>
          <div>
            <p className="campo__rotulo">Espaço entre as mesas</p>
            <Segmentos rotulo="Espaço entre as mesas" valor={espaco} aoMudar={setEspaco} opcoes={Object.entries(ESPACOS).map(([valor, e]) => ({ valor, rotulo: e.nome }))} />
          </div>
          <CamposNumeracao inicio={inicio} prefixo={prefixo} aoMudarInicio={setInicio} aoMudarPrefixo={setPrefixo} />
          {repetidos.length ? (
            <p className="salao-painel__aviso" role="alert">
              <Icone nome="alerta" tamanho={15} /> Já existem {repetidos.slice(0, 3).map((n) => nomeMesa({ numero: n })).join(', ')}
              {repetidos.length > 3 ? ` e mais ${repetidos.length - 3}` : ''}. Comece de outro número ou use um prefixo.
            </p>
          ) : (
            <p className="mudo">
              {fileiras} fileira(s) de até {porFileira}: {nomeMesa({ numero: numeros[0] })}
              {quantidade > 1 ? ` até ${nomeMesa({ numero: numeros[numeros.length - 1] })}` : ''}.
            </p>
          )}
        </div>
        <figure className="varias-mesas__previa">
          <PreviaNumeros mesas={previa.mesas} numeros={previa.numeros} />
          <figcaption className="mudo">Prévia da numeração</figcaption>
        </figure>
      </div>
    </Modal>
  )
}

function Renumerar({ mesas, aoAplicar, aoFechar }) {
  const numericos = mesas.map((m) => m.numero).filter((n) => /^\d+$/.test(n)).map(Number)
  const [inicio, setInicio] = useState(String(numericos.length ? Math.min(...numericos) : 1))
  const [prefixo, setPrefixo] = useState('')
  const [como, setComo] = useState('fileiras')
  const numeros = useMemo(() => renumerar(mesas, { inicio: inicio || '1', prefixo, como }), [mesas, inicio, prefixo, como])
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Renumerar ${mesas.length} mesas`}
      subtitulo="Os números seguem a ordem em que as mesas estão no desenho. Contas abertas continuam nas mesmas mesas."
      largura="g"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao icone="check" onClick={() => aoAplicar({ inicio: inicio || '1', prefixo, como })}>
            Renumerar
          </Botao>
        </>
      }
    >
      <div className="varias-mesas">
        <div className="pilha">
          <div>
            <p className="campo__rotulo">Ordem</p>
            <Segmentos rotulo="Ordem da numeração" valor={como} aoMudar={setComo} opcoes={ORDENS} />
            <p className="mudo">{{ fileiras: 'Da esquerda para a direita, fileira por fileira.', zigue: 'Uma fileira para a direita, a outra de volta: o caminho de quem anda entre as mesas.', colunas: 'De cima para baixo, coluna por coluna.' }[como]}</p>
          </div>
          <CamposNumeracao inicio={inicio} prefixo={prefixo} aoMudarInicio={setInicio} aoMudarPrefixo={setPrefixo} />
        </div>
        <figure className="varias-mesas__previa">
          <PreviaNumeros mesas={mesas} numeros={numeros} />
          <figcaption className="mudo">Como vai ficar</figcaption>
        </figure>
      </div>
    </Modal>
  )
}

// Miniaturas dos modelos, desenhadas com as mesmas peças do mapa
function ModelosSalao({ aoEscolher }) {
  const previas = useMemo(() => MODELOS.map((m) => ({ ...m, ambientes: m.montar() })), [])
  return (
    <ul className="modelos-salao">
      {previas.map((m) => (
        <li key={m.id}>
          <button type="button" className="modelo-salao" onClick={() => aoEscolher(m.id)}>
            <span className="modelo-salao__previa">
              {m.ambientes.map((a, i) => (
                <svg key={i} viewBox={`0 0 ${a.largura} ${a.altura}`} aria-hidden="true">
                  <rect className="salao-chao" width={a.largura} height={a.altura} />
                  {a.elementos.filter((e) => !ehMesa(e)).map((e) => (
                    <Decoracao key={e.id} el={e} />
                  ))}
                  {a.elementos.filter(ehMesa).map((e) => (
                    <MesaDesenho key={e.id} el={e} editor escala={0.25} />
                  ))}
                </svg>
              ))}
            </span>
            <strong>{m.nome}</strong>
            <small>{m.descricao}</small>
          </button>
        </li>
      ))}
    </ul>
  )
}

function CopiarSalao({ filiais, aoCopiar, aoFechar }) {
  const [origem, setOrigem] = useState(filiais[0]?.id || '')
  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Copiar o salão de outra filial"
      subtitulo="Bom para lojas com a mesma planta. Vêm os ambientes, as mesas e os números; depois ajuste o que for diferente."
      largura="p"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao icone="copiar" onClick={() => aoCopiar(origem)} disabled={!origem}>
            Copiar
          </Botao>
        </>
      }
    >
      <Campo rotulo="Copiar de">{(p) => <Selecao {...p} value={origem} onChange={(e) => setOrigem(e.target.value)} opcoes={filiais.map((f) => ({ valor: f.id, rotulo: f.nome }))} />}</Campo>
    </Modal>
  )
}
