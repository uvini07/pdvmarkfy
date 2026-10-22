// Contas do pedido e o ciclo de vida da venda: concluída → (cancelada | estornada).
//
// Pedido em andamento (estado do caixa, ainda não gravado):
//   itens: [{ uid, produtoId, nome, qtd, precoUnit, setor, modificadores: [...],
//             obs, promocao: { id, nome, desconto por unidade }, desconto }]
//   descontoPedido: { tipoId, nome, percentual | valor, autorizadoPor }
//   tipo: 'balcao' | 'viagem' | 'encomenda' | 'mesa', cliente: { nome, cpf }, itensCancelados: [],
//   mesa: { mesaId, contaId, nome, ambienteNome, pessoas, origem } quando o pedido vai para uma mesa
//
// Venda de mesa (tipo 'mesa') nasce quando a conta fecha (ver mesas.js): traz
// mesa { id, nome, ambienteNome, pessoas, abertaEm, garcomNome, contaId } e a
// taxa de serviço em "servico", que fica fora do total vendido.

import { banco } from './banco.js'
import { registrar } from './auditoria.js'
import { baixarVenda } from './estoque.js'
import { hoje } from '../lib/datas.js'
import { porcentagem, reais } from '../lib/dinheiro.js'

export const TIPOS_PEDIDO = [
  { id: 'balcao', nome: 'Comer aqui' },
  { id: 'viagem', nome: 'Para viagem' },
  { id: 'encomenda', nome: 'Encomenda' },
]

const NOMES_TIPO = { ...Object.fromEntries(TIPOS_PEDIDO.map((t) => [t.id, t.nome])), mesa: 'Mesa' }
export const nomeTipoPedido = (id) => NOMES_TIPO[id] || id

// Como o pedido aparece em listas: a mesa, o nome do cliente ou o tipo
export const rotuloPedido = (v) => v.mesa?.nome || v.cliente?.nome || nomeTipoPedido(v.tipo)

export const valorUnitario = (item) => item.precoUnit + (item.modificadores || []).reduce((t, m) => t + m.preco * (m.qtd || 1), 0)
export const brutoItem = (item) => valorUnitario(item) * item.qtd
export const promocaoItem = (item) => (item.promocao?.desconto || 0) * item.qtd

export function descontoManualItem(item) {
  const d = item.desconto
  if (!d) return 0
  const base = brutoItem(item) - promocaoItem(item)
  return Math.min(base, d.percentual ? porcentagem(base, d.percentual) : d.valor || 0)
}

export const totalItem = (item) => brutoItem(item) - promocaoItem(item) - descontoManualItem(item)

export function totaisPedido(pedido) {
  const itens = pedido.itens || []
  const bruto = itens.reduce((t, i) => t + brutoItem(i), 0)
  const promocoes = itens.reduce((t, i) => t + promocaoItem(i), 0)
  const descontosItens = itens.reduce((t, i) => t + descontoManualItem(i), 0)
  const base = bruto - promocoes - descontosItens
  const d = pedido.descontoPedido
  const descontoPedido = d ? Math.min(base, d.percentual ? porcentagem(base, d.percentual) : d.valor || 0) : 0
  return {
    bruto,
    promocoes,
    descontos: descontosItens + descontoPedido,
    descontoPedido,
    total: base - descontoPedido,
    quantidade: itens.reduce((t, i) => t + i.qtd, 0),
  }
}

// Senha do pedido: recomeça todo dia em cada filial (1 a 999). A soma é feita
// dentro da transação do banco, então dois caixas nunca pegam a mesma senha.
export async function proximaSenha(filialId) {
  const k = `${filialId}:${hoje()}`
  const finais = await banco.somar('sequencias', [[k, 1]], { ciclo: 999 })
  return finais[k]
}

export async function finalizarVenda({ pedido, pagamentos, usuario, filialId, pdvId, caixaId, mesa = null, servico = 0 }) {
  const totais = totaisPedido(pedido)
  const recebido = pagamentos.reduce((t, p) => t + p.valor - (p.troco || 0), 0)
  if (recebido < totais.total + servico) throw new Error('O valor recebido é menor que o total do pedido.')

  const numero = await proximaSenha(filialId)
  // Os pedidos de mesa já foram para a cozinha rodada a rodada
  const vaiParaCozinha = !mesa && pedido.itens.some((i) => i.setor === 'cozinha')
  const venda = banco.inserir('vendas', {
    numero,
    dia: hoje(),
    filialId,
    pdvId,
    caixaId,
    operadorId: usuario.id,
    operadorNome: usuario.nome,
    // "mesa" só vale com a mesa junto; um rascunho antigo sem mesa vira balcão
    tipo: mesa ? 'mesa' : pedido.tipo && pedido.tipo !== 'mesa' ? pedido.tipo : 'balcao',
    cliente: pedido.cliente?.nome || pedido.cliente?.cpf ? { nome: pedido.cliente.nome || '', cpf: pedido.cliente.cpf || '' } : null,
    obs: pedido.obs || '',
    itens: pedido.itens.map(({ uid, ...i }) => ({ ...i, total: totalItem(i) })),
    itensCancelados: pedido.itensCancelados || [],
    descontoPedido: pedido.descontoPedido || null,
    bruto: totais.bruto,
    promocoes: totais.promocoes,
    descontos: totais.descontos,
    total: totais.total,
    servico,
    mesa,
    pagamentos,
    status: 'concluida',
    cozinha: vaiParaCozinha ? { status: 'novo', em: new Date().toISOString() } : null,
  })

  baixarVenda(venda, { usuario })
  registrar('venda.concluida', `${mesa ? `${mesa.nome}, pedido` : 'Pedido'} ${numero}, ${reais(totais.total)}${servico ? ` + ${reais(servico)} de serviço` : ''}`, { usuario, filialId })
  if (totais.descontos) registrar('venda.desconto', `Pedido ${numero}, desconto de ${reais(totais.descontos)}`, { usuario, filialId })
  // Na mesa, cada cancelamento já foi registrado na hora em que aconteceu
  if (!mesa)
    for (const c of pedido.itensCancelados || []) registrar('venda.item-cancelado', `Pedido ${numero}: ${c.qtd}× ${c.nome} (${c.motivo})`, { usuario, filialId })
  return venda
}

// Pedido cancelado inteiro antes de cobrar: fica registrado como venda cancelada
// (sem senha e sem baixa de estoque), para aparecer nos cancelamentos do painel.
export function registrarPedidoCancelado({ pedido, motivo, usuario, autorizador, filialId, pdvId, caixaId, mesa = null }) {
  const totais = totaisPedido(pedido)
  const agora = new Date().toISOString()
  const venda = banco.inserir('vendas', {
    numero: 0,
    dia: hoje(),
    filialId,
    pdvId,
    caixaId,
    operadorId: usuario.id,
    operadorNome: usuario.nome,
    tipo: mesa ? 'mesa' : pedido.tipo,
    mesa,
    cliente: null,
    obs: '',
    itens: pedido.itens.map(({ uid, ...i }) => ({ ...i, total: totalItem(i) })),
    itensCancelados: pedido.itensCancelados || [],
    descontoPedido: null,
    bruto: totais.bruto,
    promocoes: totais.promocoes,
    descontos: totais.descontos,
    total: totais.total,
    pagamentos: [],
    status: 'cancelada',
    antesDoPagamento: true,
    cozinha: null,
    encerramento: { motivo, em: agora, usuarioId: usuario.id, usuarioNome: usuario.nome, autorizadorNome: autorizador?.nome || null },
  })
  registrar('venda.cancelada', `${mesa ? `Conta da ${mesa.nome}` : 'Pedido'} não cobrado, ${reais(totais.total)}: ${motivo}`, { usuario, filialId })
  return venda
}

function encerrar(vendaId, status, { motivo, usuario, autorizador }) {
  const venda = banco.obter('vendas', vendaId)
  if (!venda || venda.status !== 'concluida') throw new Error('Esta venda não pode mais ser alterada.')
  const atualizada = banco.atualizar('vendas', vendaId, {
    status,
    encerramento: {
      motivo,
      em: new Date().toISOString(),
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      autorizadorId: autorizador?.id || null,
      autorizadorNome: autorizador?.nome || null,
    },
    cozinha: venda.cozinha && venda.cozinha.status !== 'entregue' ? { ...venda.cozinha, status: 'cancelado' } : venda.cozinha,
  })
  baixarVenda(venda, { devolver: true, usuario })
  const acao = status === 'cancelada' ? 'venda.cancelada' : 'venda.estornada'
  const quem = autorizador && autorizador.id !== usuario.id ? `, autorizado por ${autorizador.nome}` : ''
  registrar(acao, `Pedido ${venda.numero}, ${reais(venda.total)}: ${motivo}${quem}`, { usuario, filialId: venda.filialId })
  return atualizada
}

export const cancelarVenda = (id, dados) => encerrar(id, 'cancelada', dados)
export const estornarVenda = (id, dados) => encerrar(id, 'estornada', dados)

export const STATUS_COZINHA = ['novo', 'preparo', 'pronto', 'entregue']

export function avancarCozinha(vendaId, status) {
  banco.atualizar('vendas', vendaId, (v) => ({ cozinha: { ...v.cozinha, status, [`${status}Em`]: new Date().toISOString() } }))
}
