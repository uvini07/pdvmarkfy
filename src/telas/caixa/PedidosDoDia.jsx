// Pedidos de hoje nesta loja: reimprimir, ver detalhes e cancelar.

import { useMemo, useState } from 'react'
import { Modal } from '../../componentes/Modal.jsx'
import { Botao, Entrada, Selo } from '../../componentes/ui.jsx'
import { avisar, confirmar, escolher, pedirAutorizacao } from '../../componentes/dialogos.jsx'
import { imprimir } from '../../componentes/Impressao.jsx'
import { useColecao } from '../../dados/banco.js'
import { cancelarVenda, estornarVenda, nomeTipoPedido, rotuloPedido } from '../../dados/vendas.js'
import { registrar } from '../../dados/auditoria.js'
import { useSessao } from '../../estado/sessao.js'
import { hoje, hora } from '../../lib/datas.js'
import { reais } from '../../lib/dinheiro.js'

const SELO = { concluida: ['verde', 'Concluída'], cancelada: ['vermelho', 'Cancelada'], estornada: ['laranja', 'Estornada'] }
const COZINHA = { novo: 'Na fila', preparo: 'Preparando', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado' }

export function PedidosDoDia({ aoFechar }) {
  const { filial, usuario, pode } = useSessao()
  const vendas = useColecao('vendas')
  const caixas = useColecao('caixas')
  const formas = useColecao('formasPagamento')
  const motivos = useColecao('motivosCancelamento').filter((m) => m.ativo)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(null)

  const dia = hoje()
  const lista = useMemo(
    () =>
      vendas
        .filter((v) => v.filialId === filial.id && v.dia === dia && v.numero)
        .filter((v) => !busca || String(v.numero).includes(busca.replace(/^0+/, '')) || rotuloPedido(v).toLowerCase().includes(busca.toLowerCase()))
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    [vendas, filial.id, dia, busca],
  )

  const venda = aberto && vendas.find((v) => v.id === aberto)

  const encerrar = async (v) => {
    const caixaDaVenda = caixas.find((c) => c.id === v.caixaId)
    const estorno = caixaDaVenda && caixaDaVenda.status !== 'aberto'
    const permissao = estorno ? 'caixa.estornar' : 'caixa.cancelarVenda'
    const acao = `${estorno ? 'Estornar' : 'Cancelar'} o pedido ${v.numero} (${reais(v.total + (v.servico || 0))})`
    let autorizador = usuario
    if (!pode(permissao)) {
      autorizador = await pedirAutorizacao({ permissao, acao, filialId: filial.id })
      if (!autorizador) return
    }
    const motivo = await escolher({ titulo: `${estorno ? 'Estornar' : 'Cancelar'} o pedido ${v.numero}?`, subtitulo: 'O valor sai do caixa e o estoque volta. Escolha o motivo.', opcoes: motivos.map((m) => m.nome) })
    if (!motivo) return
    const ok = await confirmar({ titulo: 'Confirmar?', texto: `${acao}. Devolva ${reais(v.total + (v.servico || 0))} ao cliente na mesma forma de pagamento.`, botao: estorno ? 'Estornar' : 'Cancelar pedido', perigo: true })
    if (!ok) return
    try {
      ;(estorno ? estornarVenda : cancelarVenda)(v.id, { motivo, usuario, autorizador })
      avisar(`Pedido ${v.numero} ${estorno ? 'estornado' : 'cancelado'}`, 'info')
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  const reimprimir = (tipo, v) => {
    if (!pode('caixa.reimprimir')) return avisar('Seu perfil não pode reimprimir.', 'erro')
    registrar('venda.reimpressao', `${tipo === 'cupom' ? 'Cupom' : 'Comanda'} do pedido ${v.numero}`, { usuario, filialId: v.filialId })
    imprimir(tipo, v)
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Pedidos de hoje" subtitulo={`${filial.nome}, ${lista.length} pedido(s). Mesa entra quando a conta fecha.`} largura="gg" className="tema-escuro pedidos-dia">
      <div className="pedidos-dia__layout">
        <div className="pedidos-dia__lista">
          <Entrada icone="busca" placeholder="Número, nome ou mesa" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar pedido" />
          <ul className="rolagem">
            {lista.map((v) => (
              <li key={v.id}>
                <button type="button" className={`pedido-linha ${aberto === v.id ? 'pedido-linha--ativo' : ''}`} onClick={() => setAberto(v.id)}>
                  <span className="pedido-linha__numero numero">{String(v.numero).padStart(3, '0')}</span>
                  <span className="pedido-linha__info">
                    <strong>{rotuloPedido(v)}</strong>
                    <small>
                      {hora(v.criadoEm)}, {v.itens.reduce((t, i) => t + i.qtd, 0)} item(ns)
                    </small>
                  </span>
                  <span className="pedido-linha__valor">
                    <strong className="numero">{reais(v.total + (v.servico || 0))}</strong>
                    <Selo tom={SELO[v.status][0]}>{SELO[v.status][1]}</Selo>
                  </span>
                </button>
              </li>
            ))}
            {!lista.length && <li className="mudo pedidos-dia__vazio">Nenhum pedido ainda hoje.</li>}
          </ul>
        </div>

        <div className="pedidos-dia__detalhe">
          {!venda ? (
            <p className="mudo">Escolha um pedido para ver os detalhes.</p>
          ) : (
            <>
              <div className="linha linha--entre">
                <h3>Pedido {String(venda.numero).padStart(3, '0')}</h3>
                <Selo tom={SELO[venda.status][0]}>{SELO[venda.status][1]}</Selo>
              </div>
              <p className="mudo">
                {hora(venda.criadoEm)}, {venda.mesa ? `${venda.mesa.nome}${venda.mesa.ambienteNome ? ` (${venda.mesa.ambienteNome})` : ''}` : nomeTipoPedido(venda.tipo)}, por {venda.operadorNome}
                {venda.cozinha && `. Cozinha: ${COZINHA[venda.cozinha.status]}`}
              </p>
              <ul className="lista-simples">
                {venda.itens.map((i, n) => (
                  <li key={n}>
                    <span>
                      {i.qtd}× {i.nome}
                      {i.modificadores?.length > 0 && <small className="mudo"> {i.modificadores.map((m) => m.nome).join(', ')}</small>}
                    </span>
                    <span className="numero">{reais(i.total)}</span>
                  </li>
                ))}
                {venda.descontos > 0 && (
                  <li>
                    <span>Descontos</span>
                    <span className="numero">−{reais(venda.descontos)}</span>
                  </li>
                )}
                {venda.servico > 0 && (
                  <li>
                    <span>Taxa de serviço</span>
                    <span className="numero">{reais(venda.servico)}</span>
                  </li>
                )}
                <li className="forte">
                  <span>Total</span>
                  <span className="numero">{reais(venda.total + (venda.servico || 0))}</span>
                </li>
                {venda.pagamentos.map((p, n) => (
                  <li key={`p${n}`} className="mudo">
                    <span>{formas.find((f) => f.id === p.formaId)?.nome}</span>
                    <span className="numero">{reais(p.valor)}</span>
                  </li>
                ))}
              </ul>
              {venda.encerramento && (
                <p className="mudo">
                  {venda.status === 'cancelada' ? 'Cancelado' : 'Estornado'} por {venda.encerramento.usuarioNome}: {venda.encerramento.motivo}
                </p>
              )}
              <div className="linha linha--quebra">
                <Botao variante="secundario" tamanho="p" icone="imprimir" onClick={() => reimprimir('cupom', venda)}>
                  Cupom
                </Botao>
                {venda.cozinha && (
                  <Botao variante="secundario" tamanho="p" icone="cozinha" onClick={() => reimprimir('comanda', venda)}>
                    Comanda
                  </Botao>
                )}
                {venda.status === 'concluida' && (
                  <Botao variante="perigo" tamanho="p" icone="fechar" onClick={() => encerrar(venda)}>
                    Cancelar pedido
                  </Botao>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
