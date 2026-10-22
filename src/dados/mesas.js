// Contas das mesas. A conta abre quando os clientes sentam (ou no primeiro
// pedido), recebe os pedidos em rodadas — cada rodada vai na hora para a
// cozinha — e fecha no pagamento, quando vira uma venda como as do balcão
// (tipo "mesa"), com a taxa de serviço à parte do total vendido.
//
//   contasMesa:  { filialId, mesaId, mesaNome, ambienteId, ambienteNome, pessoas,
//                  clienteNome, abertaEm, garcomId, garcomNome, status, servico,
//                  descontoPedido, itensCancelados, pagamentos, ultimoPedidoEm,
//                  contaPedidaEm, fechadaEm, vendaId, juntadaEm, eventos }
//     status: 'aberta' → 'fechando' (pediu a conta) → 'fechada' | 'cancelada' | 'juntada'
//   pedidosMesa: { contaId, filialId, numero, dia, itens, obs, porId, porNome, cozinha, movidoDe }
//
// Cada rodada é um registro separado da conta porque a cozinha muda o
// andamento dela enquanto o caixa mexe na conta: cada aba grava só o próprio
// registro, e uma nunca desfaz a gravação da outra (ver banco.js).
//
// Item lançado não some: cancelado ou movido para outra mesa, ele continua na
// rodada, marcado, para a cozinha ver e para o registro.

import { banco } from './banco.js'
import { registrar } from './auditoria.js'
import { finalizarVenda, registrarPedidoCancelado, totaisPedido, totalItem } from './vendas.js'
import { hoje, minutosDesde } from '../lib/datas.js'
import { porcentagem, reais } from '../lib/dinheiro.js'
import { novoId } from '../lib/seguranca.js'
import { textoLimpo } from '../lib/validacao.js'

const ATIVAS = ['aberta', 'fechando']
export const contaAtiva = (c) => Boolean(c) && ATIVAS.includes(c.status)
export const contasAbertas = (contas, filialId) => contas.filter((c) => c.filialId === filialId && contaAtiva(c))
export const contaDaMesa = (contas, mesaId) => contas.find((c) => c.mesaId === mesaId && contaAtiva(c))
export const pedidosDaConta = (pedidos, contaId) => pedidos.filter((p) => p.contaId === contaId).sort((a, b) => a.numero - b.numero)

export const itemAtivo = (i) => !i.cancelado && !i.movido

export const itensDaConta = (pedidos) => pedidos.flatMap((p) => p.itens.filter(itemAtivo).map((i) => ({ ...i, pedidoId: p.id, pedidoNumero: p.numero })))

const pago = (lista) => (lista || []).reduce((t, p) => t + p.valor - (p.troco || 0), 0)

// Consumo (itens − promoções − descontos) + taxa de serviço = total.
// "falta" já desconta o que foi pago antes (pagamentos parciais).
export function totaisConta(conta, pedidos) {
  const itens = itensDaConta(pedidos)
  const t = totaisPedido({ itens, descontoPedido: conta.descontoPedido })
  const servico = conta.servico?.percentual ? porcentagem(t.total, conta.servico.percentual) : 0
  const total = t.total + servico
  const recebido = pago(conta.pagamentos)
  return { ...t, itens, consumo: t.total, servico, total, pago: recebido, falta: Math.max(0, total - recebido) }
}

// Parte de cada um quando a conta é dividida em partes iguais. O centavo que
// sobra vai nas primeiras partes: 100,00 em 3 = 33,34 + 33,33 + 33,33.
export const valorDaParte = (restante, partes) => Math.ceil(restante / Math.max(1, partes))

// Itens iguais somados, para a pré-conta e o cupom ficarem curtos
export function itensAgrupados(itens) {
  const mapa = new Map()
  for (const i of itens) {
    const k = JSON.stringify([i.produtoId, i.nome, i.precoUnit, (i.modificadores || []).map((m) => [m.opcaoId, m.preco]), i.obs || '', i.desconto?.nome || '', i.promocao?.id || ''])
    const atual = mapa.get(k)
    mapa.set(k, atual ? { ...atual, qtd: atual.qtd + i.qtd, total: atual.total + i.total } : { ...i })
  }
  return [...mapa.values()]
}

// ---------------------------------------------------------------------------
// Situação das mesas no mapa

// Livre, ocupada, pediu a conta ou fora de uso; com o aviso de atenção (sem
// pedido há muito tempo) e quantas rodadas estão prontas na cozinha.
export function situacaoMesa(mesa, conta, pedidos, { agora = Date.now(), alertaMin = 20 } = {}) {
  if (!conta) return { estado: mesa?.ativa === false ? 'inativa' : 'livre' }
  const totais = totaisConta(conta, pedidos)
  const semPedido = minutosDesde(conta.ultimoPedidoEm || conta.abertaEm, agora)
  return {
    estado: conta.status === 'fechando' ? 'fechando' : 'ocupada',
    conta,
    totais,
    pedidos,
    prontos: pedidos.filter((p) => p.cozinha?.status === 'pronto').length,
    minutos: minutosDesde(conta.abertaEm, agora),
    semPedido,
    atencao: conta.status === 'aberta' && semPedido >= alertaMin,
  }
}

// Tudo o que o mapa precisa de uma vez: situação de cada mesa, contas cuja
// mesa saiu do mapa (nunca somem da vista) e os números do salão.
export function resumoSalao({ mesas, contas, pedidos, agora = Date.now(), alertaMin = 20 }) {
  const porConta = new Map()
  for (const p of pedidos) {
    if (!porConta.has(p.contaId)) porConta.set(p.contaId, [])
    porConta.get(p.contaId).push(p)
  }
  const ativas = contas.filter(contaAtiva)
  const situacoes = new Map()
  for (const mesa of mesas) {
    const conta = ativas.find((c) => c.mesaId === mesa.id)
    const lista = conta ? (porConta.get(conta.id) || []).sort((a, b) => a.numero - b.numero) : []
    situacoes.set(mesa.id, situacaoMesa(mesa, conta, lista, { agora, alertaMin }))
  }
  const ids = new Set(mesas.map((m) => m.id))
  const foraDoMapa = ativas
    .filter((c) => !ids.has(c.mesaId))
    .map((c) => ({ mesa: { id: c.mesaId, numero: c.mesaNome, nome: c.mesaNome, ambienteNome: c.ambienteNome, foraDoMapa: true }, situacao: situacaoMesa(null, c, (porConta.get(c.id) || []).sort((a, b) => a.numero - b.numero), { agora, alertaMin }) }))
  const todas = [...situacoes.values(), ...foraDoMapa.map((f) => f.situacao)]
  const ocupadas = todas.filter((s) => s.conta)
  return {
    situacoes,
    foraDoMapa,
    total: mesas.filter((m) => m.ativa !== false).length,
    ocupadas: ocupadas.length,
    livres: [...situacoes.values()].filter((s) => s.estado === 'livre').length,
    fechando: ocupadas.filter((s) => s.estado === 'fechando').length,
    atencao: ocupadas.filter((s) => s.atencao).length,
    prontos: ocupadas.reduce((t, s) => t + s.prontos, 0),
    pessoas: ocupadas.reduce((t, s) => t + (s.conta.pessoas || 0), 0),
    emAberto: ocupadas.reduce((t, s) => t + s.totais.falta, 0),
  }
}

// Contas ainda abertas com dinheiro recebido por este caixa: o caixa não fecha
// antes delas, senão esse dinheiro ficaria fora do fechamento.
export const contasComPagamentoNoCaixa = (contas, caixaId) => contas.filter((c) => contaAtiva(c) && c.pagamentos?.some((p) => p.caixaId === caixaId))

// ---------------------------------------------------------------------------
// Operações

const agoraIso = () => new Date().toISOString()
const comEvento = (conta, texto, usuario) => [...(conta.eventos || []), { em: agoraIso(), texto, por: usuario?.nome || '' }]
const quemAutorizou = (usuario, autorizador) => (autorizador && autorizador.id !== usuario.id ? autorizador.nome : null)

function contaAtual(conta) {
  const atual = banco.obter('contasMesa', conta.id)
  if (!contaAtiva(atual)) throw new Error(`A conta da ${conta.mesaNome} já foi fechada em outro caixa. Abra a mesa de novo.`)
  return atual
}

export function abrirConta({ filialId, mesa, pessoas, clienteNome, usuario, servicoPercentual = 0 }) {
  if (contaDaMesa(banco.lista('contasMesa'), mesa.id)) throw new Error(`A ${mesa.nome} já está com a conta aberta.`)
  const qtd = Math.max(0, Math.min(99, Math.round(Number(pessoas) || 0)))
  const em = agoraIso()
  const conta = banco.inserir('contasMesa', {
    filialId,
    mesaId: mesa.id,
    mesaNome: mesa.nome,
    ambienteId: mesa.ambienteId || null,
    ambienteNome: mesa.ambienteNome || '',
    pessoas: qtd || null,
    clienteNome: textoLimpo(clienteNome, 40),
    abertaEm: em,
    garcomId: usuario.id,
    garcomNome: usuario.nome,
    status: 'aberta',
    servico: servicoPercentual > 0 ? { percentual: servicoPercentual } : null,
    descontoPedido: null,
    itensCancelados: [],
    pagamentos: [],
    ultimoPedidoEm: null,
    eventos: [{ em, texto: qtd ? `Mesa aberta para ${qtd} pessoa(s)` : 'Mesa aberta', por: usuario.nome }],
  })
  registrar('mesa.aberta', `${mesa.nome}${qtd ? `, ${qtd} pessoa(s)` : ''}`, { usuario, filialId })
  return conta
}

// Lança uma rodada na conta. Os itens de cozinha aparecem na tela da cozinha
// na hora. Pedir mais depois da pré-conta reabre a conta.
export function lancarPedido({ conta, itens, itensCancelados = [], obs = '', usuario, movidoDe = null }) {
  const atual = contaAtual(conta)
  const numero = Math.max(0, ...banco.lista('pedidosMesa').filter((p) => p.contaId === atual.id).map((p) => p.numero)) + 1
  const em = agoraIso()
  const lista = itens.map(({ uid, pedidoId, pedidoNumero, cancelado, movido, ...i }) => ({ ...i, id: novoId(8), total: totalItem(i) }))
  // Item movido de outra mesa já foi feito (ou está sendo feito) pela cozinha
  const vaiParaCozinha = !movidoDe && lista.some((i) => i.setor === 'cozinha')
  const pedido = banco.inserir('pedidosMesa', {
    contaId: atual.id,
    filialId: atual.filialId,
    numero,
    dia: hoje(),
    itens: lista,
    obs: textoLimpo(obs, 140),
    porId: usuario.id,
    porNome: usuario.nome,
    cozinha: vaiParaCozinha ? { status: 'novo', em } : null,
    movidoDe,
  })
  banco.atualizar('contasMesa', atual.id, (c) => ({
    status: 'aberta',
    ultimoPedidoEm: movidoDe ? c.ultimoPedidoEm : em,
    itensCancelados: itensCancelados.length ? [...(c.itensCancelados || []), ...itensCancelados] : c.itensCancelados,
    eventos: c.status === 'fechando' ? comEvento(c, 'Pediu mais depois da pré-conta: a conta voltou a ficar aberta', usuario) : c.eventos,
  }))
  if (!movidoDe) {
    const qtd = lista.reduce((t, i) => t + i.qtd, 0)
    registrar('mesa.pedido', `${atual.mesaNome}, ${numero}º pedido: ${qtd} item(ns), ${reais(lista.reduce((t, i) => t + i.total, 0))}`, { usuario, filialId: atual.filialId })
  }
  // Itens tirados do pedido antes de ele ir para a mesa
  for (const c of itensCancelados) registrar('venda.item-cancelado', `${atual.mesaNome}: ${c.qtd}× ${c.nome} (${c.motivo})`, { usuario, filialId: atual.filialId })
  return pedido
}

export function avancarCozinhaMesa(pedidoId, status) {
  banco.atualizar('pedidosMesa', pedidoId, (p) => ({ cozinha: { ...p.cozinha, status, [`${status}Em`]: agoraIso() } }))
}

export function alterarConta(conta, { pessoas, clienteNome }, usuario) {
  const qtd = Math.max(0, Math.min(99, Math.round(Number(pessoas) || 0)))
  const nome = textoLimpo(clienteNome, 40)
  banco.atualizar('contasMesa', conta.id, (c) => ({
    pessoas: qtd || null,
    clienteNome: nome,
    eventos: c.pessoas !== (qtd || null) ? comEvento(c, `Agora são ${qtd || 'sem número de'} pessoa(s)`, usuario) : c.eventos,
  }))
}

// Pré-conta: o cliente pediu a conta. A mesa fica azul no mapa até pagar.
export function marcarContaPedida(conta, usuario) {
  banco.atualizar('contasMesa', conta.id, (c) => ({ status: 'fechando', contaPedidaEm: agoraIso(), eventos: comEvento(c, 'Pré-conta impressa', usuario) }))
  registrar('mesa.conta-pedida', conta.mesaNome, { usuario, filialId: conta.filialId })
}

export function reabrirConta(conta, usuario) {
  banco.atualizar('contasMesa', conta.id, (c) => ({ status: 'aberta', eventos: comEvento(c, 'Voltou a ficar aberta', usuario) }))
}

export function alterarServico(conta, percentual, usuario) {
  banco.atualizar('contasMesa', conta.id, (c) => ({
    servico: percentual > 0 ? { percentual } : null,
    eventos: comEvento(c, percentual > 0 ? `Taxa de serviço de ${percentual}% cobrada` : 'Taxa de serviço retirada a pedido do cliente', usuario),
  }))
  registrar('mesa.servico', `${conta.mesaNome}: ${percentual > 0 ? `${percentual}% de serviço` : 'sem taxa de serviço'}`, { usuario, filialId: conta.filialId })
}

export function descontoNaConta(conta, desconto, usuario) {
  banco.atualizar('contasMesa', conta.id, (c) => ({ descontoPedido: desconto, eventos: comEvento(c, desconto ? `Desconto: ${desconto.nome}${desconto.autorizadoPor ? `, autorizado por ${desconto.autorizadoPor}` : ''}` : 'Desconto retirado', usuario) }))
  registrar('mesa.desconto', `${conta.mesaNome}: ${desconto ? desconto.nome : 'desconto retirado'}`, { usuario, filialId: conta.filialId })
}

// Separa algumas unidades de um item (para cancelar ou mover só parte).
// Desconto em reais fica com a parte que fica, para não contar duas vezes.
function separar(item, qtd) {
  if (!qtd || qtd >= item.qtd) return [null, item]
  const fica = { ...item, qtd: item.qtd - qtd }
  fica.total = totalItem(fica)
  const parte = { ...item, id: novoId(8), qtd, desconto: item.desconto?.valor ? null : item.desconto }
  parte.total = totalItem(parte)
  return [fica, parte]
}

export function cancelarItemLancado({ pedido, itemId, qtd, motivo, usuario, autorizador }) {
  const em = agoraIso()
  const marca = { motivo, em, por: usuario.nome, autorizadoPor: quemAutorizou(usuario, autorizador) }
  let cancelado = null
  banco.atualizar('pedidosMesa', pedido.id, (p) => {
    const i = p.itens.findIndex((x) => x.id === itemId)
    if (i < 0 || !itemAtivo(p.itens[i])) return {}
    const [fica, parte] = separar(p.itens[i], qtd)
    cancelado = parte
    const itens = [...p.itens]
    itens.splice(i, 1, ...(fica ? [fica] : []), { ...parte, cancelado: marca })
    // Rodada sem mais nada para a cozinha fazer sai da tela da cozinha
    const sobra = itens.some((x) => itemAtivo(x) && x.setor === 'cozinha')
    return { itens, cozinha: p.cozinha && !sobra && p.cozinha.status !== 'entregue' ? { ...p.cozinha, status: 'cancelado' } : p.cozinha }
  })
  if (!cancelado) throw new Error('Este item já saiu da conta.')
  const conta = banco.obter('contasMesa', pedido.contaId)
  const texto = `${cancelado.qtd}× ${cancelado.nome}`
  banco.atualizar('contasMesa', conta.id, (c) => ({
    itensCancelados: [...(c.itensCancelados || []), { produtoId: cancelado.produtoId, nome: cancelado.nome, qtd: cancelado.qtd, precoUnit: cancelado.precoUnit, total: cancelado.total, ...marca }],
    eventos: comEvento(c, `Cancelado: ${texto} (${motivo})`, usuario),
  }))
  registrar('venda.item-cancelado', `${conta.mesaNome}: ${texto} (${motivo})${marca.autorizadoPor ? `, autorizado por ${marca.autorizadoPor}` : ''}`, { usuario, filialId: conta.filialId })
}

// Itens lançados na mesa errada: saem desta conta e entram na outra, sem ir
// de novo para a cozinha. selecao: [{ pedidoId, itemId, qtd }]
export function moverItens({ origem, destino, selecao, usuario }) {
  contaAtual(destino)
  const em = agoraIso()
  const movidos = []
  const porPedido = new Map()
  for (const s of selecao) porPedido.set(s.pedidoId, [...(porPedido.get(s.pedidoId) || []), s])
  for (const [pedidoId, lista] of porPedido) {
    banco.atualizar('pedidosMesa', pedidoId, (p) => {
      const itens = [...p.itens]
      for (const s of lista) {
        const i = itens.findIndex((x) => x.id === s.itemId)
        if (i < 0 || !itemAtivo(itens[i])) continue
        const [fica, parte] = separar(itens[i], s.qtd)
        movidos.push(parte)
        itens.splice(i, 1, ...(fica ? [fica] : []), { ...parte, movido: { para: destino.mesaNome, contaId: destino.id, em, por: usuario.nome } })
      }
      return { itens }
    })
  }
  if (!movidos.length) return
  lancarPedido({ conta: destino, itens: movidos, usuario, movidoDe: origem.mesaNome })
  const texto = movidos.map((i) => `${i.qtd}× ${i.nome}`).join(', ')
  banco.atualizar('contasMesa', origem.id, (c) => ({ eventos: comEvento(c, `Foi para a ${destino.mesaNome}: ${texto}`, usuario) }))
  banco.atualizar('contasMesa', destino.id, (c) => ({ eventos: comEvento(c, `Veio da ${origem.mesaNome}: ${texto}`, usuario) }))
  registrar('mesa.itens-movidos', `${origem.mesaNome} → ${destino.mesaNome}: ${texto}`, { usuario, filialId: origem.filialId })
}

// Os clientes mudaram de mesa: a conta inteira vai junto, para uma mesa livre
export function transferirConta({ conta, mesa, usuario }) {
  contaAtual(conta)
  if (contaDaMesa(banco.lista('contasMesa'), mesa.id)) throw new Error(`A ${mesa.nome} está ocupada. Para somar as contas, use “Juntar mesas”.`)
  banco.atualizar('contasMesa', conta.id, (c) => ({
    mesaId: mesa.id,
    mesaNome: mesa.nome,
    ambienteId: mesa.ambienteId || null,
    ambienteNome: mesa.ambienteNome || '',
    eventos: comEvento(c, `Transferida da ${c.mesaNome} para a ${mesa.nome}`, usuario),
  }))
  registrar('mesa.transferida', `${conta.mesaNome} → ${mesa.nome}`, { usuario, filialId: conta.filialId })
}

// Duas mesas viram uma conta só (o grupo cresceu e juntou as mesas). Tudo da
// origem — rodadas, pagamentos já feitos, cancelamentos — passa para o destino.
export function juntarContas({ origem, destino, usuario }) {
  const o = contaAtual(origem)
  const d = contaAtual(destino)
  if (o.id === d.id) return
  let numero = Math.max(0, ...banco.lista('pedidosMesa').filter((p) => p.contaId === d.id).map((p) => p.numero))
  for (const p of pedidosDaConta(banco.lista('pedidosMesa'), o.id)) banco.atualizar('pedidosMesa', p.id, { contaId: d.id, numero: ++numero, juntadoDe: o.mesaNome })
  banco.atualizar('contasMesa', d.id, (c) => ({
    pessoas: (c.pessoas || 0) + (o.pessoas || 0) || null,
    pagamentos: [...(c.pagamentos || []), ...(o.pagamentos || [])],
    itensCancelados: [...(c.itensCancelados || []), ...(o.itensCancelados || [])],
    descontoPedido: c.descontoPedido || o.descontoPedido || null,
    abertaEm: o.abertaEm < c.abertaEm ? o.abertaEm : c.abertaEm,
    ultimoPedidoEm: [c.ultimoPedidoEm, o.ultimoPedidoEm].filter(Boolean).sort().pop() || null,
    status: 'aberta',
    eventos: comEvento(c, `Juntou com a ${o.mesaNome}`, usuario),
  }))
  banco.atualizar('contasMesa', o.id, (c) => ({ status: 'juntada', juntadaEm: d.id, fechadaEm: agoraIso(), pagamentos: [], itensCancelados: [], eventos: comEvento(c, `Juntada na ${d.mesaNome}`, usuario) }))
  registrar('mesa.juntada', `${o.mesaNome} → ${d.mesaNome}`, { usuario, filialId: d.filialId })
}

// Parte da conta paga antes (alguém foi embora antes). Cada pagamento guarda o
// caixa que recebeu, para o fechamento de caixa bater.
export function receberParte({ conta, pagamentos, usuario, caixaId, pdvId }) {
  contaAtual(conta)
  const em = agoraIso()
  const novos = pagamentos.map((p) => ({ id: novoId(8), formaId: p.formaId, valor: p.valor, troco: p.troco || 0, em, porId: usuario.id, porNome: usuario.nome, caixaId, pdvId }))
  const valor = pago(novos)
  banco.atualizar('contasMesa', conta.id, (c) => ({ pagamentos: [...(c.pagamentos || []), ...novos], eventos: comEvento(c, `Recebido ${reais(valor)} (pagamento parcial)`, usuario) }))
  registrar('mesa.pagamento-parcial', `${conta.mesaNome}: ${reais(valor)}`, { usuario, filialId: conta.filialId })
}

export function desfazerPagamento({ conta, pagamentoId, usuario, autorizador }) {
  const p = contaAtual(conta).pagamentos.find((x) => x.id === pagamentoId)
  if (!p) return
  const valor = reais(p.valor - (p.troco || 0))
  const quem = quemAutorizou(usuario, autorizador)
  banco.atualizar('contasMesa', conta.id, (c) => ({ pagamentos: c.pagamentos.filter((x) => x.id !== pagamentoId), eventos: comEvento(c, `Pagamento de ${valor} desfeito (devolvido ao cliente)${quem ? `, autorizado por ${quem}` : ''}`, usuario) }))
  registrar('mesa.pagamento-desfeito', `${conta.mesaNome}: ${valor}${quem ? `, autorizado por ${quem}` : ''}`, { usuario, filialId: conta.filialId })
}

const dadosDaMesa = (c) => ({ id: c.mesaId, nome: c.mesaNome, ambienteNome: c.ambienteNome, pessoas: c.pessoas, abertaEm: c.abertaEm, garcomId: c.garcomId, garcomNome: c.garcomNome, contaId: c.id })
const paraVenda = (itens) => itens.map(({ pedidoId, pedidoNumero, id, ...i }) => i)

// Fecha a conta: junta os pagamentos parciais com os de agora e grava a venda.
export async function fecharConta({ conta, pagamentos, cpf = '', usuario, pdvId, caixaId }) {
  const atual = contaAtual(conta)
  const totais = totaisConta(atual, pedidosDaConta(banco.lista('pedidosMesa'), atual.id))
  if (!totais.itens.length) throw new Error('A conta não tem itens. Para desocupar a mesa, use “Liberar mesa”.')
  const em = agoraIso()
  const todos = [
    ...(atual.pagamentos || []).map(({ id, porId, porNome, ...p }) => p),
    ...pagamentos.map(({ nome, ...p }) => ({ ...p, em, caixaId, pdvId })),
  ]
  const venda = await finalizarVenda({
    pedido: { itens: paraVenda(totais.itens), descontoPedido: atual.descontoPedido, itensCancelados: atual.itensCancelados || [], tipo: 'mesa', cliente: { nome: atual.clienteNome || '', cpf }, obs: '' },
    pagamentos: todos,
    usuario,
    filialId: atual.filialId,
    pdvId,
    caixaId,
    mesa: dadosDaMesa(atual),
    servico: totais.servico,
  })
  banco.atualizar('contasMesa', atual.id, (c) => ({ status: 'fechada', fechadaEm: venda.criadoEm, vendaId: venda.id, eventos: comEvento(c, `Conta fechada: ${reais(totais.total)}`, usuario) }))
  return venda
}

// Cancela a conta inteira (ou só libera a mesa, se nada foi lançado). O que
// foi lançado fica nos cancelamentos dos relatórios, como no balcão.
export function cancelarConta({ conta, motivo, usuario, autorizador, pdvId, caixaId }) {
  const atual = contaAtual(conta)
  if (atual.pagamentos?.length) throw new Error('Esta conta já tem pagamento. Desfaça os pagamentos (devolvendo o dinheiro ao cliente) antes de cancelar.')
  const pedidos = pedidosDaConta(banco.lista('pedidosMesa'), atual.id)
  const totais = totaisConta(atual, pedidos)
  const vazia = !totais.itens.length && !atual.itensCancelados?.length
  if (vazia) registrar('mesa.liberada', atual.mesaNome, { usuario, filialId: atual.filialId })
  else
    registrarPedidoCancelado({
      pedido: { itens: paraVenda(totais.itens), itensCancelados: atual.itensCancelados || [], tipo: 'mesa' },
      motivo,
      usuario,
      autorizador,
      filialId: atual.filialId,
      pdvId,
      caixaId,
      mesa: dadosDaMesa(atual),
    })
  for (const p of pedidos) if (p.cozinha && !['entregue', 'cancelado'].includes(p.cozinha.status)) banco.atualizar('pedidosMesa', p.id, (x) => ({ cozinha: { ...x.cozinha, status: 'cancelado' } }))
  banco.atualizar('contasMesa', atual.id, (c) => ({ status: 'cancelada', fechadaEm: agoraIso(), motivo: vazia ? 'Mesa liberada' : motivo, eventos: comEvento(c, vazia ? 'Mesa liberada sem consumo' : `Conta cancelada: ${motivo}`, usuario) }))
}

// Rodada no formato da comanda impressa para a cozinha
export const rodadaParaImpressao = (pedido, conta) => ({
  mesa: conta?.mesaNome || 'Mesa',
  ambiente: conta?.ambienteNome || '',
  pedidoNumero: pedido.numero,
  criadoEm: pedido.criadoEm,
  porNome: pedido.porNome,
  pessoas: conta?.pessoas || null,
  itens: pedido.itens.filter(itemAtivo),
  obs: pedido.obs,
})
