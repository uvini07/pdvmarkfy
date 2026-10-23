// Desenho do salão em SVG, o mesmo no editor da retaguarda, no caixa e no
// acompanhamento: mesas com as cadeiras em volta e os elementos que ajudam a
// se localizar (balcão, parede, porta…). No caixa cada mesa mostra a situação
// pela cor e por texto (número, tempo, valor) — a cor nunca é o único sinal.

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useColecao, useDoc } from '../dados/banco.js'
import { ambientesDaFilial, cadeirasDaMesa, caixaDosElementos, compararMesas, mesasDoSalao, nomeMesa } from '../dados/salao.js'
import { contasAbertas, resumoSalao } from '../dados/mesas.js'
import { decorrido, ha } from '../lib/datas.js'
import { reais, valor } from '../lib/dinheiro.js'
import { Icone } from './Icone.jsx'

// Tudo o que as telas de mesas precisam da filial, já calculado
export function useSalao(filialId, agora) {
  const ambientes = useColecao('ambientes')
  const contas = useColecao('contasMesa')
  const pedidos = useColecao('pedidosMesa')
  const config = useDoc('config')
  const alertaMin = config.alertaMesaMin || 20
  return useMemo(() => {
    const abertas = contasAbertas(contas, filialId)
    const ids = new Set(abertas.map((c) => c.id))
    const mesas = mesasDoSalao(ambientes, filialId)
    return {
      ambientes: ambientesDaFilial(ambientes, filialId),
      mesas,
      contas: abertas,
      alertaMin,
      ...resumoSalao({ mesas, contas: abertas, pedidos: pedidos.filter((p) => ids.has(p.contaId)), agora, alertaMin }),
    }
  }, [ambientes, contas, pedidos, filialId, agora, alertaMin])
}

export const ESTADOS = {
  livre: 'Livre',
  ocupada: 'Ocupada',
  fechando: 'Pediu a conta',
  inativa: 'Fora de uso',
}

export function descreverSituacao(mesa, s) {
  if (!s?.conta) return `${mesa.nome}, ${ESTADOS[s?.estado || 'livre'].toLowerCase()}${mesa.lugares ? `, ${mesa.lugares} lugares` : ''}`
  const partes = [mesa.nome, ESTADOS[s.estado].toLowerCase(), `aberta ${ha(s.conta.abertaEm)}`, reais(s.totais.falta)]
  if (s.conta.pessoas) partes.push(`${s.conta.pessoas} pessoa(s)`)
  if (s.prontos) partes.push(`${s.prontos} pedido(s) pronto(s) para servir`)
  if (s.atencao) partes.push(`sem pedido há ${decorrido(s.conta.ultimoPedidoEm || s.conta.abertaEm)}`)
  return partes.join(', ')
}

const redonda = (el) => (el.tipo === 'mesa' && (el.forma === 'redonda' || el.forma === 'banqueta')) || el.tipo === 'planta'

function Tampo({ el, className }) {
  if (redonda(el)) return <ellipse className={className} cx={el.w / 2} cy={el.h / 2} rx={el.w / 2} ry={el.h / 2} />
  const raio = el.tipo === 'mesa' ? Math.min(10, Math.min(el.w, el.h) * 0.14) : el.tipo === 'parede' ? 2 : 6
  return <rect className={className} width={el.w} height={el.h} rx={raio} />
}

// Texto que gira com o elemento, mas nunca de cabeça para baixo
function anguloLegivel(rot = 0) {
  const r = ((rot % 360) + 360) % 360
  return r > 90 && r <= 270 ? 180 : 0
}

function TextoElemento({ el, giro = 0 }) {
  if (!el.rotulo) return null
  const virar = anguloLegivel((el.rot || 0) + giro)
  const transform = virar ? `rotate(180 ${el.w / 2} ${el.h / 2})` : undefined
  if (el.tipo === 'area')
    return (
      <text className="salao-el__texto salao-el__texto--area" x={virar ? el.w - 10 : 10} y={virar ? el.h - 10 : 10} transform={transform} textAnchor={virar ? 'end' : 'start'} dominantBaseline="hanging" fontSize={Math.min(16, Math.max(10, el.h * 0.16))}>
        {el.rotulo}
      </text>
    )
  const tamanho = el.tipo === 'texto' ? Math.min(32, Math.max(10, el.h * 0.55)) : Math.min(18, Math.max(9, el.h * 0.42))
  return (
    <text className={`salao-el__texto salao-el__texto--${el.tipo}`} x={el.w / 2} y={el.h / 2} transform={transform} textAnchor="middle" dominantBaseline="central" fontSize={tamanho}>
      {el.rotulo}
    </text>
  )
}

// Balcão, parede, porta, planta, área e texto
export function Decoracao({ el, editor, giro = 0 }) {
  return (
    <g className={`salao-el salao-el--${el.tipo}`} transform={`translate(${el.x} ${el.y}) rotate(${el.rot || 0} ${el.w / 2} ${el.h / 2})`}>
      {el.tipo === 'texto' ? (
        editor && <rect className="salao-el__contorno" width={el.w} height={el.h} rx={4} />
      ) : (
        <Tampo el={el} className="salao-el__forma" />
      )}
      {el.tipo === 'planta' && <circle className="salao-el__miolo" cx={el.w / 2} cy={el.h / 2} r={el.w / 5} />}
      <TextoElemento el={el} giro={giro} />
    </g>
  )
}

// Quantas linhas de texto cabem na mesa, no tamanho em que ela aparece na tela
function linhasDaMesa(el, s, escala) {
  const px = (v) => v / escala
  const util = (redonda(el) ? 0.7 : 0.88) * Math.min(el.w, el.h)
  const numero = String(el.numero ?? '')
  const larguraTitulo = (el.w * (redonda(el) ? 0.72 : 0.9)) / Math.max(2, numero.length * 0.62)
  const titulo = Math.max(px(9), Math.min(px(19), larguraTitulo, util * 0.5))
  const info = Math.max(px(9), Math.min(px(11.5), util * 0.2))
  const linhas = [{ texto: numero, classe: 'salao-mesa__numero', tamanho: titulo }]
  if (s?.conta) {
    const extras = [
      { texto: decorrido(s.conta.abertaEm), classe: 'salao-mesa__info', tamanho: info },
      { texto: valor(s.totais.falta), classe: 'salao-mesa__info salao-mesa__valor', tamanho: info },
    ]
    for (const linha of extras) {
      const altura = linhas.reduce((t, l) => t + l.tamanho * 1.12, 0) + linha.tamanho * 1.12
      if (altura <= util) linhas.push(linha)
    }
  }
  return linhas
}

function Selo({ x, y, r, icone, classe, numero }) {
  return (
    <g className={`salao-selo ${classe}`} transform={`translate(${x} ${y})`}>
      <circle r={r} />
      {numero > 1 ? (
        <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.1}>
          {numero}
        </text>
      ) : (
        <g transform={`translate(${-r * 0.62} ${-r * 0.62})`}>
          <Icone nome={icone} tamanho={r * 1.24} traco={2.4} />
        </g>
      )}
    </g>
  )
}

// Uma mesa: tampo com as cadeiras (giram juntos) e o número sempre em pé.
// No caixa, recebe a situação (cor, tempo, valor, avisos).
// giro: quanto o mapa inteiro está girado; o número da mesa gira de volta e fica sempre em pé
export function MesaDesenho({ el, situacao, escala = 1, editor, escolhida, apagada, sobreposta, aoTocar, rotulo, giro = 0 }) {
  const estado = situacao?.estado || (el.ativa === false ? 'inativa' : 'livre')
  const ocupadas = situacao?.conta?.pessoas || 0
  const cadeiras = cadeirasDaMesa(el)
  const linhas = linhasDaMesa(el, situacao, escala)
  const alturaTexto = linhas.reduce((t, l) => t + l.tamanho * 1.12, 0)
  let y = el.h / 2 - alturaTexto / 2
  const raioSelo = Math.max(8, Math.min(13, 11 / escala, Math.min(el.w, el.h) * 0.2))
  const canto = Math.min(el.w, el.h) * (redonda(el) ? 0.36 : 0.46)
  const clicavel = Boolean(aoTocar)
  const classes = [
    'salao-mesa',
    `salao-mesa--${estado}`,
    situacao?.atencao ? 'salao-mesa--atencao' : '',
    escolhida ? 'salao-mesa--escolhida' : '',
    apagada ? 'salao-mesa--apagada' : '',
    sobreposta ? 'salao-mesa--sobreposta' : '',
    clicavel ? 'salao-mesa--clicavel' : '',
  ].join(' ')

  return (
    <g
      className={classes}
      transform={`translate(${el.x} ${el.y})`}
      role={clicavel ? 'button' : undefined}
      tabIndex={clicavel ? 0 : undefined}
      aria-label={clicavel ? rotulo : undefined}
      aria-disabled={clicavel && apagada ? 'true' : undefined}
      onClick={clicavel ? () => aoTocar(el) : undefined}
      onKeyDown={
        clicavel
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                aoTocar(el)
              }
            }
          : undefined
      }
    >
      <g transform={`rotate(${el.rot || 0} ${el.w / 2} ${el.h / 2})`}>
        {cadeiras.map((c, i) => (
          <rect
            key={i}
            className={`salao-cadeira ${i < ocupadas ? 'salao-cadeira--ocupada' : ''}`}
            x={c.cx - c.w / 2}
            y={c.cy - c.h / 2}
            width={c.w}
            height={c.h}
            rx={Math.min(5, c.h / 2)}
            transform={c.rot ? `rotate(${c.rot} ${c.cx} ${c.cy})` : undefined}
          />
        ))}
        <Tampo el={el} className="salao-mesa__tampo" />
      </g>
      {linhas.map((l, i) => {
        const yLinha = y + (l.tamanho * 1.12) / 2
        y += l.tamanho * 1.12
        return (
          <text key={i} className={l.classe} x={el.w / 2} y={yLinha} textAnchor="middle" dominantBaseline="central" fontSize={l.tamanho} transform={giro ? `rotate(${-giro} ${el.w / 2} ${el.h / 2})` : undefined}>
            {l.texto}
          </text>
        )
      })}
      {!editor && situacao?.prontos > 0 && <Selo x={el.w / 2 + canto} y={el.h / 2 - canto} r={raioSelo} icone="check" classe="salao-selo--pronto" numero={situacao.prontos} />}
      {!editor && situacao?.estado === 'fechando' && <Selo x={el.w / 2 - canto} y={el.h / 2 - canto} r={raioSelo} icone="recibo" classe="salao-selo--conta" />}
      {!editor && situacao?.atencao && <Selo x={el.w / 2 - canto} y={el.h / 2 - canto} r={raioSelo} icone="relogio" classe="salao-selo--atencao" />}
    </g>
  )
}

// Mede quantos pixels da tela vale uma unidade do desenho, para o texto das
// mesas ficar legível em qualquer tamanho de tela
function useEscala(ref, larguraDesenho, alturaDesenho) {
  const [escala, setEscala] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // O desenho cabe pela largura ou pela altura (mapa girado fica alto)
    const medir = () => {
      const r = el.getBoundingClientRect()
      setEscala(Math.max(0.15, Math.min(r.width / larguraDesenho, alturaDesenho ? r.height / alturaDesenho : Infinity)) || 1)
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref, larguraDesenho, alturaDesenho])
  return escala
}

// Mapa de um ambiente para o caixa e o acompanhamento: enquadra o que foi
// desenhado (sem as sobras vazias do ambiente) e deixa as mesas tocáveis.
// Giro do mapa por ambiente, lembrado neste aparelho: cada um vê o salão do
// jeito que está de pé na loja (da porta, do caixa…)
const chaveGiro = (id) => `scpdv:giro-mapa:${id}`
function lerGiro(id) {
  try {
    return Number(localStorage.getItem(chaveGiro(id))) || 0
  } catch {
    return 0
  }
}

// Mapa de um ambiente para o caixa e o acompanhamento: enquadra o que foi
// desenhado (sem as sobras vazias do ambiente) e deixa as mesas tocáveis.
// O botão de girar vira o salão inteiro de 90 em 90 graus.
export function MapaSalao({ ambiente, situacoes, aoTocar, escolhida, podeTocar, rotulo }) {
  const ref = useRef(null)
  const [giros, setGiros] = useState({})
  const giro = giros[ambiente.id] ?? lerGiro(ambiente.id)
  const girar = () => {
    const novo = (giro + 90) % 360
    setGiros((g) => ({ ...g, [ambiente.id]: novo }))
    try {
      localStorage.setItem(chaveGiro(ambiente.id), String(novo))
    } catch {
      // sem armazenamento: só não lembra
    }
  }
  const caixa = caixaDosElementos(ambiente.elementos)
  const margem = 34
  const base = caixa ? { x: caixa.x - margem, y: caixa.y - margem, w: caixa.w + margem * 2, h: caixa.h + margem * 2 } : { x: 0, y: 0, w: ambiente.largura, h: ambiente.altura }
  // Girado de lado, largura e altura trocam; o centro continua o mesmo
  const deLado = giro % 180 !== 0
  const cx = base.x + base.w / 2
  const cy = base.y + base.h / 2
  const vb = deLado ? { x: cx - base.h / 2, y: cy - base.w / 2, w: base.h, h: base.w } : base
  const escala = useEscala(ref, vb.w, vb.h)
  const decoracoes = ambiente.elementos.filter((e) => e.tipo !== 'mesa')
  const mesas = ambiente.elementos.filter((e) => e.tipo === 'mesa')

  if (!ambiente.elementos.length)
    return (
      <div className="mapa-salao mapa-salao--vazio">
        <p className="mudo">Nada desenhado em {ambiente.nome} ainda.</p>
      </div>
    )

  return (
    <div className="mapa-salao">
      <button type="button" className="mapa-salao__girar" onClick={girar} aria-label={`Girar o mapa (agora ${giro}°)`} title="Girar o mapa">
        <Icone nome="atualizar" tamanho={18} />
      </button>
      <svg ref={ref} className="mapa-salao__svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ aspectRatio: `${vb.w} / ${vb.h}` }} role="group" aria-label={rotulo || `Mapa de ${ambiente.nome}`}>
        <g transform={giro ? `rotate(${giro} ${cx} ${cy})` : undefined}>
        {decoracoes.map((el) => (
          <Decoracao key={el.id} el={el} giro={giro} />
        ))}
        {mesas.map((m) => {
          const mesa = { ...m, ambienteId: ambiente.id, ambienteNome: ambiente.nome, nome: nomeMesa(m) }
          const s = situacoes.get(m.id)
          const permitida = !podeTocar || podeTocar(mesa, s)
          return (
            <MesaDesenho
              key={m.id}
              el={m}
              situacao={s}
              escala={escala}
              escolhida={escolhida === m.id}
              apagada={!permitida}
              aoTocar={aoTocar ? () => permitida && aoTocar(mesa) : undefined}
              rotulo={descreverSituacao(mesa, s)}
              giro={giro}
            />
          )
        })}
        </g>
      </svg>
    </div>
  )
}

// A mesma informação em lista, por ambiente: melhor no celular e para achar
// uma mesa pelo número.
export function ListaMesas({ grupos, aoTocar, escolhida, podeTocar }) {
  return (
    <div className="lista-mesas">
      {grupos.map((g) => (
        <section key={g.id} className="lista-mesas__grupo" aria-label={g.nome}>
          {grupos.length > 1 && <h3>{g.nome}</h3>}
          <ul>
            {g.itens.map(({ mesa, situacao: s }) => {
              const estado = s?.estado || 'livre'
              const permitida = !podeTocar || podeTocar(mesa, s)
              return (
                <li key={mesa.id}>
                  <button
                    type="button"
                    className={`cartao-mesa cartao-mesa--${estado} ${s?.atencao ? 'cartao-mesa--atencao' : ''} ${escolhida === mesa.id ? 'cartao-mesa--escolhida' : ''}`}
                    onClick={() => aoTocar?.(mesa)}
                    disabled={!permitida}
                    aria-label={descreverSituacao(mesa, s)}
                  >
                    <span className="cartao-mesa__numero">{mesa.numero}</span>
                    <span className="cartao-mesa__info">
                      <strong>{s?.conta ? `${ESTADOS[estado]} ${ha(estado === 'fechando' ? s.conta.contaPedidaEm || s.conta.abertaEm : s.conta.abertaEm)}` : mesa.foraDoMapa ? 'Fora do mapa' : ESTADOS[estado]}</strong>
                      <small>
                        {s?.conta
                          ? [s.conta.pessoas ? `${s.conta.pessoas} pessoa(s)` : null, s.conta.clienteNome || s.conta.garcomNome?.split(' ')[0]].filter(Boolean).join(' · ')
                          : mesa.lugares
                            ? `${mesa.lugares} lugar(es)`
                            : ''}
                      </small>
                    </span>
                    {s?.conta && <span className="cartao-mesa__valor numero">{reais(s.totais.falta)}</span>}
                    {(s?.prontos > 0 || s?.atencao) && (
                      <span className="cartao-mesa__avisos">
                        {s.prontos > 0 && (
                          <span className="cartao-mesa__aviso cartao-mesa__aviso--pronto">
                            <Icone nome="check" tamanho={13} traco={2.4} /> {s.prontos > 1 ? `${s.prontos} prontos` : 'Pronto'}
                          </span>
                        )}
                        {s.atencao && (
                          <span className="cartao-mesa__aviso cartao-mesa__aviso--atencao">
                            <Icone nome="relogio" tamanho={13} traco={2.2} /> {decorrido(s.conta.ultimoPedidoEm || s.conta.abertaEm)} sem pedido
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

// filtro: 'todas' | 'livres' | 'ocupadas' | 'fechando' | 'atencao'
export const passaFiltro = (s, filtro) =>
  filtro === 'todas' ||
  (filtro === 'livres' && (s?.estado || 'livre') === 'livre') ||
  (filtro === 'ocupadas' && Boolean(s?.conta)) ||
  (filtro === 'fechando' && s?.estado === 'fechando') ||
  (filtro === 'atencao' && Boolean(s?.atencao || s?.prontos > 0))

// Monta os grupos da lista: um por ambiente e, no fim, as contas cuja mesa
// saiu do mapa.
export function gruposDaLista(salao, filtro = 'todas') {
  const passa = (s) => passaFiltro(s, filtro)
  const grupos = salao.ambientes.map((a) => ({
    id: a.id,
    nome: a.nome,
    itens: salao.mesas
      .filter((m) => m.ambienteId === a.id)
      .sort(compararMesas)
      .map((mesa) => ({ mesa, situacao: salao.situacoes.get(mesa.id) }))
      .filter((x) => passa(x.situacao)),
  }))
  if (salao.foraDoMapa.length) grupos.push({ id: 'fora', nome: 'Fora do mapa', itens: salao.foraDoMapa.filter((x) => passa(x.situacao)) })
  return grupos.filter((g) => g.itens.length)
}

export function LegendaSalao({ salao }) {
  const itens = [
    ['livre', 'Livres', salao.livres],
    ['ocupada', 'Ocupadas', salao.ocupadas - salao.fechando],
    ['fechando', 'Pediram a conta', salao.fechando],
    ['atencao', 'Sem pedido há tempo', salao.atencao],
    ['pronto', 'Prontos para servir', salao.prontos],
  ]
  return (
    <ul className="legenda-salao" aria-label="Legenda do mapa">
      {itens.map(([id, nome, n]) => (
        <li key={id} className={`legenda-salao__item legenda-salao__item--${id}`}>
          <span className="legenda-salao__marca" aria-hidden="true" />
          {nome} <strong className="numero">{n}</strong>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Análise: todas as mesas em cartões, lado a lado, para salões grandes (100,
// 200 mesas). Cabe tudo numa tela, a cor e o texto dizem a situação, e os
// contadores no topo também filtram.

export const FILTROS_MESAS = [
  { valor: 'todas', rotulo: 'Todas', tom: 'todas' },
  { valor: 'livres', rotulo: 'Livres', tom: 'livre' },
  { valor: 'ocupadas', rotulo: 'Ocupadas', tom: 'ocupada' },
  { valor: 'fechando', rotulo: 'Pediram a conta', tom: 'fechando' },
  { valor: 'atencao', rotulo: 'Pedem atenção', tom: 'atencao' },
]

const ORDENS_PAINEL = [
  { valor: 'numero', rotulo: 'Número' },
  { valor: 'tempo', rotulo: 'Mais tempo' },
  { valor: 'valor', rotulo: 'Maior valor' },
]

const chaveNum = (m) => String(m.numero ?? '').toLowerCase()

function CartaoAnalise({ mesa, situacao: s, escolhida, permitida, aoTocar }) {
  const estado = s?.estado || (mesa.ativa === false ? 'inativa' : 'livre')
  return (
    <button
      type="button"
      className={`analise-mesa analise-mesa--${estado} ${s?.atencao ? 'analise-mesa--atencao' : ''} ${escolhida ? 'analise-mesa--escolhida' : ''}`}
      onClick={() => aoTocar?.(mesa)}
      disabled={!permitida}
      aria-label={descreverSituacao(mesa, s)}
      aria-pressed={escolhida || undefined}
    >
      <span className="analise-mesa__numero">{mesa.numero}</span>
      {s?.conta ? (
        <>
          <span className="analise-mesa__valor numero">{valor(s.totais.falta)}</span>
          <span className="analise-mesa__tempo numero">
            {decorrido(s.conta.abertaEm)}
            {s.conta.pessoas ? ` · ${s.conta.pessoas}p` : ''}
          </span>
        </>
      ) : (
        <span className="analise-mesa__tempo">{estado === 'inativa' ? 'fora de uso' : mesa.foraDoMapa ? 'fora do mapa' : mesa.lugares ? `${mesa.lugares} lug.` : ''}</span>
      )}
      {(s?.prontos > 0 || s?.estado === 'fechando' || s?.atencao) && (
        <span className="analise-mesa__selos" aria-hidden="true">
          {s.prontos > 0 && (
            <span className="analise-mesa__selo analise-mesa__selo--pronto" title="Pronto para servir">
              <Icone nome="check" tamanho={11} traco={3} />
              {s.prontos > 1 ? s.prontos : ''}
            </span>
          )}
          {s.estado === 'fechando' && (
            <span className="analise-mesa__selo analise-mesa__selo--conta" title="Pediu a conta">
              <Icone nome="recibo" tamanho={11} traco={2.6} />
            </span>
          )}
          {s.atencao && (
            <span className="analise-mesa__selo analise-mesa__selo--atencao" title="Sem pedido há tempo">
              <Icone nome="relogio" tamanho={11} traco={2.6} />
            </span>
          )}
        </span>
      )}
    </button>
  )
}

// busca: filtra pelo começo do número enquanto digita ("4" mostra 4, 40–49…)
export function AnaliseMesas({ salao, aoTocar, escolhida, podeTocar, busca = '', travarFiltro }) {
  const [filtro, setFiltro] = useState('todas')
  const [ordem, setOrdem] = useState('numero')
  const [ambienteId, setAmbienteId] = useState('todos')
  const filtroAtivo = travarFiltro ? 'todas' : filtro

  const todas = useMemo(
    () => [
      ...salao.mesas.map((mesa) => ({ mesa, situacao: salao.situacoes.get(mesa.id) })),
      ...salao.foraDoMapa.map((x) => ({ ...x, mesa: { ...x.mesa, ambienteId: 'fora', ambienteNome: 'Fora do mapa' } })),
    ],
    [salao],
  )
  const ambientes = [...salao.ambientes.map((a) => ({ id: a.id, nome: a.nome })), ...(salao.foraDoMapa.length ? [{ id: 'fora', nome: 'Fora do mapa' }] : [])]
  const doAmbiente = todas.filter((x) => ambienteId === 'todos' || x.mesa.ambienteId === ambienteId)
  const contagem = Object.fromEntries(FILTROS_MESAS.map((f) => [f.valor, doAmbiente.filter((x) => passaFiltro(x.situacao, f.valor)).length]))

  const termo = busca.trim().toLowerCase()
  const visiveis = doAmbiente
    .filter((x) => passaFiltro(x.situacao, filtroAtivo))
    .filter((x) => !termo || chaveNum(x.mesa).startsWith(termo) || x.mesa.nome?.toLowerCase().includes(termo))
    .sort((a, b) => {
      if (ordem === 'tempo') return (b.situacao?.minutos ?? -1) - (a.situacao?.minutos ?? -1) || compararMesas(a.mesa, b.mesa)
      if (ordem === 'valor') return (b.situacao?.totais?.falta ?? -1) - (a.situacao?.totais?.falta ?? -1) || compararMesas(a.mesa, b.mesa)
      return compararMesas(a.mesa, b.mesa)
    })

  // Por número e com todos os ambientes, separa por ambiente; nas outras
  // ordens o que importa é o ranking, então fica tudo junto
  const separar = ordem === 'numero' && ambienteId === 'todos' && ambientes.length > 1
  const grupos = separar ? ambientes.map((a) => ({ ...a, itens: visiveis.filter((x) => x.mesa.ambienteId === a.id) })).filter((g) => g.itens.length) : [{ id: 'tudo', itens: visiveis }]

  return (
    <div className="analise">
      {!travarFiltro && (
        <div className="analise__contadores" role="radiogroup" aria-label="Filtrar mesas">
          {FILTROS_MESAS.map((f) => (
            <button key={f.valor} type="button" role="radio" aria-checked={filtro === f.valor} className={`analise__contador analise__contador--${f.tom}`} onClick={() => setFiltro(filtro === f.valor ? 'todas' : f.valor)}>
              <strong className="numero">{contagem[f.valor]}</strong>
              <span>{f.rotulo}</span>
            </button>
          ))}
        </div>
      )}
      <div className="analise__barra">
        {ambientes.length > 1 && (
          <label className="analise__escolha">
            <span>Ambiente</span>
            <select value={ambienteId} onChange={(e) => setAmbienteId(e.target.value)}>
              <option value="todos">Todos</option>
              {ambientes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="analise__escolha">
          <span>Ordenar</span>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
            {ORDENS_PAINEL.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        <span className="analise__total mudo" role="status">
          {visiveis.length === doAmbiente.length ? `${visiveis.length} mesa(s)` : `${visiveis.length} de ${doAmbiente.length}`}
        </span>
      </div>
      {visiveis.length ? (
        grupos.map((g) => (
          <section key={g.id} className="analise__grupo" aria-label={g.nome || 'Mesas'}>
            {g.nome && (
              <h3 className="analise__titulo">
                {g.nome} <small className="numero">{g.itens.length}</small>
              </h3>
            )}
            <div className="analise__grade">
              {g.itens.map(({ mesa, situacao }) => (
                <CartaoAnalise key={mesa.id} mesa={mesa} situacao={situacao} escolhida={escolhida === mesa.id} permitida={!podeTocar || podeTocar(mesa, situacao)} aoTocar={aoTocar} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="analise__vazio mudo">{termo ? `Nenhuma mesa começa com “${busca.trim()}”.` : 'Nenhuma mesa neste filtro agora.'}</p>
      )}
    </div>
  )
}
