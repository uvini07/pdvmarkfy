// A comanda: o papel do pedido, em branco sobre o caixa preto. É o único
// elemento claro da tela — o olho do atendente sempre sabe onde está o pedido.

import { useEffect, useRef } from 'react'
import { Icone } from '../../componentes/Icone.jsx'
import { Segmentos, BotaoIcone } from '../../componentes/ui.jsx'
import { TIPOS_PEDIDO, totalItem, brutoItem } from '../../dados/vendas.js'
import { reais, valor } from '../../lib/dinheiro.js'

export function Comanda({ pedido, totais, ultimoAdicionado, aoMudarTipo, aoMudarNome, aoAlterarQtd, aoEditar, aoDesconto, aoTirarDesconto, aoEspera, aoCancelar, aoCobrar, aoFecharMovel }) {
  const listaRef = useRef(null)

  useEffect(() => {
    if (ultimoAdicionado) listaRef.current?.querySelector('.item--novo')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [ultimoAdicionado])

  const vazio = !pedido.itens.length
  const uidNovo = ultimoAdicionado?.uid

  return (
    <aside className="comanda" aria-label="Pedido atual">
      <div className="comanda__papel tema-claro">
        <header className="comanda__cabecalho">
          <div className="linha linha--entre">
            <h2>Pedido</h2>
            <BotaoIcone icone="fechar" rotulo="Voltar aos produtos" className="comanda__fechar-movel" onClick={aoFecharMovel} />
          </div>
          <Segmentos rotulo="Tipo do pedido" tamanho="p" valor={pedido.tipo} aoMudar={aoMudarTipo} opcoes={TIPOS_PEDIDO.map((t) => ({ valor: t.id, rotulo: t.nome }))} />
          <input className="comanda__nome" placeholder="Nome para chamar (opcional)" value={pedido.cliente.nome} maxLength={40} onChange={(e) => aoMudarNome(e.target.value)} aria-label="Nome do cliente para chamar" />
        </header>

        <ol className="comanda__itens rolagem" ref={listaRef}>
          {vazio && (
            <li className="comanda__vazio">
              <img src="/marca/gota.svg" alt="" width="34" />
              <p>Toque num produto para começar o pedido.</p>
            </li>
          )}
          {pedido.itens.map((i) => {
            const total = totalItem(i)
            const temDesconto = total < brutoItem(i)
            return (
              <li key={i.uid} className={`item ${i.uid === uidNovo ? 'item--novo' : ''}`}>
                {i.uid === uidNovo && <span key={ultimoAdicionado.t} className="item__brilho" aria-hidden="true" />}
                <button type="button" className="item__corpo" onClick={() => aoEditar(i.uid)} aria-label={`Editar ${i.nome}`}>
                  <span className="item__nome">{i.nome}</span>
                  {i.modificadores.length > 0 && <span className="item__mods">{i.modificadores.map((m) => (m.preco ? `${m.nome} +${valor(m.preco)}` : m.nome)).join(', ')}</span>}
                  {i.obs && <span className="item__obs">“{i.obs}”</span>}
                  {i.promocao && <span className="item__promo">{i.promocao.nome}</span>}
                  {i.desconto && <span className="item__promo">{i.desconto.nome}</span>}
                </button>
                <div className="item__qtd">
                  <button type="button" onClick={() => aoAlterarQtd(i.uid, -1)} aria-label={`Diminuir ${i.nome}`}>
                    <Icone nome={i.qtd === 1 ? 'lixeira' : 'menos'} tamanho={16} />
                  </button>
                  <span className="numero" aria-label={`Quantidade ${i.qtd}`}>
                    {i.qtd}
                  </span>
                  <button type="button" onClick={() => aoAlterarQtd(i.uid, 1)} aria-label={`Aumentar ${i.nome}`}>
                    <Icone nome="mais" tamanho={16} />
                  </button>
                </div>
                <span className="item__valor numero">
                  {temDesconto && <s>{valor(brutoItem(i))}</s>}
                  {valor(total)}
                </span>
              </li>
            )
          })}
        </ol>

        <footer className="comanda__rodape">
          <dl className="comanda__totais numero">
            {(totais.promocoes > 0 || totais.descontos > 0) && (
              <div>
                <dt>Subtotal</dt>
                <dd>{reais(totais.bruto)}</dd>
              </div>
            )}
            {totais.promocoes > 0 && (
              <div className="comanda__economia">
                <dt>Promoções</dt>
                <dd>−{reais(totais.promocoes)}</dd>
              </div>
            )}
            {totais.descontos > 0 && (
              <div className="comanda__economia">
                <dt>
                  Descontos
                  {pedido.descontoPedido && (
                    <button type="button" className="comanda__tirar" onClick={aoTirarDesconto}>
                      tirar
                    </button>
                  )}
                </dt>
                <dd>−{reais(totais.descontos)}</dd>
              </div>
            )}
          </dl>
          <div className="comanda__acoes">
            <button type="button" onClick={aoDesconto} disabled={vazio}>
              <Icone nome="porcento" tamanho={18} /> Desconto
            </button>
            <button type="button" onClick={aoEspera} disabled={vazio}>
              <Icone nome="espera" tamanho={18} /> Espera
            </button>
            <button type="button" onClick={aoCancelar} disabled={vazio} className="comanda__cancelar">
              <Icone nome="lixeira" tamanho={18} /> Cancelar
            </button>
          </div>
        </footer>
      </div>

      <button type="button" className="cobrar" onClick={aoCobrar} disabled={vazio}>
        <span className="cobrar__rotulo">
          Cobrar
          <small>
            {totais.quantidade} {totais.quantidade === 1 ? 'item' : 'itens'} <span className="atalho">F9</span>
          </small>
        </span>
        <span className="cobrar__valor numero">{reais(totais.total)}</span>
      </button>
    </aside>
  )
}
