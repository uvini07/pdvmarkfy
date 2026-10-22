// Validação e máscaras de documentos. CPF de cliente é dado pessoal (LGPD):
// nas listas e no cupom ele aparece mascarado; inteiro só para quem tem permissão.

export const digitos = (v) => String(v ?? '').replace(/\D/g, '')

export function cpfValido(cpf) {
  const d = digitos(cpf)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (fim) => {
    let soma = 0
    for (let i = 0; i < fim; i++) soma += Number(d[i]) * (fim + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function cnpjValido(cnpj) {
  const d = digitos(cnpj)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (tam) => {
    const pesos = tam === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = pesos.reduce((t, p, i) => t + p * Number(d[i]), 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

export const formatarCpf = (v) => {
  const d = digitos(v).slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export const formatarCnpj = (v) => {
  const d = digitos(v).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export const formatarTelefone = (v) => {
  const d = digitos(v).slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

// ***.456.789-** — o padrão usado pelo governo para exibir CPF parcialmente
export const mascararCpf = (v) => {
  const d = digitos(v)
  if (d.length !== 11) return ''
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}

export const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim())

// Texto livre digitado no caixa ou nos cadastros: tira caracteres de controle e limita o tamanho.
export const textoLimpo = (v, max = 200) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
