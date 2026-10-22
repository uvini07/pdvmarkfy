// Usuários e credenciais. PIN (caixa) e senha (retaguarda) ficam só como hash.
// Erros seguidos bloqueiam o usuário por um tempo crescente.

import { banco } from './banco.js'
import { registrar } from './auditoria.js'
import { pode } from './permissoes.js'
import { criarCredencial, conferirCredencial, problemaNoPin, problemaNaSenha, tempoDeBloqueio } from '../lib/seguranca.js'
import { textoLimpo } from '../lib/validacao.js'

export const MSG_ERRO_ACESSO = 'PIN ou senha não conferem.'

function bloqueadoAte(usuario) {
  return usuario.bloqueadoAte && new Date(usuario.bloqueadoAte) > new Date() ? new Date(usuario.bloqueadoAte) : null
}

export function mensagemBloqueio(usuario) {
  const ate = bloqueadoAte(usuario)
  if (!ate) return null
  const min = Math.ceil((ate - new Date()) / 60000)
  return `Muitas tentativas erradas. Tente de novo em ${min} min ou peça a um gerente.`
}

async function falhou(usuario, contexto) {
  const tentativas = (usuario.tentativas || 0) + 1
  const espera = tempoDeBloqueio(tentativas)
  banco.atualizar('usuarios', usuario.id, {
    tentativas,
    bloqueadoAte: espera ? new Date(Date.now() + espera).toISOString() : null,
  })
  registrar('acesso.falhou', `${usuario.nome} (${contexto}), tentativa ${tentativas}`, { usuario })
  if (espera) registrar('acesso.bloqueado', `${usuario.nome} bloqueado por ${espera / 60000} min`, { usuario })
}

async function conferir(usuario, segredo, tipo) {
  if (!usuario || !usuario.ativo) return { ok: false, erro: MSG_ERRO_ACESSO }
  const bloqueio = mensagemBloqueio(usuario)
  if (bloqueio) return { ok: false, erro: bloqueio }
  const ok = await conferirCredencial(segredo, usuario[tipo])
  if (!ok) {
    await falhou(usuario, tipo === 'pin' ? 'PIN' : 'senha')
    const atualizado = banco.obter('usuarios', usuario.id)
    return { ok: false, erro: mensagemBloqueio(atualizado) || MSG_ERRO_ACESSO }
  }
  if (usuario.tentativas) banco.atualizar('usuarios', usuario.id, { tentativas: 0, bloqueadoAte: null })
  return { ok: true, usuario: banco.obter('usuarios', usuario.id) }
}

export const conferirPin = (usuarioId, pin) => conferir(banco.obter('usuarios', usuarioId), pin, 'pin')

export function conferirSenha(login, senha) {
  const usuario = banco.lista('usuarios').find((u) => u.login === String(login).trim().toLowerCase())
  // Sem usuário, a resposta é a mesma de senha errada: não revela quais logins existem.
  if (!usuario) return new Promise((r) => setTimeout(() => r({ ok: false, erro: MSG_ERRO_ACESSO }), 400))
  if (!usuario.senha) return Promise.resolve({ ok: false, erro: 'Este usuário só entra no caixa, com PIN.' })
  return conferir(usuario, senha, 'senha')
}

// Autorização de supervisor: outro usuário com a permissão digita o PIN.
export async function autorizar(usuarioId, pin, permissao, contexto) {
  const usuario = banco.obter('usuarios', usuarioId)
  const r = await conferirPin(usuarioId, pin)
  if (!r.ok) return r
  if (!pode(r.usuario, banco.lista('perfis'), permissao)) {
    registrar('autorizacao.negada', `${usuario.nome} não tem permissão para: ${contexto}`, { usuario })
    return { ok: false, erro: `${usuario.nome} não tem permissão para autorizar isso.` }
  }
  registrar('autorizacao.concedida', contexto, { usuario: r.usuario })
  return r
}

export function validarUsuario(dados, { novo, usuarios }) {
  const erros = {}
  if (!textoLimpo(dados.nome, 60)) erros.nome = 'Informe o nome.'
  const login = String(dados.login || '').trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,30}$/.test(login)) erros.login = 'Use de 3 a 30 letras, números, ponto ou traço, sem espaço.'
  else if (usuarios.some((u) => u.login === login && u.id !== dados.id)) erros.login = 'Já existe um usuário com este login.'
  if (!dados.perfilId) erros.perfilId = 'Escolha o perfil.'
  if (!dados.todasFiliais && !dados.filiais?.length) erros.filiais = 'Escolha ao menos uma filial.'
  if (novo || dados.pin) {
    const p = problemaNoPin(dados.pin)
    if (p) erros.pin = p
  }
  if (dados.senha) {
    const s = problemaNaSenha(dados.senha, dados.nome)
    if (s) erros.senha = s
  }
  return erros
}

export async function salvarUsuario(dados, autor) {
  const base = {
    nome: textoLimpo(dados.nome, 60),
    login: String(dados.login).trim().toLowerCase(),
    perfilId: dados.perfilId,
    todasFiliais: Boolean(dados.todasFiliais),
    filiais: dados.todasFiliais ? [] : dados.filiais,
    ativo: dados.ativo !== false,
  }
  if (dados.pin) {
    base.pin = await criarCredencial(dados.pin)
    // Só o tamanho, para o teclado confirmar sozinho ao completar o PIN
    base.pinDigitos = String(dados.pin).length
  }
  if (dados.senha) base.senha = await criarCredencial(dados.senha)
  if (dados.removerSenha) base.senha = null

  if (dados.id) {
    const u = banco.atualizar('usuarios', dados.id, { ...base, ...(dados.pin || dados.senha ? { tentativas: 0, bloqueadoAte: null } : {}) })
    registrar('usuario.alterado', u.nome, { usuario: autor })
    if (dados.pin || dados.senha) registrar('usuario.credencial', u.nome, { usuario: autor })
    return u
  }
  const u = banco.inserir('usuarios', { ...base, tentativas: 0, bloqueadoAte: null, senha: base.senha || null })
  registrar('usuario.criado', u.nome, { usuario: autor })
  return u
}

export function desbloquearUsuario(id, autor) {
  const u = banco.atualizar('usuarios', id, { tentativas: 0, bloqueadoAte: null })
  registrar('usuario.alterado', `${u.nome} desbloqueado`, { usuario: autor })
}

export const estaBloqueado = (u) => Boolean(bloqueadoAte(u))
