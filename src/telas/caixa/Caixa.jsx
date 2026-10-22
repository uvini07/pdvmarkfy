// Frente de caixa. Layout dos PDVs de balcão mais usados (Toast, Square,
// Saipos): grupos à esquerda, produtos com foto no meio e a comanda à direita,
// com o botão de cobrar sempre à vista. Tudo pensado para toque e pressa.
//
// Nas lojas com salão, o pedido também pode ir para uma mesa: em vez de
// cobrar, o atendente lança na mesa (vai na hora para a cozinha) e a conta da
// mesa fecha depois, pela janela de Mesas. O celular ou tablet do garçom pode
// entrar "só para as mesas", sem abrir caixa: lança e manda para a cozinha;
// receber fica para um aparelho com o caixa aberto.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useColecao, useDoc } from '../../dados/banco.js'
import { useSessao, sessao } from '../../estado/sessao.js'
import { caixaAbertoDoPdv } from '../../dados/caixa.js'
import { melhorPromocao, precoNaFilial, estaPausado } from '../../dados/precos.js'
import { registrarPedidoCancelado, totaisPedido, totalItem } from '../../dados/vendas.js'
import { abrirConta, contasComPagamentoNoCaixa, descontoNaConta, itensDaConta, lancarPedido, rodadaParaImpressao } from '../../dados/mesas.js'
import { avisar, confirmar, escolher, pedirAutorizacao } from '../../componentes/dialogos.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { Logo, useRelogio } from '../../componentes/ui.jsx'
import { Menu } from '../../componentes/Menu.jsx'
import { imprimir } from '../../componentes/Impressao.jsx'
import { useSalao } from '../../componentes/Salao.jsx'
import { ir } from '../../rotas/useRota.js'
import { hora } from '../../lib/datas.js'
import { reais } from '../../lib/dinheiro.js'
import { Catalogo } from './Catalogo.jsx'
import { Comanda } from './Comanda.jsx'
import { EscolhaProduto } from './EscolhaProduto.jsx'
import { Pagamento } from './Pagamento.jsx'
import { Desconto } from './Desconto.jsx'
import { AberturaCaixa, MovimentoCaixa, FechamentoCaixa } from './OperacoesCaixa.jsx'
import { PedidosDoDia } from './PedidosDoDia.jsx'
import { Esgotados } from './Esgotados.jsx'
import { EmEspera, lerEspera, gravarEspera } from './EmEspera.jsx'
import { ComunicadosCaixa } from './ComunicadosCaixa.jsx'
import { Mesas } from './Mesas.jsx'

const novoUid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

const pedidoVazio = (tipo = 'balcao') => ({ itens: [], tipo, cliente: { nome: '', cpf: '' }, descontoPedido: null, itensCancelados: [], obs: '', mesa: null })

// O pedido em andamento sobrevive a recarregar a página ou cair a energia.
const chavePedido = (pdvId) => `scpdv:pedido:${pdvId}`
const CHAVE_SO_MESAS = 'scpdv:so-mesas'
function lerPedido(pdvId, tipo) {
  try {
    return JSON.parse(localStorage.getItem(chavePedido(pdvId))) || pedidoVazio(tipo)
  } catch {
    return pedidoVazio(tipo)
  }
}

export function Caixa() {
  const { usuario, filial, pdv, pode } = useSessao()
  const config = useDoc('config')
  const caixas = useColecao('caixas')
  const produtos = useColecao('produtos')
  const gruposModificadores = useColecao('gruposModificadores')
  const promocoes = useColecao('promocoes')
  const comunicados = useColecao('comunicados')
  const agora = useRelogio(20_000)

  const filialId = filial?.id
  const pdvId = pdv?.id
  const caixaAberto = caixaAbertoDoPdv(caixas, pdvId)

  const [pedido, setPedido] = useState(() => lerPedido(pdvId, config.tipoPedidoPadrao))
  const [modal, setModal] = useState(null)
  // Durante o fechamento o caixa já está fechado, mas a tela do resultado
  // (diferença e impressão) precisa continuar aberta até o operador sair.
  const [caixaEmFechamento, setCaixaEmFechamento] = useState(null)
  const caixa = caixaAberto || (modal?.tipo === 'fechamento' ? caixaEmFechamento : null)
  const [soMesas, setSoMesas] = useState(() => sessionStorage.getItem(CHAVE_SO_MESAS) === '1')
  const trocarSoMesas = (ligar) => {
    if (ligar) sessionStorage.setItem(CHAVE_SO_MESAS, '1')
    else sessionStorage.removeItem(CHAVE_SO_MESAS)
    setSoMesas(ligar)
  }
  // Sem caixa aberto não se recebe dinheiro: oferece abrir o caixa
  const precisaDoCaixa = async (texto) => {
    const ok = await confirmar({ titulo: 'Este aparelho está só nas mesas', texto: `${texto} Abrir o caixa neste aparelho agora?`, botao: 'Abrir o caixa', cancelar: 'Agora não' })
    if (ok) {
      setModal(null)
      trocarSoMesas(false)
    }
  }
  const [ultimoAdicionado, setUltimoAdicionado] = useState(null)
  const [verComanda, setVerComanda] = useState(false)
  const [emEspera, setEmEspera] = useState(() => lerEspera(pdvId))
  const buscaRef = useRef(null)
  const salao = useSalao(filialId, agora)
  const temMesas = salao.mesas.length > 0 || salao.foraDoMapa.length > 0

  useEffect(() => {
    localStorage.setItem(chavePedido(pdvId), JSON.stringify(pedido))
  }, [pedido, pdvId])

  const totais = useMemo(() => totaisPedido(pedido), [pedido])
  const naoLidos = comunicados.filter((c) => (!c.filiais?.length || c.filiais.includes(filialId)) && !c.lidos?.[usuario.id]).length

  // ---------- Adicionar ----------

  const adicionar = useCallback(
    async (produto, { qtd = 1, modificadores = [], obs = '', precoUnit }) => {
      if (produto.config.maior18) {
        const ok = await confirmar({
          titulo: 'Venda só para maiores de 18',
          texto: `${produto.nome} é bebida alcoólica. Confira o documento: o cliente tem 18 anos ou mais?`,
          botao: 'Sim, tem 18 ou mais',
          cancelar: 'Não vender',
        })
        if (!ok) return
      }
      const preco = precoUnit ?? precoNaFilial(produto, filialId)
      const extras = modificadores.reduce((t, m) => t + m.preco * (m.qtd || 1), 0)
      const promocao = melhorPromocao(produto, promocoes, filialId, preco + extras)
      const simples = !modificadores.length && !obs && !produto.config.pedePreco
      setPedido((p) => {
        const igual = simples && p.itens.find((i) => i.produtoId === produto.id && !i.modificadores.length && !i.obs && !i.desconto)
        if (igual) {
          setUltimoAdicionado({ uid: igual.uid, t: Date.now() })
          return { ...p, itens: p.itens.map((i) => (i === igual ? { ...i, qtd: i.qtd + qtd } : i)) }
        }
        const uid = novoUid()
        setUltimoAdicionado({ uid, t: Date.now() })
        return {
          ...p,
          itens: [...p.itens, { uid, produtoId: produto.id, nome: produto.nome, qtd, precoUnit: preco, setor: produto.config.setor, modificadores, obs, promocao, desconto: null }],
        }
      })
    },
    [filialId, promocoes],
  )

  const tocarProduto = useCallback(
    (produto) => {
      if (estaPausado(produto, filialId)) return avisar(`${produto.nome} está esgotado nesta loja.`, 'erro')
      const obrigatorio = produto.gruposModificadores.some((id) => gruposModificadores.find((g) => g.id === id)?.min > 0)
      if (obrigatorio || produto.config.chamaQuantidade || produto.config.pedePreco) setModal({ tipo: 'produto', produto })
      else adicionar(produto, {})
    },
    [filialId, gruposModificadores, adicionar],
  )

  // Leitor de código de barras ou código digitado + Enter
  const porCodigo = (texto) => {
    const t = texto.trim()
    const p = produtos.find((x) => x.ativo && x.tipo === 'venda' && (x.ean === t || x.codigo === t))
    if (p) tocarProduto(p)
    return Boolean(p)
  }

  // ---------- Alterar ----------

  const alterarQtd = (uid, delta) => {
    const item = pedido.itens.find((i) => i.uid === uid)
    if (!item) return
    if (item.qtd + delta <= 0) return removerItem(uid)
    setPedido((p) => ({ ...p, itens: p.itens.map((i) => (i.uid === uid ? { ...i, qtd: i.qtd + delta } : i)) }))
  }

  const salvarItem = (uid, mudancas) => setPedido((p) => ({ ...p, itens: p.itens.map((i) => (i.uid === uid ? { ...i, ...mudancas } : i)) }))

  const motivos = useColecao('motivosCancelamento').filter((m) => m.ativo)

  async function removerItem(uid) {
    const item = pedido.itens.find((i) => i.uid === uid)
    // Item novo de mesa ainda não foi para a cozinha nem para a conta: sai sem motivo
    if (pedido.mesa) {
      setPedido((p) => ({ ...p, itens: p.itens.filter((i) => i.uid !== uid) }))
      return setModal(null)
    }
    let autorizador = usuario
    if (!pode('caixa.cancelarItem')) {
      autorizador = await pedirAutorizacao({ permissao: 'caixa.cancelarItem', acao: `Tirar ${item.qtd}× ${item.nome} do pedido`, filialId })
      if (!autorizador) return
    }
    const motivo = await escolher({ titulo: `Tirar ${item.nome}?`, subtitulo: 'Escolha o motivo. Fica registrado nos cancelamentos.', opcoes: motivos.map((m) => m.nome) })
    if (!motivo) return
    setPedido((p) => ({
      ...p,
      itens: p.itens.filter((i) => i.uid !== uid),
      itensCancelados: [
        ...p.itensCancelados,
        { produtoId: item.produtoId, nome: item.nome, qtd: item.qtd, precoUnit: item.precoUnit, total: totalItem(item), motivo, em: new Date().toISOString(), por: usuario.nome, autorizadoPor: autorizador.id !== usuario.id ? autorizador.nome : null },
      ],
    }))
    setModal(null)
  }

  async function cancelarPedido() {
    if (pedido.mesa) return descartarNovos()
    if (!pedido.itens.length) return setPedido(pedidoVazio(config.tipoPedidoPadrao))
    let autorizador = usuario
    if (!pode('caixa.cancelarItem')) {
      autorizador = await pedirAutorizacao({ permissao: 'caixa.cancelarItem', acao: 'Cancelar o pedido inteiro', filialId })
      if (!autorizador) return
    }
    const motivo = await escolher({ titulo: 'Cancelar o pedido inteiro?', subtitulo: `${totais.quantidade} item(ns), ${reais(totais.total)}. Escolha o motivo.`, opcoes: motivos.map((m) => m.nome) })
    if (!motivo) return
    registrarPedidoCancelado({ pedido, motivo, usuario, autorizador, filialId, pdvId, caixaId: caixa?.id })
    setPedido(pedidoVazio(config.tipoPedidoPadrao))
    avisar('Pedido cancelado', 'info')
  }

  // ---------- Espera ----------

  const rotuloEspera = (p, n) => p.mesa?.nome || p.cliente.nome || `Espera ${n}`

  const colocarEmEspera = () => {
    if (!pedido.itens.length) return
    const lista = [...emEspera, { ...pedido, id: novoUid(), em: new Date().toISOString(), rotulo: rotuloEspera(pedido, emEspera.length + 1) }]
    setEmEspera(lista)
    gravarEspera(pdvId, lista)
    setPedido(pedidoVazio(config.tipoPedidoPadrao))
    avisar('Pedido em espera', 'info')
  }

  const retomar = (id) => {
    const alvo = emEspera.find((e) => e.id === id)
    let lista = emEspera.filter((e) => e.id !== id)
    if (pedido.itens.length) lista = [...lista, { ...pedido, id: novoUid(), em: new Date().toISOString(), rotulo: rotuloEspera(pedido, lista.length + 1) }]
    setEmEspera(lista)
    gravarEspera(pdvId, lista)
    const { id: _id, em: _em, rotulo: _r, ...resto } = alvo
    setPedido(resto)
    setModal(null)
  }

  // ---------- Cobrar ----------

  const cobrar = () => {
    if (pedido.mesa) return pedido.itens.length ? lancarNaMesa() : verContaDoPedido()
    if (!pedido.itens.length) return avisar('Adicione um produto antes de cobrar.', 'info')
    if (!caixa) return precisaDoCaixa('Para cobrar no balcão é preciso ter o caixa aberto. O pedido continua na tela.')
    setModal({ tipo: 'pagamento' })
  }

  // ---------- Mesas ----------

  const situacaoDaConta = (contaId) => [...salao.situacoes.values(), ...salao.foraDoMapa.map((f) => f.situacao)].find((x) => x.conta?.id === contaId) || null
  const contaDoPedido = pedido.mesa ? salao.contas.find((c) => c.id === pedido.mesa.contaId) || salao.contas.find((c) => c.mesaId === pedido.mesa.mesaId) || null : null
  const situacaoDoPedido = contaDoPedido ? situacaoDaConta(contaDoPedido.id) : null
  const [lancando, setLancando] = useState(false)

  const dadosDaMesa = (mesa, { conta, pessoas, clienteNome } = {}, origem) => ({
    mesaId: mesa.id,
    contaId: conta?.id || null,
    nome: mesa.nome,
    ambienteNome: mesa.ambienteNome || '',
    pessoas: pessoas || null,
    clienteNome: clienteNome || '',
    origem,
  })

  // O pedido que está na tela vai para a mesa escolhida (pelo botão Mesa da comanda)
  const escolherMesaDoPedido = (mesa, extra) => {
    setPedido((p) => ({ ...p, tipo: 'mesa', descontoPedido: null, mesa: dadosDaMesa(mesa, extra, 'comanda') }))
    if (pedido.descontoPedido) avisar('O desconto no pedido saiu. Dê o desconto na conta da mesa, na hora de fechar.', 'info')
    setModal(null)
  }

  // Pelo mapa: a tela passa a lançar nesta mesa. Um pedido de outra mesa ou do
  // balcão que estava na tela vai para a espera, sem se perder.
  const lancarItensNaMesa = (mesa, conta) => {
    const dados = dadosDaMesa(mesa, { conta }, 'mapa')
    if (pedido.itens.length && pedido.mesa?.mesaId !== mesa.id) {
      const lista = [...emEspera, { ...pedido, id: novoUid(), em: new Date().toISOString(), rotulo: rotuloEspera(pedido, emEspera.length + 1) }]
      setEmEspera(lista)
      gravarEspera(pdvId, lista)
      avisar('O pedido que estava na tela foi para a espera.', 'info')
      setPedido({ ...pedidoVazio('mesa'), mesa: dados })
    } else setPedido((p) => ({ ...p, tipo: 'mesa', descontoPedido: null, mesa: dados }))
    setVerComanda(false)
    setModal(null)
  }

  const tirarMesa = () => setPedido((p) => ({ ...p, tipo: config.tipoPedidoPadrao || 'balcao', mesa: null }))

  async function descartarNovos() {
    if (!pedido.itens.length) return tirarMesa()
    const ok = await confirmar({ titulo: 'Descartar os itens novos?', texto: `${totais.quantidade} item(ns) ainda não foram para a cozinha nem para a conta da ${pedido.mesa.nome}.`, botao: 'Descartar', perigo: true })
    if (ok) setPedido((p) => ({ ...p, itens: [], itensCancelados: [] }))
  }

  const verContaDoPedido = () => setModal({ tipo: 'mesas', mesaId: contaDoPedido?.mesaId || pedido.mesa?.mesaId })

  // Fechar a conta com itens dela ainda na tela, sem lançar, deixaria esses itens de fora
  const receberConta = async (conta, opcoes = {}) => {
    if (!caixa) return precisaDoCaixa('Para receber a conta é preciso ter o caixa aberto (ou feche a conta no caixa da loja).')
    if (pedido.mesa?.mesaId === conta.mesaId && pedido.itens.length) {
      const ok = await confirmar({
        titulo: 'Há itens que não foram lançados',
        texto: `${totais.quantidade} item(ns) da ${conta.mesaNome} estão na tela e ainda não entraram na conta. Lançar agora, antes de fechar?`,
        botao: 'Lançar e continuar',
        cancelar: 'Fechar sem eles',
      })
      if (ok) await lancarNaMesa()
    }
    setModal({ tipo: 'pagamento', contaId: conta.id, mesaId: conta.mesaId, dividir: opcoes.dividir })
  }

  async function lancarNaMesa() {
    if (!pedido.itens.length || lancando) return
    const m = pedido.mesa
    setLancando(true)
    try {
      let conta = salao.contas.find((c) => c.id === m.contaId)
      if (!conta) {
        const aberta = salao.contas.find((c) => c.mesaId === m.mesaId)
        if (aberta && m.contaId) {
          const ok = await confirmar({ titulo: `A conta da ${m.nome} mudou`, texto: `A conta em que você lançava foi fechada. A ${m.nome} tem outra conta aberta, de ${aberta.garcomNome}. Lançar nela?`, botao: 'Lançar nesta conta' })
          if (!ok) return
        }
        if (aberta) conta = aberta
        else {
          const mesa = salao.mesas.find((x) => x.id === m.mesaId)
          if (!mesa) return avisar(`A ${m.nome} saiu do mapa. Escolha outra mesa.`, 'erro')
          if (mesa.ativa === false) return avisar(`A ${m.nome} está fora de uso. Escolha outra mesa.`, 'erro')
          conta = abrirConta({ filialId, mesa, pessoas: m.pessoas, clienteNome: m.clienteNome || pedido.cliente.nome, usuario, servicoPercentual: config.servicoPercentual ?? 10 })
        }
      }
      const rodada = lancarPedido({ conta, itens: pedido.itens, itensCancelados: pedido.itensCancelados, obs: pedido.obs, usuario })
      if (config.imprimirComandaAuto && rodada.cozinha) imprimir('comanda', rodadaParaImpressao(rodada, conta))
      avisar(`${rodada.numero}º pedido lançado na ${conta.mesaNome}${rodada.cozinha ? ' e enviado à cozinha' : ''}`)
      setPedido(pedidoVazio(config.tipoPedidoPadrao))
      setVerComanda(false)
      // Quem veio pelo mapa volta para o mapa, para atender a próxima mesa
      if (m.origem === 'mapa') setModal({ tipo: 'mesas' })
    } catch (e) {
      avisar(e.message, 'erro')
    } finally {
      setLancando(false)
    }
  }

  // Avisa quando um pedido de mesa fica pronto na cozinha, para alguém servir
  const prontosAntes = useRef(null)
  useEffect(() => {
    const prontos = new Map()
    for (const s of salao.situacoes.values()) for (const p of s.pedidos || []) if (p.cozinha?.status === 'pronto') prontos.set(p.id, s.conta.mesaNome)
    if (prontosAntes.current) for (const [id, mesa] of prontos) if (!prontosAntes.current.has(id)) avisar(`${mesa}: pedido pronto para servir`, 'info', 6000)
    prontosAntes.current = prontos
  }, [salao.situacoes])

  const vendaConcluida = () => {
    setPedido(pedidoVazio(config.tipoPedidoPadrao))
    setVerComanda(false)
  }

  // ---------- Atalhos de teclado ----------

  useEffect(() => {
    const tecla = (e) => {
      if (modal || document.querySelector('dialog[open]')) return
      if (e.key === 'F2' || (e.key === '/' && !e.target.closest('input, textarea'))) {
        e.preventDefault()
        buscaRef.current?.focus()
      } else if (e.key === 'F9') {
        e.preventDefault()
        cobrar()
      } else if (e.key === 'F8') {
        e.preventDefault()
        // Na mesa o desconto é na conta inteira, na hora de fechar
        if (pedido.mesa) avisar('Na mesa, o desconto é dado na conta: abra “Ver conta”.', 'info')
        else if (pedido.itens.length) setModal({ tipo: 'desconto' })
      } else if (e.key === 'F4') {
        e.preventDefault()
        colocarEmEspera()
      } else if (e.key === 'F6' && temMesas) {
        e.preventDefault()
        setModal({ tipo: 'mesas' })
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  // ---------- Operações do caixa ----------

  const fecharCaixaComPermissao = async () => {
    if (pedido.itens.length) return avisar('Termine ou coloque em espera o pedido atual antes de fechar o caixa.', 'erro')
    // Dinheiro de conta de mesa ainda aberta, recebido aqui, tem de entrar neste fechamento
    const comPagamento = contasComPagamentoNoCaixa(salao.contas, caixa.id)
    if (comPagamento.length) return avisar(`${comPagamento.map((c) => c.mesaNome).join(', ')} já recebeu pagamento neste caixa e ainda está aberta. Feche essas contas antes de fechar o caixa.`, 'erro')
    if (salao.contas.length) {
      const ok = await confirmar({
        titulo: 'Ainda há mesas abertas',
        texto: `${salao.contas.length} mesa(s) com conta aberta (${reais(salao.emAberto)}). Elas continuam abertas e podem ser fechadas em outro caixa. Fechar este caixa mesmo assim?`,
        botao: 'Fechar o caixa',
      })
      if (!ok) return
    }
    if (!pode('caixa.fechar')) {
      const ok = await pedirAutorizacao({ permissao: 'caixa.fechar', acao: 'Fechar o caixa', filialId })
      if (!ok) return
    }
    setCaixaEmFechamento(caixa)
    setModal({ tipo: 'fechamento' })
  }

  const menu = [
    ...(temMesas ? [{ rotulo: 'Mesas (F6)', icone: 'mesa', acao: () => setModal({ tipo: 'mesas' }) }] : []),
    { rotulo: 'Pedidos de hoje', icone: 'lista', acao: () => setModal({ tipo: 'pedidos' }) },
    ...(caixa
      ? [{ rotulo: 'Sangria ou suprimento', icone: 'dinheiro', acao: () => setModal({ tipo: 'movimento' }) }]
      : [{ rotulo: 'Abrir o caixa neste aparelho', icone: 'dinheiro', acao: () => trocarSoMesas(false) }]),
    { rotulo: 'Produtos esgotados', icone: 'pausa', acao: () => setModal({ tipo: 'esgotados' }) },
    ...(caixa ? [{ rotulo: 'Fechar o caixa', icone: 'cadeado', acao: fecharCaixaComPermissao }] : []),
    { separador: true },
    { rotulo: 'Abrir painel de senhas', icone: 'monitor', acao: () => window.open(`#/painel/${filialId}`, 'painel-senhas', 'noopener') },
    ...(pode('cozinha.ver') ? [{ rotulo: 'Tela da cozinha', icone: 'cozinha', acao: () => window.open(`#/cozinha`, 'cozinha', 'noopener') }] : []),
    ...(pode('admin.dashboard') || pode('admin.cardapio') ? [{ rotulo: 'Retaguarda', icone: 'grafico', acao: () => ir('/admin') }] : []),
    { separador: true },
    { rotulo: 'Bloquear tela', icone: 'cadeado', acao: () => sessao.bloquear('manual') },
    { rotulo: 'Sair', icone: 'sair', acao: () => sessao.sair() },
  ]

  if (!pdv) {
    return (
      <div className="tema-escuro tela-cheia-centro">
        <p>Este acesso não tem um caixa escolhido. Saia e entre de novo pelo caixa.</p>
        <button type="button" className="botao botao--primario botao--m" onClick={() => sessao.sair()}>
          Sair
        </button>
      </div>
    )
  }

  if (!caixa && !(soMesas && temMesas)) return <AberturaCaixa aoSoMesas={temMesas ? () => trocarSoMesas(true) : null} />

  return (
    <div className={`tema-escuro caixa ${verComanda ? 'caixa--comanda-aberta' : ''}`}>
      <header className="caixa__topo">
        <Logo claro altura={22} />
        <div className="caixa__onde">
          <strong>{filial.nome}</strong>
          <span>
            {pdv.nome}, {usuario.nome.split(' ')[0]}
          </span>
        </div>
        <div className="caixa__topo-acoes">
          {naoLidos > 0 && (
            <button type="button" className="caixa__chip caixa__chip--alerta" onClick={() => setModal({ tipo: 'comunicados' })} aria-label={`${naoLidos} comunicado${naoLidos > 1 ? 's' : ''}`}>
              <Icone nome="megafone" tamanho={18} /> {naoLidos}
              <span className="caixa__chip-rotulo"> comunicado{naoLidos > 1 ? 's' : ''}</span>
            </button>
          )}
          {!caixa && (
            <button type="button" className="caixa__chip caixa__chip--so-mesas" onClick={() => precisaDoCaixa('Aqui dá para lançar nas mesas, mas não para receber.')}>
              <Icone nome="cadeado" tamanho={16} /> Só mesas
            </button>
          )}
          {temMesas && (
            <button
              type="button"
              className="caixa__chip caixa__chip--mesas"
              onClick={() => setModal({ tipo: 'mesas' })}
              aria-label={`Mesas: ${salao.ocupadas} ocupada(s) de ${salao.total}${salao.prontos ? `, ${salao.prontos} pedido(s) pronto(s) para servir` : ''}${salao.atencao ? `, ${salao.atencao} sem pedido há tempo` : ''}`}
            >
              <Icone nome="mesa" tamanho={18} />
              <span className="numero">
                {salao.ocupadas}/{salao.total}
              </span>
              <span className="caixa__chip-rotulo"> mesas</span>
              {salao.prontos > 0 && (
                <span className="caixa__chip-selo caixa__chip-selo--pronto" aria-hidden="true">
                  {salao.prontos}
                </span>
              )}
              {!salao.prontos && salao.atencao > 0 && (
                <span className="caixa__chip-selo caixa__chip-selo--atencao" aria-hidden="true">
                  {salao.atencao}
                </span>
              )}
            </button>
          )}
          {emEspera.length > 0 && (
            <button type="button" className="caixa__chip caixa__chip--espera" onClick={() => setModal({ tipo: 'espera' })} aria-label={`${emEspera.length} em espera`}>
              <Icone nome="espera" tamanho={18} /> {emEspera.length}
              <span className="caixa__chip-rotulo"> em espera</span>
            </button>
          )}
          <button type="button" className="caixa__chip" onClick={() => setModal({ tipo: 'pedidos' })}>
            <Icone nome="lista" tamanho={18} /> Pedidos
          </button>
          <span className="caixa__hora numero">{hora(agora)}</span>
          <Menu rotulo="Mais opções do caixa" itens={menu} />
        </div>
      </header>

      <Catalogo buscaRef={buscaRef} aoTocar={tocarProduto} porCodigo={porCodigo} filialId={filialId} />

      <Comanda
        pedido={pedido}
        totais={totais}
        ultimoAdicionado={ultimoAdicionado}
        aoMudarTipo={(tipo) => setPedido((p) => ({ ...p, tipo }))}
        aoMudarNome={(nome) => setPedido((p) => ({ ...p, cliente: { ...p.cliente, nome } }))}
        aoAlterarQtd={alterarQtd}
        aoEditar={(uid) => setModal({ tipo: 'item', uid })}
        aoDesconto={() => setModal({ tipo: 'desconto' })}
        aoTirarDesconto={() => setPedido((p) => ({ ...p, descontoPedido: null }))}
        aoEspera={colocarEmEspera}
        aoCancelar={cancelarPedido}
        aoCobrar={cobrar}
        aoFecharMovel={() => setVerComanda(false)}
        temMesas={temMesas}
        situacaoMesa={situacaoDoPedido}
        lancando={lancando}
        aoEscolherMesa={() => setModal({ tipo: 'mesas', escolher: true })}
        aoTirarMesa={tirarMesa}
        aoVerConta={verContaDoPedido}
      />

      <button type="button" className="caixa__barra-movel" onClick={() => setVerComanda(true)}>
        <span>
          <Icone nome={pedido.mesa ? 'mesa' : 'recibo'} tamanho={20} /> {pedido.mesa ? `${pedido.mesa.nome}: ` : ''}Ver pedido ({totais.quantidade})
        </span>
        <strong className="numero">{reais(totais.total)}</strong>
      </button>

      {modal?.tipo === 'produto' && (
        <EscolhaProduto
          produto={modal.produto}
          filialId={filialId}
          aoFechar={() => setModal(null)}
          aoConfirmar={(dados) => {
            adicionar(modal.produto, dados)
            setModal(null)
          }}
        />
      )}
      {modal?.tipo === 'item' &&
        (() => {
          const item = pedido.itens.find((i) => i.uid === modal.uid)
          const produto = produtos.find((p) => p.id === item?.produtoId)
          if (!item || !produto) return null
          return (
            <EscolhaProduto
              produto={produto}
              item={item}
              filialId={filialId}
              aoFechar={() => setModal(null)}
              aoConfirmar={(dados) => {
                const extras = dados.modificadores.reduce((t, m) => t + m.preco * (m.qtd || 1), 0)
                salvarItem(item.uid, { ...dados, promocao: melhorPromocao(produto, promocoes, filialId, (dados.precoUnit ?? item.precoUnit) + extras) })
                setModal(null)
              }}
              aoRemover={() => removerItem(item.uid)}
              aoDescontoItem={() => setModal({ tipo: 'desconto', uid: item.uid })}
              aoTirarDesconto={() => salvarItem(item.uid, { desconto: null })}
            />
          )
        })()}
      {modal?.tipo === 'pagamento' && !modal.contaId && <Pagamento pedido={pedido} totais={totais} caixa={caixa} aoFechar={() => setModal(null)} aoConcluir={vendaConcluida} aoMudarCpf={(cpf) => setPedido((p) => ({ ...p, cliente: { ...p.cliente, cpf } }))} />}
      {modal?.tipo === 'pagamento' && modal.contaId && (
        <Pagamento
          contaId={modal.contaId}
          dividir={modal.dividir}
          caixa={caixa}
          aoFechar={() => setModal({ tipo: 'mesas', mesaId: modal.mesaId })}
          aoConcluir={() => {
            // A conta fechou: se a tela estava lançando nesta mesa, ela fica livre
            if (pedido.mesa?.mesaId === modal.mesaId && !pedido.itens.length) setPedido(pedidoVazio(config.tipoPedidoPadrao))
          }}
          aoVoltarMesas={() => setModal({ tipo: 'mesas' })}
        />
      )}
      {modal?.tipo === 'mesas' && (
        <Mesas
          modo={modal.escolher ? 'escolher' : 'gerir'}
          inicial={modal.mesaId}
          caixa={caixa}
          mesaDoPedido={pedido.mesa?.mesaId}
          aoEscolher={escolherMesaDoPedido}
          aoAdicionar={lancarItensNaMesa}
          aoReceber={receberConta}
          aoDesconto={(conta) => setModal({ tipo: 'desconto-mesa', contaId: conta.id, mesaId: conta.mesaId })}
          aoFechar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'desconto-mesa' &&
        (() => {
          const situacao = situacaoDaConta(modal.contaId)
          if (!situacao) return null
          const conta = situacao.conta
          return (
            <Desconto
              pedido={{ itens: itensDaConta(situacao.pedidos), descontoPedido: null }}
              aoFechar={() => setModal({ tipo: 'mesas', mesaId: modal.mesaId })}
              aoAplicar={(desconto) => {
                descontoNaConta(conta, desconto, usuario)
                setModal({ tipo: 'mesas', mesaId: modal.mesaId })
              }}
            />
          )
        })()}
      {modal?.tipo === 'desconto' && (
        <Desconto
          pedido={pedido}
          item={modal.uid ? pedido.itens.find((i) => i.uid === modal.uid) : null}
          aoFechar={() => setModal(null)}
          aoAplicar={(desconto) => {
            if (modal.uid) salvarItem(modal.uid, { desconto })
            else setPedido((p) => ({ ...p, descontoPedido: desconto }))
            setModal(null)
          }}
        />
      )}
      {modal?.tipo === 'movimento' && <MovimentoCaixa caixa={caixa} aoFechar={() => setModal(null)} />}
      {modal?.tipo === 'fechamento' && <FechamentoCaixa caixa={caixa} aoFechar={() => setModal(null)} />}
      {modal?.tipo === 'pedidos' && <PedidosDoDia aoFechar={() => setModal(null)} />}
      {modal?.tipo === 'esgotados' && <Esgotados aoFechar={() => setModal(null)} />}
      {modal?.tipo === 'comunicados' && <ComunicadosCaixa aoFechar={() => setModal(null)} />}
      {modal?.tipo === 'espera' && <EmEspera lista={emEspera} aoRetomar={retomar} aoFechar={() => setModal(null)} />}
    </div>
  )
}

