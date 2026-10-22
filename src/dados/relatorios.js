// Agregações usadas no painel e nos relatórios. Tudo calculado sobre a lista
// de vendas já filtrada por período, horário e filiais.

import { listaDias } from '../lib/datas.js'

export function filtrarVendas(vendas, { inicio, fim, filiais, horaInicio, horaFim }) {
  const hIni = horaInicio ? Number(horaInicio.split(':')[0]) * 60 + Number(horaInicio.split(':')[1] || 0) : null
  const hFim = horaFim ? Number(horaFim.split(':')[0]) * 60 + Number(horaFim.split(':')[1] || 0) : null
  return vendas.filter((v) => {
    if (inicio && v.dia < inicio) return false
    if (fim && v.dia > fim) return false
    if (filiais?.length && !filiais.includes(v.filialId)) return false
    if (hIni !== null || hFim !== null) {
      const d = new Date(v.criadoEm)
      const m = d.getHours() * 60 + d.getMinutes()
      if (hIni !== null && m < hIni) return false
      if (hFim !== null && hFim > 0 && m >= hFim) return false
    }
    return true
  })
}

const valorCancelado = (c) => c.total ?? c.precoUnit * c.qtd

export function resumo(vendas) {
  const concluidas = vendas.filter((v) => v.status === 'concluida')
  const canceladas = vendas.filter((v) => v.status === 'cancelada')
  const estornadas = vendas.filter((v) => v.status === 'estornada')
  const total = concluidas.reduce((t, v) => t + v.total, 0)
  const itensCancelados = vendas.reduce((t, v) => t + (v.itensCancelados || []).reduce((s, c) => s + valorCancelado(c), 0), 0)
  return {
    total,
    quantidade: concluidas.length,
    ticket: concluidas.length ? Math.round(total / concluidas.length) : 0,
    cancelado: canceladas.reduce((t, v) => t + v.total, 0) + itensCancelados,
    vendasComCancelamento: vendas.filter((v) => v.status === 'cancelada' || v.itensCancelados?.length).length,
    estornado: estornadas.reduce((t, v) => t + v.total, 0),
    estornos: estornadas.length,
    descontos: concluidas.reduce((t, v) => t + (v.descontos || 0), 0),
    itens: concluidas.reduce((t, v) => t + v.itens.reduce((s, i) => s + i.qtd, 0), 0),
  }
}

export function porHora(vendas) {
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, total: 0, quantidade: 0 }))
  for (const v of vendas) {
    if (v.status !== 'concluida') continue
    const h = new Date(v.criadoEm).getHours()
    horas[h].total += v.total
    horas[h].quantidade++
  }
  return horas
}

export function porForma(vendas, formas) {
  const mapa = new Map(formas.map((f) => [f.id, { id: f.id, nome: f.nome, total: 0, quantidade: 0 }]))
  for (const v of vendas) {
    if (v.status !== 'concluida') continue
    for (const p of v.pagamentos) {
      if (!mapa.has(p.formaId)) mapa.set(p.formaId, { id: p.formaId, nome: 'Outra', total: 0, quantidade: 0 })
      const f = mapa.get(p.formaId)
      f.total += p.valor - (p.troco || 0)
      f.quantidade++
    }
  }
  return [...mapa.values()].filter((f) => f.quantidade).sort((a, b) => b.total - a.total)
}

export function porProduto(vendas) {
  const mapa = new Map()
  for (const v of vendas) {
    if (v.status !== 'concluida') continue
    for (const i of v.itens) {
      if (!mapa.has(i.produtoId)) mapa.set(i.produtoId, { id: i.produtoId, nome: i.nome, quantidade: 0, total: 0 })
      const p = mapa.get(i.produtoId)
      p.quantidade += i.qtd
      p.total += i.total ?? i.precoUnit * i.qtd
    }
  }
  return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade || b.total - a.total)
}

export function porFilial(vendas, filiais) {
  return filiais
    .map((f) => {
      const r = resumo(vendas.filter((v) => v.filialId === f.id))
      return { id: f.id, nome: f.nome, ...r }
    })
    .sort((a, b) => b.total - a.total)
}

export function porDia(vendas, inicio, fim) {
  const mapa = new Map(listaDias(inicio, fim).map((d) => [d, { dia: d, total: 0, quantidade: 0 }]))
  for (const v of vendas) {
    if (v.status !== 'concluida' || !mapa.has(v.dia)) continue
    const d = mapa.get(v.dia)
    d.total += v.total
    d.quantidade++
  }
  return [...mapa.values()]
}

export function porOperador(vendas) {
  const mapa = new Map()
  for (const v of vendas) {
    const k = v.operadorId || 'sem'
    if (!mapa.has(k)) mapa.set(k, { id: k, nome: v.operadorNome || '—', quantidade: 0, total: 0, canceladas: 0, descontos: 0 })
    const o = mapa.get(k)
    if (v.status === 'concluida') {
      o.quantidade++
      o.total += v.total
      o.descontos += v.descontos || 0
    } else o.canceladas++
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total)
}

export function variacao(atual, anterior) {
  if (!anterior) return null
  return Math.round(((atual - anterior) / anterior) * 1000) / 10
}
