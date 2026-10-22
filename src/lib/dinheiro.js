// Dinheiro sempre em centavos (inteiros), como no site da Sua Coxinha.
// Nenhuma conta de preço passa por número quebrado.

const formato = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formatoNumero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// R$ 1.234,56 (com espaço normal, para não quebrar alinhamento em fonte tabular)
export const reais = (centavos = 0) => formato.format((centavos || 0) / 100).replace(/ /g, ' ')

// 1.234,56
export const valor = (centavos = 0) => formatoNumero.format((centavos || 0) / 100)

// Aceita "12,50", "12.50", "1.234,56", "R$ 9,90" e devolve centavos. Texto inválido vira 0.
export function paraCentavos(texto) {
  if (typeof texto === 'number') return Math.round(texto * 100)
  const limpo = String(texto ?? '')
    .replace(/[^\d,.-]/g, '')
    .trim()
  if (!limpo) return 0
  let normalizado = limpo
  if (limpo.includes(',')) normalizado = limpo.replace(/\./g, '').replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0
}

// Digitação estilo maquininha: cada dígito empurra da direita. "1290" → 12,90
export const deDigitos = (digitos) => Number(String(digitos).replace(/\D/g, '').slice(0, 9) || 0)

export const porcentagem = (centavos, pct) => Math.round((centavos * pct) / 100)

export const somar = (lista, campo) => lista.reduce((t, x) => t + (campo ? x[campo] || 0 : x || 0), 0)

export const quantidade = (q) =>
  Number.isInteger(q) ? String(q) : q.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
