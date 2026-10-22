// Preço de venda por filial (com o preço base como padrão), produto esgotado
// por filial e promoções automáticas (por dia da semana, horário e período).

import { diaDe } from '../lib/datas.js'
import { porcentagem } from '../lib/dinheiro.js'

export const precoNaFilial = (produto, filialId) => produto.precos?.[filialId] ?? produto.preco

export const estaPausado = (produto, filialId) => Boolean(produto.pausado?.[filialId])

const minutos = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : null
}

export function promocaoValida(promo, filialId, quando = new Date()) {
  if (!promo.ativo) return false
  if (promo.filiais?.length && !promo.filiais.includes(filialId)) return false
  const dia = diaDe(quando)
  if (promo.inicio && dia < promo.inicio) return false
  if (promo.fim && dia > promo.fim) return false
  if (promo.dias?.length && !promo.dias.includes(quando.getDay())) return false
  const ini = minutos(promo.horaInicio)
  const fim = minutos(promo.horaFim)
  const agora = quando.getHours() * 60 + quando.getMinutes()
  if (ini !== null && agora < ini) return false
  if (fim !== null && agora >= fim) return false
  return true
}

export const promocaoAlcanca = (promo, produto) =>
  promo.produtos?.includes(produto.id) || promo.grupos?.includes(produto.grupoId)

export function descontoDaPromocao(promo, valorUnitario) {
  if (!promo) return 0
  const d = promo.tipo === 'valor' ? promo.valor : porcentagem(valorUnitario, promo.valor)
  return Math.max(0, Math.min(d, valorUnitario))
}

// A melhor promoção válida para o produto agora (a que dá mais desconto).
export function melhorPromocao(produto, promocoes, filialId, valorUnitario, quando = new Date()) {
  if (!produto.config?.permiteDesconto) return null
  let melhor = null
  let maior = 0
  for (const p of promocoes) {
    if (!promocaoAlcanca(p, produto) || !promocaoValida(p, filialId, quando)) continue
    const d = descontoDaPromocao(p, valorUnitario)
    if (d > maior) {
      maior = d
      melhor = p
    }
  }
  return melhor ? { id: melhor.id, nome: melhor.nome, desconto: maior } : null
}

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
