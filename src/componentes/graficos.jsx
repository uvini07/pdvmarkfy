// Gráficos em SVG, sem biblioteca. Uma série só por gráfico (o título diz o que
// é), barras finas com ponta arredondada, grade discreta e dica ao passar o
// mouse ou focar. A barra de maior valor ganha rótulo direto.

import { useLayoutEffect, useRef, useState } from 'react'

const COR = '#C98A0A'
const COR_ATIVA = '#8A5A06'

function escalaBonita(max) {
  if (max <= 0) return [0, 1]
  const passo = 10 ** Math.floor(Math.log10(max))
  const topo = Math.ceil(max / passo) * passo
  return [0, topo]
}

const compacto = (centavos) => {
  const v = centavos / 100
  if (v >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

// Colunas verticais (vendas por hora, por dia)
export function Colunas({ dados, rotulo, valor, formatar, titulo, altura = 220 }) {
  const [ativo, setAtivo] = useState(null)
  // Desenha na largura real do cartão: texto e barras não esticam nem encolhem
  const caixa = useRef(null)
  const [largura, setLargura] = useState(640)
  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const margem = { topo: 24, base: 26, esq: 44, dir: 8 }
  const valores = dados.map(valor)
  const max = Math.max(...valores, 0)
  const [, topo] = escalaBonita(max)
  const banda = (largura - margem.esq - margem.dir) / Math.max(1, dados.length)
  const barra = Math.min(24, banda * 0.62)
  const y = (v) => margem.topo + (altura - margem.topo - margem.base) * (1 - v / topo)
  const indiceMax = valores.indexOf(max)
  const passoRotulo = Math.ceil(dados.length / Math.max(4, Math.floor(largura / 56)))

  return (
    <figure className="grafico" ref={caixa}>
      <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={titulo}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={margem.esq} x2={largura - margem.dir} y1={y(topo * f)} y2={y(topo * f)} className="grafico__grade" />
            <text x={margem.esq - 8} y={y(topo * f) + 4} textAnchor="end" className="grafico__eixo">
              {compacto(topo * f)}
            </text>
          </g>
        ))}
        {dados.map((d, i) => {
          const v = valores[i]
          const x = margem.esq + banda * i + (banda - barra) / 2
          const h = Math.max(0, y(0) - y(v))
          const r = Math.min(4, h / 2, barra / 2)
          const caminho = h > 0 ? `M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + barra - r} Q${x + barra},${y(v)} ${x + barra},${y(v) + r} V${y(0)} Z` : ''
          return (
            <g key={i} onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)} onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)} tabIndex={0} aria-label={`${rotulo(d)}: ${formatar(v)}`}>
              <rect x={margem.esq + banda * i} y={margem.topo} width={banda} height={altura - margem.topo - margem.base} fill="transparent" />
              {caminho && <path d={caminho} fill={ativo === i ? COR_ATIVA : COR} />}
              {i % passoRotulo === 0 && (
                <text x={x + barra / 2} y={altura - 8} textAnchor="middle" className="grafico__eixo">
                  {rotulo(d)}
                </text>
              )}
              {i === indiceMax && v > 0 && ativo === null && (
                <text x={x + barra / 2} y={y(v) - 7} textAnchor="middle" className="grafico__valor">
                  {formatar(v)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {ativo !== null && (
        <figcaption className="grafico__dica" style={{ left: `${((margem.esq + banda * ativo + banda / 2) / largura) * 100}%` }}>
          <strong>{rotulo(dados[ativo])}</strong>
          {formatar(valores[ativo])}
        </figcaption>
      )}
    </figure>
  )
}

// Barras horizontais com rótulo e valor em texto (formas de pagamento, filiais,
// mais vendidos). O valor fica sempre escrito: a cor nunca é o único canal.
export function Barras({ dados, nome, valor, formatar, detalhe, limite = 8 }) {
  const lista = dados.slice(0, limite)
  const max = Math.max(...lista.map(valor), 1)
  return (
    <ol className="barras">
      {lista.map((d, i) => (
        <li key={i}>
          <div className="barras__texto">
            <span className="barras__nome">{nome(d)}</span>
            <span className="barras__valor numero">
              {formatar(valor(d))}
              {detalhe && <small> {detalhe(d)}</small>}
            </span>
          </div>
          <div className="barras__trilho" aria-hidden="true">
            <span style={{ width: `${(valor(d) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}
