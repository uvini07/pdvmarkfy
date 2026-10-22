// Datas no fuso da loja (o do navegador). O "dia" de uma venda é a data local
// AAAA-MM-DD, que é o que o caixa e os relatórios entendem como "hoje".

const doisDigitos = (n) => String(n).padStart(2, '0')

export const diaDe = (data = new Date()) => {
  const d = new Date(data)
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`
}

export const hoje = () => diaDe(new Date())

export const deDia = (dia) => {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export const somarDias = (dia, n) => {
  const d = deDia(dia)
  d.setDate(d.getDate() + n)
  return diaDe(d)
}

export const diasEntre = (inicio, fim) => Math.round((deDia(fim) - deDia(inicio)) / 86400000)

export const listaDias = (inicio, fim) => {
  const dias = []
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d)
  return dias
}

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtDataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const fmtDiaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const fmtExtenso = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

export const data = (v) => (v ? fmtData.format(typeof v === 'string' && v.length === 10 ? deDia(v) : new Date(v)) : '')
export const dataCurta = (v) => (v ? fmtDataCurta.format(typeof v === 'string' && v.length === 10 ? deDia(v) : new Date(v)) : '')
export const hora = (v) => (v ? fmtHora.format(new Date(v)) : '')
export const dataHora = (v) => (v ? `${data(v)} ${hora(v)}` : '')
export const diaSemana = (v) => fmtDiaSemana.format(typeof v === 'string' ? deDia(v) : new Date(v)).replace('.', '')
export const extenso = (v = new Date()) => fmtExtenso.format(new Date(v))

// "há 3 min", usado na cozinha e nos pedidos do dia
export function decorrido(desde, agora = Date.now()) {
  const min = Math.max(0, Math.floor((agora - new Date(desde)) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h}h${doisDigitos(min % 60)}`
}

// "agora" ou "há 5 min", para frases como "ocupada há 5 min"
export function ha(desde, agora = Date.now()) {
  const d = decorrido(desde, agora)
  return d === 'agora' ? 'agora' : `há ${d}`
}

export const minutosDesde = (desde, agora = Date.now()) => (agora - new Date(desde)) / 60000
