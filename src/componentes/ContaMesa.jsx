// A conta de uma mesa: rodadas de pedido (com o andamento na cozinha), itens
// cancelados ou movidos, totais com taxa de serviço, pagamentos parciais e a
// linha do tempo. No caixa vem com as ações; na retaguarda, só para ver.

import { itemAtivo } from '../dados/mesas.js'
import { decorrido, ha, hora } from '../lib/datas.js'
import { reais, valor } from '../lib/dinheiro.js'
import { Botao, Selo } from './ui.jsx'
import { Icone } from './Icone.jsx'
import { Menu } from './Menu.jsx'

export const COZINHA_MESA = {
  novo: ['cinza', 'Na fila da cozinha'],
  preparo: ['laranja', 'Preparando'],
  pronto: ['verde', 'Pronto para servir'],
  entregue: ['azul', 'Servido'],
  cancelado: ['vermelho', 'Cancelado'],
}

function Rodada({ pedido, somenteLeitura, acoes }) {
  const cozinha = pedido.cozinha && COZINHA_MESA[pedido.cozinha.status]
  return (
    <section className="conta-mesa__rodada" aria-label={`${pedido.numero}º pedido`}>
      <header>
        <span>
          <strong>{pedido.numero}º pedido</strong> <span className="mudo">{hora(pedido.criadoEm)}, {pedido.porNome.split(' ')[0]}</span>
          {pedido.movidoDe && <small className="mudo"> · veio da {pedido.movidoDe}</small>}
          {pedido.juntadoDe && <small className="mudo"> · era da {pedido.juntadoDe}</small>}
        </span>
        <span className="linha">
          {cozinha && <Selo tom={cozinha[0]}>{cozinha[1]}</Selo>}
          {!somenteLeitura && pedido.cozinha?.status === 'pronto' && (
            <Botao tamanho="p" icone="check" onClick={() => acoes.servido(pedido)}>
              Servido
            </Botao>
          )}
          {!somenteLeitura && pedido.cozinha && (
            <button type="button" className="botao-icone botao-icone--p" onClick={() => acoes.reimprimir(pedido)} aria-label={`Reimprimir o ${pedido.numero}º pedido na cozinha`} title="Reimprimir na cozinha">
              <Icone nome="imprimir" tamanho={16} />
            </button>
          )}
        </span>
      </header>
      <ul>
        {pedido.itens.map((i) => (
          <li key={i.id} className={i.cancelado ? 'conta-mesa__item--fora' : i.movido ? 'conta-mesa__item--fora' : ''}>
            <span className="conta-mesa__item-nome">
              <span>
                {i.qtd}× {i.nome}
              </span>
              {i.modificadores?.length > 0 && <small className="mudo">{i.modificadores.map((m) => m.nome).join(', ')}</small>}
              {i.obs && <small className="conta-mesa__obs">“{i.obs}”</small>}
              {i.cancelado && (
                <small className="negativo">
                  Cancelado: {i.cancelado.motivo}
                  {i.cancelado.autorizadoPor ? `, autorizado por ${i.cancelado.autorizadoPor}` : ''}
                </small>
              )}
              {i.movido && <small className="mudo">Foi para a {i.movido.para}</small>}
            </span>
            <span className="numero conta-mesa__item-valor">{valor(i.total)}</span>
            {!somenteLeitura && itemAtivo(i) ? (
              <Menu
                rotulo={`Opções de ${i.nome}`}
                icone="opcoes"
                itens={[
                  { rotulo: 'Mover para outra mesa', icone: 'troca', acao: () => acoes.moverItem(pedido, i) },
                  { rotulo: 'Cancelar este item', icone: 'lixeira', perigo: true, acao: () => acoes.cancelarItem(pedido, i) },
                ]}
              />
            ) : (
              !somenteLeitura && <span className="conta-mesa__item-vazio" />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// Linha do tempo: o que aconteceu com a mesa, em ordem
function LinhaDoTempo({ conta, pedidos }) {
  const marcos = [
    ...(conta.eventos || []).map((e) => ({ em: e.em, texto: e.texto, por: e.por })),
    ...pedidos.filter((p) => !p.movidoDe).map((p) => ({ em: p.criadoEm, texto: `${p.numero}º pedido: ${p.itens.reduce((t, i) => t + i.qtd, 0)} item(ns)`, por: p.porNome })),
  ].sort((a, b) => a.em.localeCompare(b.em))
  return (
    <details className="conta-mesa__tempo">
      <summary>Linha do tempo ({marcos.length})</summary>
      <ol>
        {marcos.map((m, i) => (
          <li key={i}>
            <span className="numero">{hora(m.em)}</span>
            <span>
              {m.texto}
              {m.por && <small className="mudo"> · {m.por.split(' ')[0]}</small>}
            </span>
          </li>
        ))}
      </ol>
    </details>
  )
}

export function ContaMesa({ situacao, formas = [], somenteLeitura, acoes = {}, voltar }) {
  const { conta, totais, pedidos } = situacao
  const nomeForma = (id) => formas.find((f) => f.id === id)?.nome || 'Pagamento'
  const temItens = totais.itens.length > 0
  // Sobre o total da conta: depois de um pagamento parcial, dividir só o que falta enganaria
  const porPessoa = conta.pessoas > 1 && totais.total ? Math.ceil(totais.total / conta.pessoas) : null

  return (
    <div className={`conta-mesa ${somenteLeitura ? 'conta-mesa--leitura' : ''}`}>
      <header className="conta-mesa__cabecalho">
        {voltar}
        <div className="linha linha--entre">
          <div>
            {conta.ambienteNome && <p className="conta-mesa__ambiente">{conta.ambienteNome}</p>}
            <h3 className="conta-mesa__titulo">{conta.mesaNome}</h3>
          </div>
          {situacao.estado === 'fechando' ? (
            <Selo tom="azul" icone="recibo">
              Pediu a conta
            </Selo>
          ) : situacao.atencao ? (
            <Selo tom="laranja" icone="relogio">
              {decorrido(conta.ultimoPedidoEm || conta.abertaEm)} sem pedido
            </Selo>
          ) : (
            <Selo tom="amarelo">Ocupada {ha(conta.abertaEm)}</Selo>
          )}
        </div>
        <p className="conta-mesa__meta">
          {[conta.pessoas ? `${conta.pessoas} pessoa(s)` : 'Pessoas não informadas', `aberta às ${hora(conta.abertaEm)} por ${conta.garcomNome.split(' ')[0]}`, conta.clienteNome && `“${conta.clienteNome}”`].filter(Boolean).join(' · ')}
          {!somenteLeitura && (
            <button type="button" className="link" onClick={acoes.editar}>
              mudar
            </button>
          )}
        </p>
      </header>

      <div className="conta-mesa__rodadas">
        {pedidos.length ? (
          pedidos.map((p) => <Rodada key={p.id} pedido={p} somenteLeitura={somenteLeitura} acoes={acoes} />)
        ) : (
          <p className="conta-mesa__vazio">Nenhum pedido ainda. Mesa aberta {ha(conta.abertaEm)}.</p>
        )}
      </div>

      <dl className="conta-mesa__totais numero">
        <div>
          <dt>Consumo</dt>
          <dd>{reais(totais.bruto)}</dd>
        </div>
        {totais.promocoes > 0 && (
          <div className="conta-mesa__economia">
            <dt>Promoções</dt>
            <dd>−{reais(totais.promocoes)}</dd>
          </div>
        )}
        {totais.descontos > 0 && (
          <div className="conta-mesa__economia">
            <dt>
              Descontos{conta.descontoPedido ? ` (${conta.descontoPedido.nome})` : ''}
              {!somenteLeitura && conta.descontoPedido && (
                <button type="button" className="link" onClick={acoes.tirarDesconto}>
                  tirar
                </button>
              )}
            </dt>
            <dd>−{reais(totais.descontos)}</dd>
          </div>
        )}
        <div>
          <dt>
            {conta.servico ? `Taxa de serviço (${conta.servico.percentual}%)` : 'Sem taxa de serviço'}
            {!somenteLeitura && acoes.servico && (
              <button type="button" className="link" onClick={acoes.servico}>
                {conta.servico ? 'tirar' : 'cobrar'}
              </button>
            )}
          </dt>
          <dd>{reais(totais.servico)}</dd>
        </div>
        <div className="conta-mesa__total">
          <dt>Total</dt>
          <dd>{reais(totais.total)}</dd>
        </div>
        {(conta.pagamentos || []).map((p) => (
          <div key={p.id} className="conta-mesa__pago">
            <dt>
              Pago antes: {nomeForma(p.formaId)} <small className="mudo">{hora(p.em)}</small>
              {!somenteLeitura && (
                <button type="button" className="link" onClick={() => acoes.desfazerPagamento(p)}>
                  desfazer
                </button>
              )}
            </dt>
            <dd>−{reais(p.valor - (p.troco || 0))}</dd>
          </div>
        ))}
        {totais.pago > 0 && (
          <div className="conta-mesa__falta">
            <dt>Falta receber</dt>
            <dd>{reais(totais.falta)}</dd>
          </div>
        )}
        {porPessoa && (
          <div className="conta-mesa__pessoa">
            <dt>Por pessoa ({conta.pessoas})</dt>
            <dd>{reais(porPessoa)}</dd>
          </div>
        )}
      </dl>

      <LinhaDoTempo conta={conta} pedidos={pedidos} />

      {!somenteLeitura && (
        <footer className="conta-mesa__acoes">
          <div className="conta-mesa__principais">
            <Botao variante="secundario" icone="mais" onClick={acoes.adicionar}>
              Adicionar itens
            </Botao>
            {temItens ? (
              <Botao onClick={acoes.receber} icone="dinheiro">
                Fechar conta <span className="numero">{reais(totais.falta)}</span>
              </Botao>
            ) : (
              <Botao variante="secundario" onClick={acoes.cancelar} icone="sair">
                Liberar mesa
              </Botao>
            )}
          </div>
          <div className="conta-mesa__secundarias">
            <button type="button" onClick={acoes.preconta} disabled={!temItens}>
              <Icone nome="imprimir" tamanho={18} /> Pré-conta
            </button>
            <button type="button" onClick={acoes.receberParte} disabled={!temItens || !totais.falta}>
              <Icone nome="dividir" tamanho={18} /> Dividir
            </button>
            <button type="button" onClick={acoes.transferir}>
              <Icone nome="troca" tamanho={18} /> Trocar de mesa
            </button>
            <button type="button" onClick={acoes.juntar}>
              <Icone nome="juntar" tamanho={18} /> Juntar
            </button>
            <Menu
              rotulo="Mais opções da conta"
              icone="opcoes"
              itens={[
                { rotulo: 'Desconto na conta', icone: 'porcento', acao: acoes.desconto, desabilitado: !temItens },
                ...(situacao.estado === 'fechando' ? [{ rotulo: 'Voltar para ocupada', icone: 'desfazer', acao: acoes.reabrir }] : []),
                { rotulo: 'Pessoas e nome da mesa', icone: 'pessoas', acao: acoes.editar },
                { separador: true },
                temItens || conta.itensCancelados?.length ? { rotulo: 'Cancelar a conta', icone: 'lixeira', perigo: true, acao: acoes.cancelar } : { rotulo: 'Liberar a mesa', icone: 'sair', acao: acoes.cancelar },
              ]}
            />
          </div>
        </footer>
      )}
    </div>
  )
}
