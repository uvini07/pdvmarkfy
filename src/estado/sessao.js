// Sessão do usuário logado. Fica no sessionStorage: fecha a aba, acaba a sessão.
// Nunca guarda PIN, senha ou hash — só quem é, onde está e desde quando.
//
// Bloqueio por inatividade: depois de N minutos sem toque nem tecla, a tela pede
// o PIN de novo (o caixa continua aberto). A sessão inteira expira em X horas.

import { useMemo, useSyncExternalStore } from 'react'
import { banco, useColecao, useDoc } from '../dados/banco.js'
import { pode as podeFazer, acessaFilial } from '../dados/permissoes.js'
import { registrar } from '../dados/auditoria.js'

const CHAVE = 'scpdv:sessao'
const ouvintes = new Set()
let atual = carregar()

function carregar() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE)) || null
  } catch {
    return null
  }
}

function definir(nova) {
  atual = nova
  if (nova) sessionStorage.setItem(CHAVE, JSON.stringify(nova))
  else sessionStorage.removeItem(CHAVE)
  ouvintes.forEach((fn) => fn())
}

export const sessao = {
  obter: () => atual,

  entrar({ usuario, modo, filialId, pdvId }) {
    const agora = Date.now()
    definir({ usuarioId: usuario.id, modo, filialId, pdvId: pdvId || null, inicio: agora, ultimoUso: agora, bloqueada: false })
    registrar('acesso.entrou', modo === 'caixa' ? 'Caixa' : modo === 'cozinha' ? 'Cozinha' : 'Retaguarda', { usuario, filialId })
  },

  trocarFilial(filialId) {
    if (atual) definir({ ...atual, filialId, pdvId: null })
  },

  trocarModo(modo, extra = {}) {
    if (atual) definir({ ...atual, modo, ...extra })
  },

  tocar() {
    if (atual && !atual.bloqueada) {
      atual = { ...atual, ultimoUso: Date.now() }
      sessionStorage.setItem(CHAVE, JSON.stringify(atual))
    }
  },

  bloquear(motivo = 'inatividade') {
    if (!atual || atual.bloqueada) return
    const usuario = banco.obter('usuarios', atual.usuarioId)
    definir({ ...atual, bloqueada: true })
    if (motivo === 'inatividade') registrar('acesso.tela-bloqueada', '', { usuario, filialId: atual.filialId })
  },

  desbloquear() {
    if (atual) definir({ ...atual, bloqueada: false, ultimoUso: Date.now() })
  },

  sair() {
    if (atual) {
      const usuario = banco.obter('usuarios', atual.usuarioId)
      registrar('acesso.saiu', '', { usuario, filialId: atual.filialId })
    }
    definir(null)
  },

  assinar(fn) {
    ouvintes.add(fn)
    return () => ouvintes.delete(fn)
  },
}

export function useSessao() {
  const s = useSyncExternalStore(sessao.assinar, sessao.obter)
  const usuarios = useColecao('usuarios')
  const perfis = useColecao('perfis')
  const filiais = useColecao('filiais')
  const pontosVenda = useColecao('pontosVenda')
  const config = useDoc('config')

  return useMemo(() => {
    const usuario = s ? usuarios.find((u) => u.id === s.usuarioId) : null
    // Usuário desativado ou apagado no meio do turno: a sessão deixa de valer.
    const valida = Boolean(usuario?.ativo)
    const expirada = s && Date.now() - s.inicio > (config.sessaoHoras || 12) * 3600_000
    const ativa = s && valida && !expirada
    return {
      sessao: ativa ? s : null,
      usuario: ativa ? usuario : null,
      perfil: ativa ? perfis.find((p) => p.id === usuario.perfilId) : null,
      filial: ativa ? filiais.find((f) => f.id === s.filialId) : null,
      pdv: ativa ? pontosVenda.find((p) => p.id === s.pdvId) : null,
      expirada: Boolean(s && (!valida || expirada)),
      pode: (permissao) => (ativa ? podeFazer(usuario, perfis, permissao) : false),
      filiaisPermitidas: ativa ? filiais.filter((f) => f.ativo && acessaFilial(usuario, f.id)) : [],
    }
  }, [s, usuarios, perfis, filiais, pontosVenda, config.sessaoHoras])
}
