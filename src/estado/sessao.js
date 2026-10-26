// Sessão do usuário logado.
//
// Quem a pessoa é vem do servidor: o token que as funções do login emitem
// (ver src/firebase/pdv.js) e a ficha dela no Firestore (src/estado/rede.js).
// Editar o sessionStorage não troca de pessoa — o id daqui precisa bater com o
// do token, e as permissões saem da ficha e dos perfis do servidor.
//
// O sessionStorage guarda só onde a pessoa está trabalhando (modo, filial,
// caixa) e se a tela está bloqueada. Fecha a aba, acaba a sessão.
//
// Bloqueio por inatividade: depois de N minutos sem toque nem tecla, a tela pede
// o PIN de novo (o caixa continua aberto). A sessão inteira vence em até 12 horas
// (o servidor não aceita o token depois disso).

import { useMemo, useSyncExternalStore } from 'react'
import { useColecao, useDoc } from '../dados/banco.js'
import { pode as podeFazer, acessaFilial } from '../dados/permissoes.js'
import { registrar } from '../dados/auditoria.js'
import { rede, useRede } from './rede.js'
import { sairDaPessoa } from '../firebase/pdv.js'

const CHAVE = 'scpdv:sessao'
const HORAS_MAXIMAS = 12
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

const eu = () => (atual && rede.obter().eu?.id === atual.usuarioId ? rede.obter().eu : null)

export const sessao = {
  obter: () => atual,

  // Chamado depois que o servidor conferiu o PIN ou o Google (src/firebase/pdv.js).
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
    definir({ ...atual, bloqueada: true })
    if (motivo === 'inatividade') registrar('acesso.tela-bloqueada', '', { usuario: eu(), filialId: atual.filialId })
  },

  desbloquear() {
    if (atual) definir({ ...atual, bloqueada: false, ultimoUso: Date.now() })
  },

  async sair() {
    if (atual) registrar('acesso.saiu', '', { usuario: eu(), filialId: atual.filialId })
    definir(null)
    await sairDaPessoa()
  },

  assinar(fn) {
    ouvintes.add(fn)
    return () => ouvintes.delete(fn)
  },
}

// Um relógio só, de minuto em minuto, para a sessão vencida ser percebida
// mesmo com a tela parada.
let minuto = Math.floor(Date.now() / 60_000)
const ouvintesRelogio = new Set()
setInterval(() => {
  const agora = Math.floor(Date.now() / 60_000)
  if (agora !== minuto) {
    minuto = agora
    ouvintesRelogio.forEach((fn) => fn())
  }
}, 15_000)
const useMinuto = () =>
  useSyncExternalStore(
    (fn) => (ouvintesRelogio.add(fn), () => ouvintesRelogio.delete(fn)),
    () => minuto,
  )

export function useSessao() {
  const s = useSyncExternalStore(sessao.assinar, sessao.obter)
  const agora = useMinuto()
  const { carregando: carregandoRede, claims, eu: ficha, perfis } = useRede()
  const filiais = useColecao('filiais')
  const pontosVenda = useColecao('pontosVenda')
  const config = useDoc('config')

  return useMemo(() => {
    const carregando = Boolean(s) && carregandoRede
    // A pessoa da aba precisa ser a do token, e a ficha dela precisa estar ativa.
    const valida = Boolean(s && claims?.usuario === s.usuarioId && ficha?.id === s.usuarioId && ficha.ativo === true)
    const horas = Math.min(config.sessaoHoras || HORAS_MAXIMAS, HORAS_MAXIMAS)
    const vencida = Boolean(s && (Date.now() >= (claims?.ate || 0) || Date.now() - s.inicio > horas * 3_600_000))
    const ativa = Boolean(s) && !carregando && valida && !vencida
    return {
      carregando,
      sessao: ativa ? s : null,
      usuario: ativa ? ficha : null,
      perfil: ativa ? perfis.find((p) => p.id === ficha.perfilId) : null,
      filial: ativa ? filiais.find((f) => f.id === s.filialId) : null,
      pdv: ativa ? pontosVenda.find((p) => p.id === s.pdvId) : null,
      expirada: Boolean(s) && !carregando && (!valida || vencida),
      pode: (permissao) => (ativa ? podeFazer(ficha, perfis, permissao) : false),
      filiaisPermitidas: ativa ? filiais.filter((f) => f.ativo && acessaFilial(ficha, f.id)) : [],
    }
    // `agora` só está aqui para recalcular a cada minuto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, carregandoRede, claims, ficha, perfis, filiais, pontosVenda, config.sessaoHoras, agora])
}
