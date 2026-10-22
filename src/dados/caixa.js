// Sessão de caixa: abertura com fundo de troco, sangrias e suprimentos,
// fechamento cego (o operador informa o que contou sem ver o esperado) e
// conferência pela retaguarda.

import { banco } from './banco.js'
import { registrar } from './auditoria.js'
import { reais } from '../lib/dinheiro.js'

export const caixaAbertoDoPdv = (caixas, pdvId) => caixas.find((c) => c.pdvId === pdvId && c.status === 'aberto')

export function abrirCaixa({ pdvId, filialId, usuario, fundo }) {
  if (caixaAbertoDoPdv(banco.lista('caixas'), pdvId)) throw new Error('Este ponto de venda já tem um caixa aberto.')
  const caixa = banco.inserir('caixas', {
    pdvId,
    filialId,
    operadorId: usuario.id,
    operadorNome: usuario.nome,
    abertoEm: new Date().toISOString(),
    fundo,
    movimentos: [],
    status: 'aberto',
  })
  registrar('caixa.aberto', `Fundo de troco ${reais(fundo)}`, { usuario, filialId })
  return caixa
}

export function movimentarCaixa(caixaId, { tipo, valor, motivo, usuario, autorizador }) {
  const caixa = banco.obter('caixas', caixaId)
  if (!caixa || caixa.status !== 'aberto') throw new Error('O caixa não está aberto.')
  const mov = { id: `${Date.now()}`, tipo, valor, motivo, em: new Date().toISOString(), usuarioId: usuario.id, usuarioNome: usuario.nome, autorizadorNome: autorizador?.nome || null }
  banco.atualizar('caixas', caixaId, { movimentos: [...caixa.movimentos, mov] })
  registrar(tipo === 'sangria' ? 'caixa.sangria' : 'caixa.suprimento', `${reais(valor)}${motivo ? `: ${motivo}` : ''}`, { usuario, filialId: caixa.filialId })
}

// O que deveria haver no caixa, por forma de pagamento. Conta-se cada
// pagamento no caixa que o recebeu: a parte de uma conta de mesa paga aqui e
// fechada em outro caixa entra aqui.
export function resumoCaixa(caixa, vendas, formas) {
  const doCaixa = vendas.filter((v) => v.caixaId === caixa.id)
  const concluidas = doCaixa.filter((v) => v.status === 'concluida')
  const dinheiro = formas.find((f) => f.tipo === 'dinheiro')
  const porForma = Object.fromEntries(formas.map((f) => [f.id, 0]))
  for (const v of vendas) {
    if (v.status !== 'concluida') continue
    for (const p of v.pagamentos) if ((p.caixaId || v.caixaId) === caixa.id) porForma[p.formaId] = (porForma[p.formaId] || 0) + p.valor - (p.troco || 0)
  }

  const sangrias = caixa.movimentos.filter((m) => m.tipo === 'sangria').reduce((t, m) => t + m.valor, 0)
  const suprimentos = caixa.movimentos.filter((m) => m.tipo === 'suprimento').reduce((t, m) => t + m.valor, 0)
  const esperado = { ...porForma }
  if (dinheiro) esperado[dinheiro.id] = (esperado[dinheiro.id] || 0) + caixa.fundo + suprimentos - sangrias

  return {
    vendas: concluidas.length,
    vendido: concluidas.reduce((t, v) => t + v.total, 0),
    canceladas: doCaixa.filter((v) => v.status !== 'concluida').length,
    valorCancelado: doCaixa.filter((v) => v.status !== 'concluida').reduce((t, v) => t + v.total, 0),
    descontos: concluidas.reduce((t, v) => t + (v.descontos || 0), 0),
    servico: concluidas.reduce((t, v) => t + (v.servico || 0), 0),
    porForma,
    sangrias,
    suprimentos,
    esperado,
    totalEsperado: Object.values(esperado).reduce((t, x) => t + x, 0),
  }
}

export function fecharCaixa(caixaId, { contado, obs, usuario }) {
  const caixa = banco.obter('caixas', caixaId)
  if (!caixa || caixa.status !== 'aberto') throw new Error('O caixa não está aberto.')
  const resumo = resumoCaixa(caixa, banco.lista('vendas'), banco.lista('formasPagamento'))
  const totalContado = Object.values(contado).reduce((t, x) => t + x, 0)
  const diferenca = totalContado - resumo.totalEsperado
  const fechado = banco.atualizar('caixas', caixaId, {
    status: 'fechado',
    fechadoEm: new Date().toISOString(),
    fechadoPor: usuario.nome,
    contado,
    esperado: resumo.esperado,
    vendido: resumo.vendido,
    diferenca,
    obs,
  })
  registrar('caixa.fechado', `Vendido ${reais(resumo.vendido)}, diferença ${reais(diferenca)}`, { usuario, filialId: caixa.filialId })
  return fechado
}

export function conferirCaixa(caixaId, { usuario, obs }) {
  const caixa = banco.obter('caixas', caixaId)
  banco.atualizar('caixas', caixaId, { status: 'conferido', conferidoEm: new Date().toISOString(), conferidoPor: usuario.nome, obsConferencia: obs || '' })
  registrar('caixa.conferido', `Caixa de ${caixa.operadorNome}, diferença ${reais(caixa.diferenca || 0)}`, { usuario, filialId: caixa.filialId })
}
