// Dados de demonstração: duas semanas de vendas em todas as filiais, estoque
// inicial, contas do mês e um comunicado. Servem para ver o painel e os relatórios
// funcionando antes de a loja usar de verdade. Tudo é marcado como demonstração.

import { somarDias, hoje, diaDe } from '../lib/datas.js'
import { totalItem } from './vendas.js'

// Gerador com semente: os mesmos números a cada geração, sem Math.random.
function aleatorio(semente) {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Movimento ao longo do dia: pico no almoço e no fim da tarde.
const PESO_HORA = { 8: 2, 9: 3, 10: 5, 11: 9, 12: 13, 13: 10, 14: 6, 15: 6, 16: 8, 17: 11, 18: 12, 19: 9, 20: 6, 21: 3 }

const VENDAS_DIA = {
  'f-max-morumbi': 34,
  'f-imigrantes': 30,
  'f-campinas-pague-menos': 18,
  'f-campinas-enxuto': 15,
  'f-jundiai-ipe': 14,
  'f-vila-arens': 12,
  'f-max-ipanema': 16,
  'f-penha': 13,
  'f-fabrica': 6,
}

export function gerarHistorico({ produtos, gruposModificadores, filiais, formas, operadores, dias = 14 }) {
  const rnd = aleatorio(20261022)
  const escolher = (lista) => lista[Math.floor(rnd() * lista.length)]
  const vendaveis = produtos.filter((p) => p.tipo === 'venda')
  // Produtos mais pedidos aparecem mais
  const sorteio = vendaveis.flatMap((p) => {
    const peso = p.id.startsWith('p-g-frango') || p.id === 'p-copo-salgado' ? 9 : p.id.startsWith('p-g-') ? 4 : p.id.startsWith('p-m-') ? 3 : p.grupoId === 'g-bebidas' ? 3 : p.grupoId === 'g-churros' ? 3 : 1
    return Array(peso).fill(p)
  })
  const grupos = new Map(gruposModificadores.map((g) => [g.id, g]))
  const horas = Object.entries(PESO_HORA).flatMap(([h, peso]) => Array(peso).fill(Number(h)))
  const vendas = []
  const fim = hoje()
  const agora = new Date()

  for (let d = dias - 1; d >= 0; d--) {
    const dia = somarDias(fim, -d)
    const data = new Date(`${dia}T00:00:00`)
    const fimDeSemana = data.getDay() === 0 || data.getDay() === 6
    for (const filial of filiais) {
      const operadoresFilial = operadores.filter((o) => o.todasFiliais || o.filiais?.includes(filial.id))
      const base = VENDAS_DIA[filial.id] || 10
      const qtdDia = Math.round(base * (fimDeSemana ? 1.3 : 1) * (0.8 + rnd() * 0.4))
      let numero = 0
      for (let n = 0; n < qtdDia; n++) {
        const quando = new Date(data)
        quando.setHours(escolher(horas), Math.floor(rnd() * 60), Math.floor(rnd() * 60))
        if (quando > agora) continue
        numero++
        const itens = []
        const qtdItens = rnd() < 0.55 ? 1 : rnd() < 0.7 ? 2 : 3
        for (let i = 0; i < qtdItens; i++) {
          const p = escolher(sorteio)
          const modificadores = []
          for (const gid of p.gruposModificadores) {
            const g = grupos.get(gid)
            if (!g || g.min === 0) continue
            const qtdEscolhas = Math.max(g.min, Math.min(g.max, 1 + Math.floor(rnd() * g.max)))
            const escolhidas = [...g.opcoes].sort(() => rnd() - 0.5).slice(0, qtdEscolhas)
            for (const o of escolhidas) modificadores.push({ grupoId: g.id, grupoNome: g.nome, opcaoId: o.id, nome: o.nome, preco: o.preco, qtd: 1 })
          }
          const item = { produtoId: p.id, nome: p.nome, qtd: rnd() < 0.85 ? 1 : 2, precoUnit: p.preco, setor: p.config.setor, modificadores }
          itens.push({ ...item, total: totalItem(item) })
        }
        const total = itens.reduce((t, i) => t + i.total, 0)
        const forma = rnd() < 0.42 ? formas[1] : rnd() < 0.5 ? formas[3] : rnd() < 0.6 ? formas[2] : rnd() < 0.7 ? formas[0] : formas[4]
        const pago = forma.tipo === 'dinheiro' ? Math.ceil(total / 1000) * 1000 : total
        const r = rnd()
        const status = r < 0.012 ? 'cancelada' : r < 0.016 ? 'estornada' : 'concluida'
        const operador = escolher(operadoresFilial.length ? operadoresFilial : operadores)
        const itensCancelados =
          rnd() < 0.05 ? [{ produtoId: itens[0].produtoId, nome: itens[0].nome, qtd: 1, precoUnit: itens[0].precoUnit, total: itens[0].precoUnit, motivo: 'Cliente desistiu', em: quando.toISOString() }] : []
        vendas.push({
          id: `demo-${filial.id.slice(2, 8)}-${dia}-${numero}`,
          criadoEm: quando.toISOString(),
          numero,
          dia: diaDe(quando),
          filialId: filial.id,
          pdvId: `pdv-${filial.id}-1`,
          caixaId: null,
          operadorId: operador.id,
          operadorNome: operador.nome,
          tipo: rnd() < 0.6 ? 'balcao' : 'viagem',
          cliente: null,
          itens,
          itensCancelados,
          descontoPedido: null,
          bruto: total,
          promocoes: 0,
          descontos: 0,
          total,
          pagamentos: [{ formaId: forma.id, valor: pago, troco: pago - total }],
          status,
          cozinha: { status: 'entregue', em: quando.toISOString() },
          demonstracao: true,
        })
      }
    }
  }
  return vendas.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
}

export function saldosIniciais(produtos, filiais) {
  const rnd = aleatorio(7)
  const saldos = {}
  for (const f of filiais)
    for (const p of produtos) {
      if (p.composicao?.length) continue
      if (!p.config.controlaEstoque && p.tipo !== 'insumo') continue
      saldos[`${f.id}|${p.id}`] = p.tipo === 'insumo' ? 200 + Math.floor(rnd() * 400) : 15 + Math.floor(rnd() * 70)
    }
  // Um item acabando, para mostrar o alerta de estoque baixo
  saldos['f-max-morumbi|p-g-caipira'] = 3
  return saldos
}

export function contasDoMes(filiais) {
  const base = hoje().slice(0, 8)
  const lista = []
  const add = (tipo, descricao, categoria, filialId, valor, diaVenc, pago) =>
    lista.push({
      id: `demo-conta-${lista.length}`,
      criadoEm: new Date().toISOString(),
      tipo,
      descricao,
      categoria,
      filialId,
      valor,
      vencimento: `${base}${String(diaVenc).padStart(2, '0')}`,
      pagoEm: pago ? `${base}${String(Math.max(1, diaVenc - 1)).padStart(2, '0')}` : null,
      fornecedorId: null,
      obs: '',
      demonstracao: true,
    })
  for (const f of filiais.slice(0, 4)) {
    add('pagar', 'Aluguel da loja', 'Aluguel', f.id, 650000, 5, true)
    add('pagar', 'Pedido da fábrica', 'Mercadoria (fábrica)', f.id, 1280000, 12, true)
    add('pagar', 'Energia elétrica', 'Energia e água', f.id, 89000, 18, false)
    add('pagar', 'Royalties e fundo de marketing', 'Royalties e fundo de marketing', f.id, 210000, 25, false)
    add('receber', 'Repasse iFood', 'Vendas iFood e 99Food', f.id, 430000, 15, true)
    add('receber', 'Repasse iFood', 'Vendas iFood e 99Food', f.id, 455000, 29, false)
  }
  return lista
}
