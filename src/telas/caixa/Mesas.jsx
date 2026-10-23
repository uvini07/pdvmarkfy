// Mesas no caixa: o mapa (ou a lista) com a situação de cada mesa. Daqui o
// atendente abre a mesa, vê a conta, lança mais, troca de mesa, junta, divide
// e fecha. A mesma janela serve para escolher a mesa do pedido que está na tela.

import { useState } from 'react'
import { useColecao, useDoc } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import {
  abrirConta,
  alterarConta,
  alterarServico,
  avancarCozinhaMesa,
  cancelarConta,
  cancelarItemLancado,
  descontoNaConta,
  desfazerPagamento,
  itensAgrupados,
  juntarContas,
  marcarContaPedida,
  moverItens,
  reabrirConta,
  rodadaParaImpressao,
  transferirConta,
} from '../../dados/mesas.js'
import { useSessao } from '../../estado/sessao.js'
import { Modal } from '../../componentes/Modal.jsx'
import { Botao, Campo, Entrada, Segmentos, Vazio, useRelogio } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { avisar, confirmar, escolher, pedirAutorizacao } from '../../componentes/dialogos.jsx'
import { imprimir } from '../../componentes/Impressao.jsx'
import { ContaMesa } from '../../componentes/ContaMesa.jsx'
import { AnaliseMesas, LegendaSalao, ListaMesas, MapaSalao, gruposDaLista, useSalao } from '../../componentes/Salao.jsx'
import { ha } from '../../lib/datas.js'
import { reais } from '../../lib/dinheiro.js'

const CHAVE_VISTA = 'scpdv:mesas-vista'
// Sem preferência guardada: celular vê a lista; salão grande, a análise
function lerVista(totalMesas) {
  const padrao = () => (window.matchMedia('(max-width: 599.98px)').matches ? 'lista' : totalMesas > 40 ? 'analise' : 'mapa')
  try {
    return localStorage.getItem(CHAVE_VISTA) || padrao()
  } catch {
    return padrao()
  }
}

const FILTROS = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'livres', rotulo: 'Livres' },
  { valor: 'ocupadas', rotulo: 'Ocupadas' },
  { valor: 'fechando', rotulo: 'Pediram a conta' },
  { valor: 'atencao', rotulo: 'Pedem atenção' },
]

function EscolhaPessoas({ valor, lugares, aoMudar }) {
  const opcoes = Array.from({ length: Math.min(12, Math.max(6, (lugares || 4) + 2)) }, (_, i) => i + 1)
  return (
    <div>
      <p className="campo__rotulo">Quantas pessoas?</p>
      <div className="pessoas-mesa" role="radiogroup" aria-label="Quantas pessoas">
        {opcoes.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={valor === n} onClick={() => aoMudar(valor === n ? 0 : n)} className="pessoas-mesa__opcao numero">
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Mesas({ modo = 'gerir', inicial, caixa, mesaDoPedido, aoEscolher, aoAdicionar, aoReceber, aoDesconto, aoFechar }) {
  const { usuario, filial, pdv, pode } = useSessao()
  const config = useDoc('config')
  const formas = useColecao('formasPagamento')
  const motivos = useColecao('motivosCancelamento').filter((m) => m.ativo)
  const agora = useRelogio(15_000)
  const salao = useSalao(filial.id, agora)
  const [mesaId, setMesaId] = useState(inicial || null)
  const [vista, setVista] = useState(() => lerVista(salao.mesas.length))
  const inicialAmb = salao.mesas.find((m) => m.id === (inicial || mesaDoPedido))?.ambienteId
  const [ambienteId, setAmbienteId] = useState(inicialAmb || salao.ambientes[0]?.id)
  const [filtro, setFiltro] = useState('todas')
  const [acao, setAcao] = useState(null)
  const [busca, setBusca] = useState('')
  const [abrindo, setAbrindo] = useState({ pessoas: 0, nome: '' })
  const [editando, setEditando] = useState(null)
  const servicoPadrao = config.servicoPercentual ?? 10

  const ambiente = salao.ambientes.find((a) => a.id === ambienteId) || salao.ambientes[0]
  const fora = salao.foraDoMapa.find((f) => f.mesa.id === mesaId)
  const mesa = salao.mesas.find((m) => m.id === mesaId) || fora?.mesa || null
  const situacao = mesa ? salao.situacoes.get(mesa.id) || fora?.situacao : null

  const trocarVista = (v) => {
    setVista(v)
    try {
      localStorage.setItem(CHAVE_VISTA, v)
    } catch {
      // sem armazenamento: só não lembra
    }
  }

  const tocarMesa = (m) => {
    if (acao) return escolherDestino(m)
    setMesaId(m.id)
    setAbrindo({ pessoas: 0, nome: '' })
    if (m.ambienteId) setAmbienteId(m.ambienteId)
  }

  const abrirPorNumero = (e) => {
    e.preventDefault()
    const t = busca.trim().toLowerCase()
    if (!t) return
    const exata = salao.mesas.find((x) => String(x.numero).toLowerCase() === t || x.nome.toLowerCase() === t)
    // Na análise, se só sobrou uma mesa com esse começo, Enter abre ela
    const comeco = salao.mesas.filter((x) => String(x.numero).toLowerCase().startsWith(t))
    const m = exata || (vista === 'analise' && comeco.length === 1 ? comeco[0] : null)
    if (!m) return avisar(`Não achei a mesa “${busca.trim()}”.`, 'erro')
    setBusca('')
    tocarMesa(m)
  }

  // ---------- Escolher a mesa de destino (trocar, juntar, mover) ----------

  const podeTocar = acao
    ? (m, s) => m.id !== acao.conta.mesaId && m.ativa !== false && (acao.tipo !== 'juntar' || Boolean(s?.conta))
    : modo === 'escolher'
      ? (m) => m.ativa !== false
      : undefined

  async function escolherDestino(m) {
    const s = salao.situacoes.get(m.id)
    const origem = acao.conta
    if (!podeTocar(m, s)) return
    try {
      if (acao.tipo === 'transferir') {
        if (s?.conta) {
          const ok = await confirmar({
            titulo: `A ${m.nome} está ocupada`,
            texto: `Juntar as contas? Tudo da ${origem.mesaNome} passa para a ${m.nome}, e a ${origem.mesaNome} fica livre.`,
            botao: `Juntar na ${m.nome}`,
          })
          if (!ok) return
          juntarContas({ origem, destino: s.conta, usuario })
          avisar(`${origem.mesaNome} juntada na ${m.nome}`)
        } else {
          const ok = await confirmar({ titulo: `Trocar para a ${m.nome}?`, texto: `A conta inteira da ${origem.mesaNome} vai para a ${m.nome}. A cozinha passa a entregar lá.`, botao: 'Trocar de mesa' })
          if (!ok) return
          transferirConta({ conta: origem, mesa: m, usuario })
          avisar(`Conta da ${origem.mesaNome} agora na ${m.nome}`)
        }
        setMesaId(m.id)
      } else if (acao.tipo === 'juntar') {
        const ok = await confirmar({ titulo: `Juntar a ${m.nome} nesta conta?`, texto: `Tudo da ${m.nome} (${reais(s.totais.total)}) passa para a ${origem.mesaNome}, e a ${m.nome} fica livre.`, botao: 'Juntar as mesas' })
        if (!ok) return
        juntarContas({ origem: s.conta, destino: origem, usuario })
        avisar(`${m.nome} juntada na ${origem.mesaNome}`)
      } else if (acao.tipo === 'mover') {
        const ok = await confirmar({
          titulo: `Mover para a ${m.nome}?`,
          texto: `${acao.texto} sai da ${origem.mesaNome} e entra na conta da ${m.nome}${s?.conta ? '' : ', que abre agora'}. A cozinha não faz de novo.`,
          botao: 'Mover',
        })
        if (!ok) return
        const destino = s?.conta || abrirConta({ filialId: filial.id, mesa: m, usuario, servicoPercentual: servicoPadrao })
        moverItens({ origem, destino, selecao: acao.selecao, usuario })
        avisar(`${acao.texto} foi para a ${m.nome}`)
      }
      setAcao(null)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  // ---------- Mesa livre ----------

  const abrirMesa = (lancar) => {
    try {
      const conta = abrirConta({ filialId: filial.id, mesa, pessoas: abrindo.pessoas, clienteNome: abrindo.nome, usuario, servicoPercentual: servicoPadrao })
      avisar(`${mesa.nome} aberta`)
      if (lancar) aoAdicionar(mesa, conta)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  // ---------- Ações da conta ----------

  const autorizar = async (permissao, texto) => {
    if (pode(permissao)) return usuario
    return pedirAutorizacao({ permissao, acao: texto, filialId: filial.id })
  }

  const quantasUnidades = async (item, para) => {
    if (item.qtd === 1) return 1
    const opcoes = Array.from({ length: Math.min(item.qtd - 1, 9) }, (_, i) => `${i + 1} de ${item.qtd}`)
    opcoes.push(`Todas as ${item.qtd}`)
    const r = await escolher({ titulo: `Quantas unidades de ${item.nome}?`, subtitulo: `Para ${para}.`, opcoes })
    if (!r) return 0
    return r.startsWith('Todas') ? item.qtd : Number(r.split(' ')[0])
  }

  const cancelarItem = async (conta, pedido, item) => {
    const autorizador = await autorizar('caixa.cancelarItem', `Cancelar ${item.nome} da ${conta.mesaNome}`)
    if (!autorizador) return
    const qtd = await quantasUnidades(item, 'cancelar')
    if (!qtd) return
    const naCozinha = pedido.cozinha && ['novo', 'preparo'].includes(pedido.cozinha.status) && item.setor === 'cozinha'
    const motivo = await escolher({
      titulo: `Cancelar ${qtd}× ${item.nome}?`,
      subtitulo: naCozinha ? 'A cozinha vê o item riscado na hora. Escolha o motivo.' : 'Fica registrado nos cancelamentos. Escolha o motivo.',
      opcoes: motivos.map((m) => m.nome),
    })
    if (!motivo) return
    try {
      cancelarItemLancado({ pedido, itemId: item.id, qtd, motivo, usuario, autorizador })
      avisar('Item cancelado', 'info')
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  const moverItem = async (conta, pedido, item) => {
    const qtd = await quantasUnidades(item, 'mover para outra mesa')
    if (!qtd) return
    setAcao({ tipo: 'mover', conta, selecao: [{ pedidoId: pedido.id, itemId: item.id, qtd }], texto: `${qtd}× ${item.nome}` })
  }

  const cancelar = async (s) => {
    const conta = s.conta
    if (conta.pagamentos?.length) return avisar('Esta conta já tem pagamento. Desfaça os pagamentos (devolvendo o dinheiro) antes de cancelar.', 'erro')
    const vazia = !s.totais.itens.length && !conta.itensCancelados?.length
    try {
      if (vazia) {
        const ok = await confirmar({ titulo: `Liberar a ${conta.mesaNome}?`, texto: 'Nada foi lançado nesta mesa. Ela volta a ficar livre.', botao: 'Liberar mesa' })
        if (!ok) return
        cancelarConta({ conta, motivo: 'Mesa liberada', usuario, pdvId: pdv.id, caixaId: caixa?.id })
        avisar(`${conta.mesaNome} liberada`, 'info')
      } else {
        const autorizador = await autorizar('caixa.cancelarItem', `Cancelar a conta da ${conta.mesaNome}`)
        if (!autorizador) return
        const motivo = await escolher({ titulo: `Cancelar a conta da ${conta.mesaNome}?`, subtitulo: `${s.totais.quantidade} item(ns), ${reais(s.totais.total)}. Fica nos cancelamentos. Escolha o motivo.`, opcoes: motivos.map((m) => m.nome) })
        if (!motivo) return
        const ok = await confirmar({ titulo: 'Cancelar mesmo?', texto: `A conta da ${conta.mesaNome} é cancelada, o que está na cozinha para de ser feito e a mesa fica livre.`, botao: 'Cancelar a conta', perigo: true, cancelar: 'Voltar' })
        if (!ok) return
        cancelarConta({ conta, motivo, usuario, autorizador, pdvId: pdv.id, caixaId: caixa?.id })
        avisar(`Conta da ${conta.mesaNome} cancelada`, 'info')
      }
      setMesaId(null)
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  const desfazer = async (conta, p) => {
    const quanto = reais(p.valor - (p.troco || 0))
    const autorizador = await autorizar('caixa.cancelarVenda', `Desfazer pagamento de ${quanto} da ${conta.mesaNome}`)
    if (!autorizador) return
    const forma = formas.find((f) => f.id === p.formaId)?.nome || 'na mesma forma'
    const ok = await confirmar({ titulo: 'Desfazer este pagamento?', texto: `Devolva ${quanto} ao cliente (${forma}). O valor volta a faltar na conta.`, botao: 'Desfazer pagamento', perigo: true })
    if (!ok) return
    try {
      desfazerPagamento({ conta, pagamentoId: p.id, usuario, autorizador })
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  const acoesDa = (s) => ({
    adicionar: () => aoAdicionar(mesa, s.conta),
    receber: () => aoReceber(s.conta),
    receberParte: () => aoReceber(s.conta, { dividir: true }),
    preconta: () => {
      imprimir('preconta', { conta: s.conta, totais: s.totais, itens: itensAgrupados(s.totais.itens) })
      if (s.conta.status === 'aberta') marcarContaPedida(s.conta, usuario)
    },
    desconto: () => aoDesconto(s.conta),
    tirarDesconto: () => descontoNaConta(s.conta, null, usuario),
    servico:
      s.conta.servico || servicoPadrao
        ? async () => {
            if (!s.conta.servico) return alterarServico(s.conta, servicoPadrao, usuario)
            const ok = await confirmar({ titulo: 'Tirar a taxa de serviço?', texto: 'A taxa é opcional para o cliente. Fica registrado quem tirou.', botao: 'Tirar a taxa' })
            if (ok) alterarServico(s.conta, 0, usuario)
          }
        : undefined,
    transferir: () => setAcao({ tipo: 'transferir', conta: s.conta }),
    juntar: () => setAcao({ tipo: 'juntar', conta: s.conta }),
    editar: () => setEditando({ conta: s.conta, pessoas: s.conta.pessoas || 0, nome: s.conta.clienteNome || '' }),
    reabrir: () => reabrirConta(s.conta, usuario),
    cancelar: () => cancelar(s),
    cancelarItem: (pedido, item) => cancelarItem(s.conta, pedido, item),
    moverItem: (pedido, item) => moverItem(s.conta, pedido, item),
    servido: (pedido) => avancarCozinhaMesa(pedido.id, 'entregue'),
    reimprimir: (pedido) => {
      if (!pode('caixa.reimprimir')) return avisar('Seu perfil não pode reimprimir.', 'erro')
      registrar('venda.reimpressao', `Comanda do ${pedido.numero}º pedido da ${s.conta.mesaNome}`, { usuario, filialId: filial.id })
      imprimir('comanda', rodadaParaImpressao(pedido, s.conta))
    },
    desfazerPagamento: (p) => desfazer(s.conta, p),
  })

  // ---------- Tela ----------

  const textoAcao = acao && {
    transferir: `Toque na mesa para onde a ${acao.conta.mesaNome} vai. Se ela estiver ocupada, as contas se juntam.`,
    juntar: `Toque na mesa ocupada que vai se juntar à ${acao.conta.mesaNome}.`,
    mover: `Toque na mesa que fica com ${acao.texto}.`,
  }[acao.tipo]

  const resumo = salao.total
    ? `${salao.ocupadas} de ${salao.total} ocupadas${salao.emAberto ? ` · ${reais(salao.emAberto)} em aberto` : ''}${salao.pessoas ? ` · ${salao.pessoas} pessoa(s)` : ''}`
    : filial.nome

  const voltar = (
    <button type="button" className="link-voltar mesas-caixa__voltar" onClick={() => setMesaId(null)}>
      <Icone nome="seta-esq" tamanho={16} /> Todas as mesas
    </button>
  )

  return (
    <Modal aberto aoFechar={aoFechar} titulo={modo === 'escolher' ? 'Para qual mesa?' : 'Mesas'} subtitulo={resumo} largura="gg" className="tema-escuro mesas-caixa">
      {!salao.mesas.length && !salao.foraDoMapa.length ? (
        <Vazio mascote titulo="Esta loja ainda não tem o salão montado" texto="O gerente desenha as mesas em Retaguarda › Salão e mesas › Montar o salão. Depois elas aparecem aqui." />
      ) : (
        <div className={`mesas-caixa__layout ${mesa ? 'mesas-caixa__layout--detalhe' : ''}`}>
          <section className="mesas-caixa__mapa" aria-label="Mapa das mesas">
            <div className="mesas-caixa__barra">
              {vista === 'mapa' && salao.ambientes.length > 1 && (
                <Segmentos rotulo="Ambiente" tamanho="p" valor={ambiente?.id} aoMudar={setAmbienteId} opcoes={salao.ambientes.map((a) => ({ valor: a.id, rotulo: a.nome }))} />
              )}
              {vista === 'lista' && <Segmentos rotulo="Filtro" tamanho="p" valor={filtro} aoMudar={setFiltro} opcoes={FILTROS} />}
              <div className="mesas-caixa__ferramentas">
                <form onSubmit={abrirPorNumero} className="mesas-caixa__busca">
                  <Entrada icone="busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Mesa nº" aria-label={vista === 'analise' ? 'Filtrar e abrir mesa pelo número' : 'Abrir mesa pelo número'} inputMode="text" />
                </form>
                <Segmentos
                  rotulo="Ver como"
                  tamanho="p"
                  valor={vista}
                  aoMudar={trocarVista}
                  opcoes={[
                    { valor: 'mapa', rotulo: 'Mapa', icone: 'mesa' },
                    { valor: 'analise', rotulo: 'Análise', icone: 'grade' },
                    { valor: 'lista', rotulo: 'Lista', icone: 'lista' },
                  ]}
                />
              </div>
            </div>

            {acao && (
              <div className="mesas-caixa__acao" role="status">
                <Icone nome={acao.tipo === 'juntar' ? 'juntar' : 'troca'} tamanho={20} />
                <span>{textoAcao}</span>
                <Botao variante="secundario" tamanho="p" onClick={() => setAcao(null)}>
                  Cancelar
                </Botao>
              </div>
            )}

            {vista === 'mapa' && ambiente ? (
              <MapaSalao ambiente={ambiente} situacoes={salao.situacoes} aoTocar={tocarMesa} escolhida={mesaId || mesaDoPedido} podeTocar={podeTocar} rotulo={`Mesas de ${ambiente.nome}`} />
            ) : vista === 'analise' ? (
              <AnaliseMesas salao={salao} aoTocar={tocarMesa} escolhida={mesaId || mesaDoPedido} podeTocar={podeTocar} busca={busca} />
            ) : (
              <ListaMesas grupos={gruposDaLista(salao, acao ? 'todas' : filtro)} aoTocar={tocarMesa} escolhida={mesaId || mesaDoPedido} podeTocar={podeTocar} />
            )}
            {vista === 'mapa' && salao.foraDoMapa.length > 0 && (
              <p className="mesas-caixa__fora">
                <Icone nome="alerta" tamanho={16} /> {salao.foraDoMapa.length} conta(s) em mesa que saiu do mapa: veja na lista.
              </p>
            )}
            {vista !== 'analise' && <LegendaSalao salao={salao} />}
          </section>

          {mesa && (
            <aside className="mesas-caixa__detalhe" aria-label={mesa.nome}>
              {situacao?.conta ? (
                modo === 'escolher' ? (
                  <div className="mesa-livre">
                    {voltar}
                    <p className="conta-mesa__ambiente">{mesa.ambienteNome}</p>
                    <h3 className="conta-mesa__titulo">{mesa.nome}</h3>
                    <p className="mudo">
                      Ocupada {ha(situacao.conta.abertaEm)}
                      {situacao.conta.pessoas ? `, ${situacao.conta.pessoas} pessoa(s)` : ''}, {situacao.pedidos.length} pedido(s), {reais(situacao.totais.total)}
                    </p>
                    <Botao tamanho="g" bloco icone="mesa" onClick={() => aoEscolher(mesa, { conta: situacao.conta })}>
                      Lançar na conta da {mesa.nome}
                    </Botao>
                  </div>
                ) : (
                  <ContaMesa situacao={situacao} formas={formas} acoes={acoesDa(situacao)} voltar={voltar} />
                )
              ) : situacao?.estado === 'inativa' ? (
                <div className="mesa-livre">
                  {voltar}
                  <h3 className="conta-mesa__titulo">{mesa.nome}</h3>
                  <p className="mudo">Fora de uso. Para usar de novo, ligue “Em uso” em Retaguarda › Montar o salão.</p>
                </div>
              ) : (
                <div className="mesa-livre">
                  {voltar}
                  <p className="conta-mesa__ambiente">{mesa.ambienteNome}</p>
                  <h3 className="conta-mesa__titulo">{mesa.nome}</h3>
                  <p className="mudo">Livre{mesa.lugares ? `, ${mesa.lugares} lugar(es)` : ''}</p>
                  {config.perguntarPessoas !== false && <EscolhaPessoas valor={abrindo.pessoas} lugares={mesa.lugares} aoMudar={(pessoas) => setAbrindo((a) => ({ ...a, pessoas }))} />}
                  <Campo rotulo="Nome ou observação (opcional)">
                    {(p) => <Entrada {...p} value={abrindo.nome} onChange={(e) => setAbrindo((a) => ({ ...a, nome: e.target.value }))} maxLength={40} placeholder="Ex.: Aniversário da Bia" />}
                  </Campo>
                  {modo === 'escolher' ? (
                    <Botao tamanho="g" bloco icone="mesa" onClick={() => aoEscolher(mesa, { pessoas: abrindo.pessoas, clienteNome: abrindo.nome })}>
                      Pôr o pedido na {mesa.nome}
                    </Botao>
                  ) : (
                    <>
                      <Botao tamanho="g" bloco icone="mais" onClick={() => abrirMesa(true)}>
                        Abrir e lançar pedido
                      </Botao>
                      <Botao variante="secundario" bloco onClick={() => abrirMesa(false)}>
                        Só abrir a mesa (pedem depois)
                      </Botao>
                    </>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {editando && (
        <Modal
          aberto
          aoFechar={() => setEditando(null)}
          titulo={editando.conta.mesaNome}
          largura="p"
          className="tema-escuro"
          rodape={
            <>
              <Botao variante="secundario" onClick={() => setEditando(null)}>
                Voltar
              </Botao>
              <Botao
                onClick={() => {
                  alterarConta(editando.conta, { pessoas: editando.pessoas, clienteNome: editando.nome }, usuario)
                  setEditando(null)
                }}
              >
                Salvar
              </Botao>
            </>
          }
        >
          <div className="pilha">
            <EscolhaPessoas valor={editando.pessoas} lugares={situacao?.conta && mesa?.lugares} aoMudar={(pessoas) => setEditando((d) => ({ ...d, pessoas }))} />
            <Campo rotulo="Nome ou observação">{(p) => <Entrada {...p} value={editando.nome} onChange={(e) => setEditando((d) => ({ ...d, nome: e.target.value }))} maxLength={40} />}</Campo>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
