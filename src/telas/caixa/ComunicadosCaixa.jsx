// Comunicados da franqueadora vistos do caixa: o atendente lê sem precisar de
// acesso à retaguarda.

import { Modal } from '../../componentes/Modal.jsx'
import { Botao } from '../../componentes/ui.jsx'
import { banco, useColecao } from '../../dados/banco.js'
import { useSessao } from '../../estado/sessao.js'
import { dataHora } from '../../lib/datas.js'

export function ComunicadosCaixa({ aoFechar }) {
  const { usuario, filial } = useSessao()
  const comunicados = useColecao('comunicados')
    .filter((c) => !c.filiais?.length || c.filiais.includes(filial.id))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))

  const marcarLido = (c) => banco.atualizar('comunicados', c.id, { lidos: { ...c.lidos, [usuario.id]: new Date().toISOString() } })

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Comunicados" subtitulo="Avisos da franqueadora para a loja" largura="m" className="tema-escuro">
      <ul className="comunicados comunicados--caixa">
        {comunicados.map((c) => {
          const lido = c.lidos?.[usuario.id]
          return (
            <li key={c.id} className={`comunicado ${lido ? '' : 'comunicado--novo'}`}>
              <header>
                <div>
                  <h2>{c.titulo}</h2>
                  <p className="mudo">
                    {c.autorNome}, {dataHora(c.criadoEm)}
                  </p>
                </div>
              </header>
              <p className="comunicado__texto">{c.texto}</p>
              {!lido && (
                <footer>
                  <Botao tamanho="p" icone="check" onClick={() => marcarLido(c)}>
                    Li e entendi
                  </Botao>
                </footer>
              )}
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
