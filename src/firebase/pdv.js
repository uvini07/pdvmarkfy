// Login do PDV. Tudo passa pelas funções pdv* do servidor (no repositório
// sua-coxinha-app, functions/pdv/): o navegador nunca vê hash de PIN e não
// decide quem entra.

import { useSyncExternalStore } from 'react'
import { GoogleAuthProvider, onAuthStateChanged, signInWithCustomToken, signInWithPopup, signOut } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { authComputador, authPessoa, funcoesComputador, funcoesPessoa } from './app.js'
import { entrarComToken, iniciarEntrada, terminarEntrada } from '../estado/rede.js'
import { conferirCredencial, criarCredencial } from '../lib/seguranca.js'

export const SEM_CONEXAO = 'Sem conexão com o servidor. Confira a internet e tente de novo.'

export class ErroPdv extends Error {
  constructor(mensagem, { codigo = '', motivo = '', erros = null } = {}) {
    super(mensagem)
    Object.assign(this, { codigo, motivo, erros })
  }
}

const MENSAGENS_AUTH = {
  'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
  'auth/cancelled-popup-request': 'A janela do Google foi fechada antes de concluir.',
  'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere as janelas (pop-ups) para este site.',
  'auth/unauthorized-domain': 'Este endereço não está liberado no Firebase (Authentication → Configurações → Domínios autorizados).',
  'auth/network-request-failed': SEM_CONEXAO,
}

function traduzir(erro) {
  if (erro instanceof ErroPdv) return erro
  if (MENSAGENS_AUTH[erro?.code]) return new ErroPdv(MENSAGENS_AUTH[erro.code], { codigo: erro.code })
  // Erro do próprio PDV (ex.: a ficha não chegou a tempo): a mensagem já serve.
  if (!erro?.code && erro?.message && navigator.onLine) return new ErroPdv(erro.message, { codigo: 'interno' })
  const codigo = String(erro?.code || '').replace(/^functions\//, '')
  if (['unavailable', 'deadline-exceeded'].includes(codigo) || !navigator.onLine) return new ErroPdv(SEM_CONEXAO, { codigo: 'sem-conexao' })
  if (codigo === 'internal' || !codigo) return new ErroPdv('Não foi possível entrar agora. Tente de novo em instantes; se continuar, avise o suporte.', { codigo: 'interno' })
  // O SDK das funções põe o status HTTP no fim da mensagem ("… [429]")
  const mensagem = String(erro.message).replace(/\s*\[\d{3}\]$/, '')
  return new ErroPdv(mensagem, { codigo, motivo: erro.details?.motivo || '', erros: erro.details?.erros || null })
}

async function chamar(nome, dados = {}, { computador = false } = {}) {
  try {
    const r = await httpsCallable(computador ? funcoesComputador : funcoesPessoa, nome)(dados)
    return r.data
  } catch (erro) {
    throw traduzir(erro)
  }
}

// --- O computador ------------------------------------------------------------------

let computador = { carregando: true, terminal: null }
const ouvintesComputador = new Set()

onAuthStateChanged(authComputador, async (u) => {
  let terminal = null
  if (u) {
    try {
      const { claims } = await u.getIdTokenResult()
      if (claims.pdv === 't') terminal = { id: claims.terminal, filialId: claims.filial }
    } catch {
      // Sem internet: o computador continua liberado; o servidor confere no próximo login.
      terminal = { id: u.uid.replace(/^pdvt_/, ''), filialId: null }
    }
  }
  computador = { carregando: false, terminal }
  ouvintesComputador.forEach((fn) => fn())
})

export function useComputador() {
  return useSyncExternalStore(
    (fn) => (ouvintesComputador.add(fn), () => ouvintesComputador.delete(fn)),
    () => computador,
  )
}

export async function liberarComputador({ filialId, pdvId, nome }) {
  const r = await chamar('pdvParear', { filialId, pdvId, nome })
  try {
    await signInWithCustomToken(authComputador, r.token)
  } catch (erro) {
    throw traduzir(erro)
  }
  return r.terminal
}

export const esquecerComputador = () => signOut(authComputador)

export async function listarOperadores() {
  try {
    return await chamar('pdvOperadores', {}, { computador: true })
  } catch (erro) {
    // Desligado pela retaguarda: o computador volta a pedir liberação.
    if (['terminal-inativo', 'sem-terminal'].includes(erro.motivo)) await esquecerComputador()
    throw erro
  }
}

// --- A pessoa ---------------------------------------------------------------------

// Destrava a tela se a internet cair no meio do turno. Fica só na memória
// (some ao recarregar ou sair) e aceita poucas tentativas: sem o servidor
// não há bloqueio de verdade, então ao passar do limite espera a internet.
let verificador = null
const TENTATIVAS_SEM_INTERNET = 5

export async function entrarComGoogle() {
  const provedor = new GoogleAuthProvider()
  provedor.setCustomParameters({ prompt: 'select_account' })
  iniciarEntrada()
  let comGoogle = false
  try {
    await signInWithPopup(authPessoa, provedor)
    comGoogle = true
    const r = await chamar('pdvEntrarGoogle')
    await entrarComToken(r.token, r.usuario.id)
    verificador = null
    return r.usuario
  } catch (erro) {
    // Fechou a janela do Google: quem já estava logado continua. Entrou no
    // Google mas o PDV recusou: a conta Google não fica aberta aqui.
    if (comGoogle) await signOut(authPessoa).catch(() => {})
    throw traduzir(erro)
  } finally {
    terminarEntrada()
  }
}

export async function entrarComPin({ usuarioId, pin, modo }) {
  const r = await chamar('pdvEntrarPin', { usuarioId, pin, modo }, { computador: true })
  try {
    await entrarComToken(r.token, usuarioId)
  } catch (erro) {
    await signOut(authPessoa).catch(() => {})
    throw traduzir(erro)
  } finally {
    terminarEntrada()
  }
  verificador = { usuarioId, credencial: await criarCredencial(pin), erros: 0 }
  return r
}

export async function conferirPin(usuarioId, pin) {
  try {
    await chamar('pdvConferirPin', { pin })
    if (verificador?.usuarioId === usuarioId) verificador.erros = 0
    return { ok: true }
  } catch (erro) {
    if (erro.codigo !== 'sem-conexao' || verificador?.usuarioId !== usuarioId) return { ok: false, erro: erro.message, motivo: erro.motivo }
    if (verificador.erros >= TENTATIVAS_SEM_INTERNET) return { ok: false, erro: 'Muitas tentativas sem internet. A tela destrava quando a conexão voltar.' }
    if (await conferirCredencial(pin, verificador.credencial)) return { ok: true, semInternet: true }
    verificador.erros++
    return { ok: false, erro: 'PIN não confere.' }
  }
}

export async function sairDaPessoa() {
  verificador = null
  await signOut(authPessoa).catch(() => {})
}

// --- Retaguarda ---------------------------------------------------------------------

export const listarSupervisores = (permissao, filialId) => chamar('pdvSupervisores', { permissao, filialId })
export const autorizar = (dados) => chamar('pdvAutorizar', dados)
export const listarUsuarios = () => chamar('pdvUsuarios')
export const salvarUsuario = (dados) => chamar('pdvSalvarUsuario', dados)
export const desbloquearUsuario = (id) => chamar('pdvDesbloquearUsuario', { id })
export const salvarPerfil = (dados) => chamar('pdvSalvarPerfil', dados)
export const removerPerfil = (id) => chamar('pdvRemoverPerfil', { id })
export const listarComputadores = () => chamar('pdvTerminais')
export const desligarComputador = (id) => chamar('pdvDesativarTerminal', { id })
export const listarAcessos = () => chamar('pdvAcessos')
