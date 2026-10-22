// Filtros de período e de filiais, usados no painel e nos relatórios.

import { useEffect, useRef, useState } from 'react'
import { Icone } from './Icone.jsx'
import { Marcador } from './ui.jsx'
import { hoje, somarDias, dataCurta } from '../lib/datas.js'

export const PERIODOS = [
  { id: 'hoje', nome: 'Hoje' },
  { id: 'ontem', nome: 'Ontem' },
  { id: '7d', nome: '7 dias' },
  { id: '30d', nome: '30 dias' },
  { id: 'mes', nome: 'Este mês' },
  { id: 'livre', nome: 'Escolher' },
]

export function intervaloDe(id, livre) {
  const h = hoje()
  if (id === 'hoje') return { inicio: h, fim: h }
  if (id === 'ontem') return { inicio: somarDias(h, -1), fim: somarDias(h, -1) }
  if (id === '7d') return { inicio: somarDias(h, -6), fim: h }
  if (id === '30d') return { inicio: somarDias(h, -29), fim: h }
  if (id === 'mes') return { inicio: `${h.slice(0, 8)}01`, fim: h }
  return { inicio: livre?.inicio || h, fim: livre?.fim || h }
}

// O período anterior de mesmo tamanho, para comparar
export function intervaloAnterior({ inicio, fim }) {
  const dias = Math.round((new Date(fim) - new Date(inicio)) / 86400000) + 1
  return { inicio: somarDias(inicio, -dias), fim: somarDias(inicio, -1) }
}

export function FiltroPeriodo({ periodo, aoMudar, livre, aoMudarLivre }) {
  return (
    <div className="filtro-periodo">
      <div className="segmentos segmentos--p" role="radiogroup" aria-label="Período">
        {PERIODOS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={periodo === p.id} onClick={() => aoMudar(p.id)}>
            {p.nome}
          </button>
        ))}
      </div>
      {periodo === 'livre' && (
        <div className="filtro-periodo__datas">
          <input type="date" className="entrada" value={livre.inicio} max={livre.fim} onChange={(e) => aoMudarLivre({ ...livre, inicio: e.target.value })} aria-label="Data inicial" />
          <span>até</span>
          <input type="date" className="entrada" value={livre.fim} min={livre.inicio} max={hoje()} onChange={(e) => aoMudarLivre({ ...livre, fim: e.target.value })} aria-label="Data final" />
        </div>
      )}
    </div>
  )
}

export function rotuloIntervalo({ inicio, fim }) {
  return inicio === fim ? dataCurta(inicio) : `${dataCurta(inicio)} a ${dataCurta(fim)}`
}

export function SeletorFiliais({ filiais, selecionadas, aoMudar }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e) => !ref.current?.contains(e.target) && setAberto(false)
    const esc = (e) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  const todas = selecionadas.length === filiais.length
  const rotulo = todas ? 'Todas as filiais' : selecionadas.length === 1 ? filiais.find((f) => f.id === selecionadas[0])?.nome : selecionadas.length ? `${selecionadas.length} filiais` : 'Nenhuma filial'

  return (
    <div className="seletor-filiais" ref={ref}>
      <button type="button" className="seletor-filiais__botao" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <Icone nome="loja" tamanho={17} /> {rotulo} <Icone nome="seta-baixo" tamanho={14} />
      </button>
      {aberto && (
        <div className="seletor-filiais__lista">
          <div className="linha">
            <button type="button" className="link" onClick={() => aoMudar(filiais.map((f) => f.id))}>
              Todas
            </button>
            <button type="button" className="link" onClick={() => aoMudar([])}>
              Nenhuma
            </button>
          </div>
          {filiais.map((f) => (
            <Marcador key={f.id} rotulo={f.nome} marcado={selecionadas.includes(f.id)} aoMudar={(m) => aoMudar(m ? [...selecionadas, f.id] : selecionadas.filter((x) => x !== f.id))} />
          ))}
        </div>
      )}
    </div>
  )
}
