// Frente de caixa. Layout dos PDVs de balcão mais usados (Toast, Square,
// Saipos): grupos à esquerda, produtos com foto no meio e a comanda à direita,
// com o botão de cobrar sempre à vista. Tudo pensado para toque e pressa.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useColecao, useDoc } from '../../dados/banco.js'
import { useSessao, sessao } from '../../estado/sessao.js'
import { caixaAbertoDoPdv } from '../../dados/caixa.js'
import { melhorPromocao, precoNaFilial, estaPausado } from '../../dados/precos.js'
import { registrarPedidoCancelado, totaisPedido, totalItem } from '../../dados/vendas.js'
import { avisar, confirmar, escolher, pedirAutorizacao } from '../../componentes/dialogos.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { Logo, useRelogio } from '../../componentes/ui.jsx'
import { Menu } from '../../componentes/Menu.jsx'
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

const novoUid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

const pedidoVazio = (tipo = 'balcao') => ({ itens: [], tipo, cliente: { nome: '', cpf: '' }, descontoPedido: null, itensCancelados: [], obs: '' })

// O pedido em andamento sobrevive a recarregar a página ou cair a energia.
const chavePedido = (pdvId) => `scpdv:pedido:${pdvId}`
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
  const [ultimoAdicionado, setUltimoAdicionado] = useState(null)
  const [verComanda, setVerComanda] = useState(false)
  const [emEspera, setEmEspera] = useState(() => lerEspera(pdvId))
  const buscaRef = useRef(null)

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

  const colocarEmEspera = () => {
    if (!pedido.itens.length) return
    const lista = [...emEspera, { ...pedido, id: novoUid(), em: new Date().toISOString(), rotulo: pedido.cliente.nome || `Espera ${emEspera.length + 1}` }]
    setEmEspera(lista)
    gravarEspera(pdvId, lista)
    setPedido(pedidoVazio(config.tipoPedidoPadrao))
    avisar('Pedido em espera', 'info')
  }

  const retomar = (id) => {
    const alvo = emEspera.find((e) => e.id === id)
    let lista = emEspera.filter((e) => e.id !== id)
    if (pedido.itens.length) lista = [...lista, { ...pedido, id: novoUid(), em: new Date().toISOString(), rotulo: pedido.cliente.nome || `Espera ${lista.length + 1}` }]
    setEmEspera(lista)
    gravarEspera(pdvId, lista)
    const { id: _id, em: _em, rotulo: _r, ...resto } = alvo
    setPedido(resto)
    setModal(null)
  }

  // ---------- Cobrar ----------

  const cobrar = () => {
    if (!pedido.itens.length) return avisar('Adicione um produto antes de cobrar.', 'info')
    setModal({ tipo: 'pagamento' })
  }

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
        if (pedido.itens.length) setModal({ tipo: 'desconto' })
      } else if (e.key === 'F4') {
        e.preventDefault()
        colocarEmEspera()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  // ---------- Operações do caixa ----------

  const fecharCaixaComPermissao = async () => {
    if (pedido.itens.length) return avisar('Termine ou coloque em espera o pedido atual antes de fechar o caixa.', 'erro')
    if (!pode('caixa.fechar')) {
      const ok = await pedirAutorizacao({ permissao: 'caixa.fechar', acao: 'Fechar o caixa', filialId })
      if (!ok) return
    }
    setCaixaEmFechamento(caixa)
    setModal({ tipo: 'fechamento' })
  }

  const menu = [
    { rotulo: 'Pedidos de hoje', icone: 'lista', acao: () => setModal({ tipo: 'pedidos' }) },
    { rotulo: 'Sangria ou suprimento', icone: 'dinheiro', acao: () => setModal({ tipo: 'movimento' }) },
    { rotulo: 'Produtos esgotados', icone: 'pausa', acao: () => setModal({ tipo: 'esgotados' }) },
    { rotulo: 'Fechar o caixa', icone: 'cadeado', acao: fecharCaixaComPermissao },
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

  if (!caixa) return <AberturaCaixa />

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
            <button type="button" className="caixa__chip caixa__chip--alerta" onClick={() => setModal({ tipo: 'comunicados' })}>
              <Icone nome="megafone" tamanho={18} /> {naoLidos} comunicado{naoLidos > 1 ? 's' : ''}
            </button>
          )}
          {emEspera.length > 0 && (
            <button type="button" className="caixa__chip" onClick={() => setModal({ tipo: 'espera' })}>
              <Icone nome="espera" tamanho={18} /> {emEspera.length} em espera
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
      />

      <button type="button" className="caixa__barra-movel" onClick={() => setVerComanda(true)}>
        <span>
          <Icone nome="recibo" tamanho={20} /> Ver pedido ({totais.quantidade})
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
      {modal?.tipo === 'pagamento' && <Pagamento pedido={pedido} totais={totais} caixa={caixa} aoFechar={() => setModal(null)} aoConcluir={vendaConcluida} aoMudarCpf={(cpf) => setPedido((p) => ({ ...p, cliente: { ...p.cliente, cpf } }))} />}
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

