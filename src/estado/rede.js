// Quem está logado, segundo o servidor. O token da pessoa (emitido pelas
// funções do login) diz o id dela; a ficha (pdv_usuarios) e os perfis vêm do
// Firestore ao vivo — desativar alguém ou mudar o perfil vale na hora, em
// todas as abas e computadores.

import { useSyncExternalStore } from 'react'
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { authPessoa, db } from '../firebase/app.js'

let estado = { carregando: true, claims: null, eu: null, perfis: [] }
const ouvintes = new Set()
const mudar = (parcial) => {
  estado = { ...estado, ...parcial }
  ouvintes.forEach((fn) => fn())
}

// Lê as claims do token. Sem internet e com o token vencido, o Firebase não
// renova — mas o token guardado ainda diz quem é a pessoa, e é só isso que a
// tela precisa (o prazo da sessão é o `ate`, conferido à parte).
async function lerClaims(usuario) {
  try {
    return (await usuario.getIdTokenResult()).claims
  } catch {
    try {
      return JSON.parse(atob(usuario.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    } catch {
      return null
    }
  }
}

// Entre o Google e o token do PDV a pessoa fica um instante "sem ninguém".
// Enquanto uma entrada está em andamento, isso conta como carregando — senão a
// tela bloqueada, ao destravar com o Google, derrubaria a sessão no meio.
let entrando = false
export function iniciarEntrada() {
  entrando = true
  mudar({ carregando: true })
}
export function terminarEntrada() {
  entrando = false
  if (!estado.claims) mudar({ carregando: false })
}

let parar = []
let versao = 0
onAuthStateChanged(authPessoa, async (usuario) => {
  // Ler as claims é assíncrono: se a identidade mudou de novo nesse meio
  // tempo, só a mais recente vale.
  const minha = ++versao
  const claims = usuario ? await lerClaims(usuario) : null
  if (minha !== versao) return
  parar.forEach((fn) => fn())
  parar = []
  // Sem token do PDV (ninguém logado, ou o Google no meio do login): vazio.
  if (claims?.pdv !== 'u') return mudar({ carregando: entrando, claims: null, eu: null, perfis: [] })

  mudar({ carregando: true, claims, eu: null })
  let euPronto = false
  let perfisProntos = false
  const conferir = () => euPronto && perfisProntos && mudar({ carregando: false })
  parar.push(
    onSnapshot(
      doc(db, 'pdv_usuarios', claims.usuario),
      (s) => {
        euPronto = true
        mudar({ eu: s.exists() ? { id: s.id, ...s.data() } : null })
        conferir()
      },
      // Recusado pelas regras: a pessoa foi desativada ou a sessão venceu.
      () => {
        euPronto = true
        mudar({ eu: null })
        conferir()
      },
    ),
    onSnapshot(
      collection(db, 'pdv_perfis'),
      (s) => {
        perfisProntos = true
        mudar({ perfis: s.docs.map((d) => ({ id: d.id, ...d.data() })) })
        conferir()
      },
      () => {
        perfisProntos = true
        conferir()
      },
    ),
  )
})

export const rede = { obter: () => estado }

export function useRede() {
  return useSyncExternalStore(
    (fn) => (ouvintes.add(fn), () => ouvintes.delete(fn)),
    () => estado,
  )
}

// Entra com o token do servidor e só volta quando a ficha da pessoa chegou:
// assim a tela nunca vê "sessão aberta, mas sem ninguém" e não derruba a
// entrada por engano. Quem chama encerra a entrada (terminarEntrada).
export async function entrarComToken(token, usuarioId) {
  iniciarEntrada()
  await signInWithCustomToken(authPessoa, token)
  await new Promise((resolve, reject) => {
    const limite = setTimeout(() => (ouvintes.delete(ver), reject(new Error('O servidor demorou para responder. Tente de novo.'))), 15_000)
    const ver = () => {
      if (estado.carregando || estado.claims?.usuario !== usuarioId) return
      clearTimeout(limite)
      ouvintes.delete(ver)
      estado.eu ? resolve() : reject(new Error('Seu acesso ao PDV foi desativado.'))
    }
    ouvintes.add(ver)
    ver()
  })
}
