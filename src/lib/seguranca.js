// Credenciais do PDV. Senha e PIN nunca são guardados: só o hash PBKDF2-SHA256
// com sal aleatório por usuário, pela Web Crypto do navegador.
// Quando houver servidor, esta mesma conferência passa para lá (ver SEGURANCA.md).

const ITERACOES = 210_000
const codificador = new TextEncoder()

const paraBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const deBase64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))

export function gerarSal() {
  return paraBase64(crypto.getRandomValues(new Uint8Array(16)))
}

async function derivar(segredo, sal, iteracoes) {
  const chave = await crypto.subtle.importKey('raw', codificador.encode(segredo), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: deBase64(sal), iterations: iteracoes },
    chave,
    256,
  )
  return paraBase64(bits)
}

export async function criarCredencial(segredo) {
  const sal = gerarSal()
  return { hash: await derivar(segredo, sal, ITERACOES), sal, iteracoes: ITERACOES }
}

// Comparação em tempo constante: não revela, pelo tempo de resposta, quantos
// caracteres do hash bateram.
function iguais(a, b) {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

export async function conferirCredencial(segredo, credencial) {
  if (!credencial?.hash || !credencial?.sal) return false
  const hash = await derivar(segredo, credencial.sal, credencial.iteracoes || ITERACOES)
  return iguais(hash, credencial.hash)
}

export async function sha256(texto) {
  const bits = await crypto.subtle.digest('SHA-256', codificador.encode(texto))
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const ALFABETO = '0123456789abcdefghijklmnopqrstuvwxyz'
export function novoId(tamanho = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho))
  return [...bytes].map((b) => ALFABETO[b % 36]).join('')
}

// PIN do caixa: 4 a 6 dígitos, sem sequência nem repetição (1234, 0000, 9876…).
export function problemaNoPin(pin) {
  const p = String(pin ?? '')
  if (!/^\d{4,6}$/.test(p)) return 'O PIN precisa ter de 4 a 6 números.'
  if (/^(\d)\1+$/.test(p)) return 'O PIN não pode repetir o mesmo número.'
  const crescente = '01234567890'
  const decrescente = '09876543210'
  if (crescente.includes(p) || decrescente.includes(p)) return 'O PIN não pode ser uma sequência.'
  return null
}

// Senha da retaguarda: pelo menos 8 caracteres, com letra e número.
export function problemaNaSenha(senha, nome = '') {
  const s = String(senha ?? '')
  if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return 'Use letras e números na senha.'
  const comuns = ['12345678', 'senha123', 'password1', 'coxinha1', 'suacoxinha1', 'abc12345']
  if (comuns.includes(s.toLowerCase())) return 'Essa senha é fácil de adivinhar. Escolha outra.'
  if (nome && s.toLowerCase().includes(nome.toLowerCase().split(' ')[0]) && nome.length > 2)
    return 'A senha não pode conter o seu nome.'
  return null
}

// Bloqueio progressivo depois de tentativas erradas: 5 erros = 1 min, 6 = 2 min,
// 7 = 4 min… até 30 min. Vale para PIN e senha.
export function tempoDeBloqueio(tentativas) {
  if (tentativas < 5) return 0
  return Math.min(30, 2 ** (tentativas - 5)) * 60_000
}
