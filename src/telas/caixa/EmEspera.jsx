// Pedidos em espera: o cliente foi buscar a carteira, o próximo já pede.

import { Modal } from '../../componentes/Modal.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { totaisPedido } from '../../dados/vendas.js'
import { decorrido } from '../../lib/datas.js'
import { reais } from '../../lib/dinheiro.js'

const chave = (pdvId) => `scpdv:espera:${pdvId}`

export function lerEspera(pdvId) {
  try {
    return JSON.parse(localStorage.getItem(chave(pdvId))) || []
  } catch {
    return []
  }
}

export const gravarEspera = (pdvId, lista) => localStorage.setItem(chave(pdvId), JSON.stringify(lista))

export function EmEspera({ lista, aoRetomar, aoFechar }) {
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Pedidos em espera" subtitulo="Toque para continuar. O pedido atual, se tiver itens, vai para a espera." largura="m" className="tema-escuro">
      <ul className="lista-escolha">
        {lista.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => aoRetomar(p.id)}>
              <span>
                <strong>{p.rotulo}</strong>
                <small className="mudo">
                  {' '}
                  {p.itens.length} item(ns), há {decorrido(p.em)}
                </small>
              </span>
              <span className="linha">
                <strong className="numero">{reais(totaisPedido(p).total)}</strong>
                <Icone nome="seta-dir" tamanho={18} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
