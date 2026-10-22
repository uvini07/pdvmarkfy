// Estoque por filial. O saldo de cada produto fica no documento "saldos"
// (chave filial|produto) e cada mudança gera um movimento, para dar histórico.
//
// Baixa automática na venda:
//   - produto com composição → baixa os componentes;
//   - produto que controla estoque e não tem composição → baixa ele mesmo;
//   - sabores e opções ligados a um insumo → baixam o insumo. Quando o grupo de
//     sabores tem "rateio", as unidades se dividem entre os sabores escolhidos
//     (caixa de 50 com 2 sabores = 25 de cada).

import { banco } from './banco.js'
import { registrar } from './auditoria.js'

const chave = (filialId, produtoId) => `${filialId}|${produtoId}`

export const saldo = (saldos, filialId, produtoId) => saldos[chave(filialId, produtoId)] ?? 0

export const TIPOS_MOVIMENTO = {
  entrada: { nome: 'Entrada', sinal: 1 },
  saida: { nome: 'Saída', sinal: -1 },
  perda: { nome: 'Perda', sinal: -1 },
  transferencia: { nome: 'Transferência', sinal: -1 },
  inventario: { nome: 'Inventário', sinal: 0 },
  producao: { nome: 'Produção', sinal: 1 },
  venda: { nome: 'Venda', sinal: -1 },
  devolucao: { nome: 'Devolução de venda', sinal: 1 },
}

const aplicar = (ajustes) => banco.somar('saldos', ajustes)

export function movimentar({ tipo, filialId, destinoId, itens, documento = '', fornecedorId = null, obs = '', usuario, vendaId = null, silencioso = false }) {
  const saldos = banco.doc('saldos')
  const ajustes = []
  const itensGravados = []
  for (const it of itens) {
    const qtd = Number(it.qtd) || 0
    if (!it.produtoId || (!qtd && tipo !== 'inventario')) continue
    if (tipo === 'inventario') {
      const atual = saldo(saldos, filialId, it.produtoId)
      ajustes.push([chave(filialId, it.produtoId), qtd - atual])
      itensGravados.push({ ...it, qtd, anterior: atual })
    } else if (tipo === 'transferencia') {
      ajustes.push([chave(filialId, it.produtoId), -qtd])
      ajustes.push([chave(destinoId, it.produtoId), qtd])
      itensGravados.push({ ...it, qtd })
    } else {
      ajustes.push([chave(filialId, it.produtoId), TIPOS_MOVIMENTO[tipo].sinal * qtd])
      itensGravados.push({ ...it, qtd })
    }
  }
  if (!ajustes.length) return null
  aplicar(ajustes)

  // Entrada com custo atualiza o "último custo" do produto
  if (tipo === 'entrada') {
    for (const it of itensGravados) if (it.custo) banco.atualizar('produtos', it.produtoId, { custo: it.custo })
  }

  const valor = itensGravados.reduce((t, it) => t + (it.custo || 0) * Math.abs(it.qtd), 0)
  const mov = banco.inserir('movimentosEstoque', {
    tipo,
    filialId,
    destinoId: destinoId || null,
    fornecedorId,
    documento,
    obs,
    itens: itensGravados,
    valor,
    vendaId,
    usuarioId: usuario?.id || null,
    usuarioNome: usuario?.nome || '',
  })
  if (!silencioso) registrar('estoque.movimento', `${TIPOS_MOVIMENTO[tipo].nome}, ${itensGravados.length} item(ns)`, { usuario, filialId })
  return mov
}

// Quanto de cada produto/insumo uma venda consome.
export function consumoDaVenda(venda, produtos, gruposModificadores) {
  const porId = new Map(produtos.map((p) => [p.id, p]))
  const grupos = new Map(gruposModificadores.map((g) => [g.id, g]))
  const consumo = new Map()
  const somar = (id, q) => consumo.set(id, (consumo.get(id) || 0) + q)

  for (const item of venda.itens) {
    const produto = porId.get(item.produtoId)
    if (!produto) continue
    if (produto.composicao?.length) {
      for (const c of produto.composicao) somar(c.produtoId, c.qtd * item.qtd)
    } else if (produto.config?.controlaEstoque) {
      somar(produto.id, item.qtd)
    }
    const porGrupo = new Map()
    for (const m of item.modificadores || []) {
      if (!porGrupo.has(m.grupoId)) porGrupo.set(m.grupoId, [])
      porGrupo.get(m.grupoId).push(m)
    }
    for (const [grupoId, escolhas] of porGrupo) {
      const grupo = grupos.get(grupoId)
      const total = escolhas.reduce((t, m) => t + (m.qtd || 1), 0)
      for (const m of escolhas) {
        const op = grupo?.opcoes.find((o) => o.id === m.opcaoId)
        if (!op?.insumoId) continue
        const q = grupo.rateio ? (grupo.rateio * (m.qtd || 1)) / total : (op.qtd || 1) * (m.qtd || 1)
        somar(op.insumoId, q * item.qtd)
      }
    }
  }
  return [...consumo].map(([produtoId, qtd]) => ({ produtoId, qtd: Math.round(qtd * 1000) / 1000 }))
}

export function baixarVenda(venda, { devolver = false, usuario } = {}) {
  const itens = consumoDaVenda(venda, banco.lista('produtos'), banco.lista('gruposModificadores'))
  if (!itens.length) return
  movimentar({
    tipo: devolver ? 'devolucao' : 'venda',
    filialId: venda.filialId,
    itens,
    documento: `Pedido ${venda.numero}`,
    vendaId: venda.id,
    usuario,
    silencioso: true,
  })
}
