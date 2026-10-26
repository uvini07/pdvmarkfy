// Quem está logado, segundo o servidor. As funções do login gravam em
// pdv_sessoes/{uid} quem é cada login do Firebase (depois do PIN ou do
// Google); a ficha (pdv_usuarios) e os perfis vêm do Firestore ao vivo —
// desativar alguém, sair ou mudar o perfil vale na hora, em todas as abas e
// computadores.

import { useSyncExternalStore } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDocFromServer, onSnapshot } from 'firebase/firestore'
import { authPessoa, db } from '../firebase/app.js'

// `vinculo`: o que a sessão do servidor diz deste login ({ usuario, ate, modo }).
let estado = { carregando: true, vinculo: null, eu: null, perfis: [] }
const ouvintes = new Set()
const mudar = (parcial) => {
  estado = { ...estado, ...parcial }
  ouvintes.forEach((fn) => fn())
}

// Entre o login (Google ou anônimo) e a sessão do PDV a pessoa fica um
// instante "sem ninguém".
// Enquanto uma entrada está em andamento, isso conta como carregando — senão a
// tela bloqueada, ao destravar com o Google, derrubaria a sessão no meio.
let entrando = false
export function iniciarEntrada() {
  entrando = true
  mudar({ carregando: true })
}
export function terminarEntrada() {
  entrando = false
  if (!estado.vinculo) mudar({ carregando: false })
}

const parar = (lista) => lista.splice(0).forEach((fn) => fn())

// Logo depois de trocar de login, o Firestore ainda pode usar a credencial
// anterior por um instante: a leitura é recusada e o ouvinte morre. Então
// tenta de novo algumas vezes antes de concluir que foi recusa de verdade.
//
// Com internet, resposta só do cache é ignorada: o cache pode trazer uma
// sessão que já foi encerrada no servidor (ex.: entrar de novo na mesma aba).
// Sem internet, o cache é o que há — e vale.
export function ouvirComNovaTentativa(lista, ref, aoMudar, aoFalhar, valendo = () => true, tentativa = 0) {
  let pararEste = null
  const pararTudo = () => pararEste?.()
  lista.push(pararTudo)
  const filtrar = (s) => (s.metadata.fromCache && navigator.onLine ? null : aoMudar(s))
  pararEste = onSnapshot(ref, { includeMetadataChanges: true }, filtrar, (erro) => {
    if (!valendo() || !lista.includes(pararTudo)) return
    if (tentativa < 3) {
      const espera = setTimeout(() => {
        if (!valendo() || !lista.includes(pararTudo)) return
        lista.splice(lista.indexOf(pararTudo), 1)
        ouvirComNovaTentativa(lista, ref, aoMudar, aoFalhar, valendo, tentativa + 1)
      }, 400 * (tentativa + 1))
      pararEste = () => clearTimeout(espera)
      return
    }
    aoFalhar(erro)
  })
}
const daSessao = []
const daFicha = []
let pessoaAtual = null
let versao = 0

function semNinguem() {
  parar(daFicha)
  pessoaAtual = null
  mudar({ carregando: entrando, vinculo: null, eu: null, perfis: [] })
}

// A ficha e os perfis de quem a sessão diz que é.
function acompanharPessoa(usuarioId) {
  parar(daFicha)
  pessoaAtual = usuarioId
  mudar({ carregando: true, eu: null })
  let euPronto = false
  let perfisProntos = false
  const conferir = () => euPronto && perfisProntos && mudar({ carregando: false })
  const valendo = () => pessoaAtual === usuarioId
  ouvirComNovaTentativa(
    daFicha,
    doc(db, 'pdv_usuarios', usuarioId),
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
    valendo,
  )
  ouvirComNovaTentativa(
    daFicha,
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
    valendo,
  )
}

// Logo depois de trocar de login, o Firestore reorganiza o cache para o login
// novo; um ouvinte aberto nesse instante pode nunca receber nada. Uma leitura
// direta no servidor só volta depois dessa troca — então ela vem primeiro.
// (Sem internet ela falha na hora, e o ouvinte segue com o cache.)
export const depoisDaTroca = (ref) => getDocFromServer(ref).catch(() => null)

async function seguirLogin(login) {
  const minha = ++versao
  parar(daSessao)
  if (!login) return semNinguem()
  mudar({ carregando: true })
  const valendo = () => minha === versao
  await depoisDaTroca(doc(db, 'pdv_sessoes', login.uid))
  if (!valendo()) return
  ouvirComNovaTentativa(
    daSessao,
    doc(db, 'pdv_sessoes', login.uid),
    (s) => {
      if (!valendo()) return
      const v = s.exists() ? s.data() : null
      // Sem sessão do PDV (ninguém entrou ainda, ou o Google no meio do login)
      if (v?.tipo !== 'u') return semNinguem()
      mudar({ vinculo: { usuario: v.usuario, ate: v.ate?.toMillis?.() || 0, modo: v.modo || null } })
      if (pessoaAtual !== v.usuario) acompanharPessoa(v.usuario)
    },
    () => valendo() && semNinguem(),
    valendo,
  )
}

onAuthStateChanged(authPessoa, seguirLogin)

export const rede = { obter: () => estado }

export function useRede() {
  return useSyncExternalStore(
    (fn) => (ouvintes.add(fn), () => ouvintes.delete(fn)),
    () => estado,
  )
}

// Espera a sessão que a função acabou de gravar chegar e a ficha da pessoa
// carregar: assim a tela nunca vê "sessão aberta, mas sem ninguém" e não
// derruba a entrada por engano. Quem chama encerra a entrada (terminarEntrada).
export function esperarPessoa(usuarioId) {
  return new Promise((resolve, reject) => {
    const parar = () => (clearTimeout(limite), ouvintes.delete(ver))
    const limite = setTimeout(() => (parar(), reject(new Error('O servidor demorou para responder. Tente de novo.'))), 20_000)
    const ver = () => {
      if (estado.carregando || estado.vinculo?.usuario !== usuarioId) return
      parar()
      estado.eu ? resolve() : reject(new Error('Seu acesso ao PDV foi desativado.'))
    }
    ouvintes.add(ver)
    ver()
  })
}
