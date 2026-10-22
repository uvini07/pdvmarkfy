// O "banco" do PDV enquanto não existe banco de verdade.
//
// Os dados ficam no IndexedDB do navegador (o banco embutido, com espaço de
// sobra), um registro por venda, produto, caixa… Na abertura tudo é carregado
// para a memória; as telas leem da memória (rápido e síncrono) e cada mudança
// é gravada no IndexedDB em transação, registro por registro.
//
// Por que registro por registro: o caixa e a cozinha costumam ficar abertos ao
// mesmo tempo no mesmo computador. Se cada aba regravasse a lista inteira, a
// cozinha marcando "pronto" poderia apagar a venda que o caixa acabou de
// gravar. Gravando só o registro alterado, uma aba nunca desfaz a outra.
// Saldo de estoque e senha do pedido são contadores: somam dentro da própria
// transação do IndexedDB, então duas abas nunca pegam a mesma senha.
//
// As abas avisam umas às outras pelo BroadcastChannel: o pedido cobrado no
// caixa aparece na cozinha e no painel de senhas na hora.
//
// Quando o banco real chegar, só este arquivo muda — telas e regras continuam.
//
// Regra: nunca alterar um objeto que veio daqui. Toda mudança cria um objeto
// novo, para o React perceber a diferença.

import { useSyncExternalStore } from 'react'
import { novoId } from '../lib/seguranca.js'

const NOME_BANCO = 'pdv-sua-coxinha'
const VERSAO = 1

export const COLECOES = [
  'filiais',
  'pontosVenda',
  'perfis',
  'usuarios',
  'grupos',
  'classes',
  'produtos',
  'gruposModificadores',
  'promocoes',
  'formasPagamento',
  'motivosCancelamento',
  'tiposDesconto',
  'clientes',
  'fornecedores',
  'caixas',
  'vendas',
  'movimentosEstoque',
  'contas',
  'comunicados',
  'auditoria',
]

// Documentos únicos (objetos, não listas). "saldos" e "sequencias" são
// contadores: cada chave é gravada separada.
export const DOCUMENTOS = ['config', 'saldos', 'sequencias']
const CONTADORES = ['saldos', 'sequencias']

const memoria = new Map()
const ouvintes = new Map()
let idb = null
let canal = null
let fila = Promise.resolve()

const padrao = (nome) => (DOCUMENTOS.includes(nome) ? {} : [])
const ler = (nome) => memoria.get(nome) ?? padrao(nome)

function notificar(nome) {
  ouvintes.get(nome)?.forEach((fn) => fn())
}

function definir(nome, valor) {
  memoria.set(nome, valor)
  notificar(nome)
}

// ---------------------------------------------------------------------------
// IndexedDB

const pedido = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const fim = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Transação cancelada'))
  })

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME_BANCO, VERSAO)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const nome of COLECOES) if (!db.objectStoreNames.contains(nome)) db.createObjectStore(nome, { keyPath: 'id' })
      for (const nome of DOCUMENTOS) if (!db.objectStoreNames.contains(nome)) db.createObjectStore(nome)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('Feche as outras abas do PDV e recarregue.'))
  })
}

async function carregar(nome) {
  const tx = idb.transaction(nome, 'readonly')
  const loja = tx.objectStore(nome)
  if (!DOCUMENTOS.includes(nome)) {
    const lista = await pedido(loja.getAll())
    return lista.sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''))
  }
  if (nome === 'config') return (await pedido(loja.get('config'))) || {}
  const [chaves, valores] = await Promise.all([pedido(loja.getAllKeys()), pedido(loja.getAll())])
  return Object.fromEntries(chaves.map((k, i) => [k, valores[i]]))
}

// Toda gravação entra numa fila: a ordem das mudanças é a ordem em que
// aconteceram nesta aba. Falha de gravação vira aviso na tela.
function enfileirar(trabalho, aviso) {
  fila = fila
    .then(trabalho)
    .then(() => canal?.postMessage(aviso))
    .catch((erro) => window.dispatchEvent(new CustomEvent('scpdv:falha-gravacao', { detail: String(erro?.message || erro) })))
  return fila
}

function gravarRegistro(nome, registro) {
  enfileirar(async () => {
    const tx = idb.transaction(nome, 'readwrite')
    tx.objectStore(nome).put(registro)
    await fim(tx)
  }, { nome, id: registro.id })
}

function apagarRegistro(nome, id) {
  enfileirar(async () => {
    const tx = idb.transaction(nome, 'readwrite')
    tx.objectStore(nome).delete(id)
    await fim(tx)
  }, { nome, id, removido: true })
}

function gravarColecao(nome, lista) {
  enfileirar(async () => {
    const tx = idb.transaction(nome, 'readwrite')
    const loja = tx.objectStore(nome)
    loja.clear()
    if (DOCUMENTOS.includes(nome)) {
      if (nome === 'config') loja.put(lista, 'config')
      else for (const [k, v] of Object.entries(lista)) loja.put(v, k)
    } else for (const item of lista) loja.put(item)
    await fim(tx)
  }, { nome })
}

async function recarregar(nome, id, removido) {
  if (id === undefined || DOCUMENTOS.includes(nome)) return definir(nome, await carregar(nome))
  const lista = ler(nome)
  if (removido) return definir(nome, lista.filter((x) => x.id !== id))
  const tx = idb.transaction(nome, 'readonly')
  const registro = await pedido(tx.objectStore(nome).get(id))
  if (!registro) return definir(nome, lista.filter((x) => x.id !== id))
  const i = lista.findIndex((x) => x.id === id)
  definir(nome, i >= 0 ? lista.map((x) => (x.id === id ? registro : x)) : [...lista, registro])
}

// Abre o banco e carrega tudo para a memória. Chamado uma vez, antes de mostrar a tela.
export async function iniciarBanco() {
  if (!('indexedDB' in window)) throw new Error('Este navegador não guarda dados. Use o Chrome, o Edge ou o Firefox atualizados.')
  idb = await abrir()
  idb.onversionchange = () => {
    idb.close()
    window.location.reload()
  }
  const nomes = [...COLECOES, ...DOCUMENTOS]
  const valores = await Promise.all(nomes.map(carregar))
  nomes.forEach((n, i) => memoria.set(n, valores[i]))

  if ('BroadcastChannel' in window) {
    canal = new BroadcastChannel(NOME_BANCO)
    canal.onmessage = (e) => {
      const { nome, id, removido, chaves } = e.data || {}
      if (nome === '*') {
        for (const n of nomes) recarregar(n)
      } else if (chaves) recarregar(nome)
      else if (nome) recarregar(nome, id, removido)
    }
  }

  // Pede ao navegador para não apagar estes dados quando o disco encher.
  navigator.storage?.persist?.().catch(() => {})
}

const agora = () => new Date().toISOString()

export const banco = {
  lista: (nome) => ler(nome),
  doc: (nome) => ler(nome),
  obter: (nome, id) => ler(nome).find((x) => x.id === id),

  inserir(nome, item) {
    const novo = { id: item.id || novoId(), criadoEm: item.criadoEm || agora(), ...item }
    definir(nome, [...ler(nome), novo])
    gravarRegistro(nome, novo)
    return novo
  },

  atualizar(nome, id, mudanca) {
    let atualizado = null
    const lista = ler(nome).map((x) => {
      if (x.id !== id) return x
      const parcial = typeof mudanca === 'function' ? mudanca(x) : mudanca
      atualizado = { ...x, ...parcial, atualizadoEm: agora() }
      return atualizado
    })
    if (atualizado) {
      definir(nome, lista)
      gravarRegistro(nome, atualizado)
    }
    return atualizado
  },

  remover(nome, id) {
    definir(
      nome,
      ler(nome).filter((x) => x.id !== id),
    )
    apagarRegistro(nome, id)
  },

  // Troca a coleção inteira. Use só em operações de lote feitas por uma pessoa
  // (reordenar, importar backup, apagar demonstração), nunca no caixa.
  substituir(nome, valor) {
    definir(nome, valor)
    gravarColecao(nome, valor)
  },

  alterarDoc(nome, mudanca) {
    if (CONTADORES.includes(nome)) throw new Error(`Use banco.somar para "${nome}".`)
    const atual = ler(nome)
    const novo = { ...atual, ...(typeof mudanca === 'function' ? mudanca(atual) : mudanca) }
    definir(nome, novo)
    gravarColecao(nome, novo)
    return novo
  },

  // Soma em contadores (saldo de estoque, senhas) dentro de uma transação do
  // IndexedDB. Devolve os valores finais. A memória já muda na hora.
  somar(nome, ajustes, { ciclo } = {}) {
    const atual = ler(nome)
    const local = { ...atual }
    for (const [k, delta] of ajustes) local[k] = arredondar((local[k] ?? 0) + delta, ciclo)
    definir(nome, local)
    return new Promise((resolve, reject) => {
      enfileirar(async () => {
        try {
          const tx = idb.transaction(nome, 'readwrite')
          const loja = tx.objectStore(nome)
          const finais = {}
          for (const [k, delta] of ajustes) {
            const valor = (await pedido(loja.get(k))) ?? 0
            finais[k] = arredondar(valor + delta, ciclo)
            loja.put(finais[k], k)
          }
          await fim(tx)
          // O valor gravado pode diferir do local se outra aba somou ao mesmo tempo
          definir(nome, { ...ler(nome), ...finais })
          resolve(finais)
        } catch (erro) {
          reject(erro)
          throw erro
        }
      }, { nome, chaves: true })
    })
  },

  assinar(nome, fn) {
    if (!ouvintes.has(nome)) ouvintes.set(nome, new Set())
    ouvintes.get(nome).add(fn)
    return () => ouvintes.get(nome).delete(fn)
  },

  // O registro de maior chave gravado no IndexedDB (lido do disco, não da memória)
  async ultimo(nome) {
    const tx = idb.transaction(nome, 'readonly')
    const cursor = await pedido(tx.objectStore(nome).openCursor(null, 'prev'))
    return cursor?.value || null
  },

  // Espera todas as gravações pendentes terminarem (backup, testes)
  aguardar: () => fila,

  async uso() {
    const estimativa = (await navigator.storage?.estimate?.()) || {}
    return { usado: estimativa.usage || 0, cota: estimativa.quota || 0 }
  },

  exportarTudo() {
    const saida = {}
    for (const nome of [...COLECOES, ...DOCUMENTOS]) saida[nome] = ler(nome)
    return saida
  },

  importarTudo(dados) {
    for (const nome of [...COLECOES, ...DOCUMENTOS]) if (nome in dados) banco.substituir(nome, dados[nome])
    canal?.postMessage({ nome: '*' })
  },

  apagarTudo() {
    for (const nome of [...COLECOES, ...DOCUMENTOS]) banco.substituir(nome, padrao(nome))
  },
}

function arredondar(v, ciclo) {
  if (ciclo) return ((v - 1) % ciclo) + 1
  return Math.round(v * 1000) / 1000
}

export function useColecao(nome) {
  return useSyncExternalStore(
    (fn) => banco.assinar(nome, fn),
    () => ler(nome),
  )
}

export const useDoc = useColecao
