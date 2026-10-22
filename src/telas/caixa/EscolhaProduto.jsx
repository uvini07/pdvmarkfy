// Escolha de sabores, coberturas e quantidade de um produto. Também abre para
// editar um item que já está na comanda.

import { useMemo, useState } from 'react'
import { Modal } from '../../componentes/Modal.jsx'
import { Botao, CampoDinheiro, Campo, Entrada } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { useColecao } from '../../dados/banco.js'
import { precoNaFilial } from '../../dados/precos.js'
import { descontoManualItem, promocaoItem } from '../../dados/vendas.js'
import { reais, valor } from '../../lib/dinheiro.js'
import { textoLimpo } from '../../lib/validacao.js'

const regra = (g) => {
  if (g.min === g.max) return g.min === 1 ? 'Escolha 1' : `Escolha ${g.min}`
  if (g.min === 0) return g.max === 1 ? 'Opcional' : `Opcional, até ${g.max}`
  return `Escolha de ${g.min} a ${g.max}`
}

export function EscolhaProduto({ produto, item, filialId, aoFechar, aoConfirmar, aoRemover, aoDescontoItem, aoTirarDesconto }) {
  const todosGrupos = useColecao('gruposModificadores')
  const grupos = useMemo(() => produto.gruposModificadores.map((id) => todosGrupos.find((g) => g.id === id)).filter(Boolean), [produto, todosGrupos])
  const [escolhas, setEscolhas] = useState(() => {
    const inicial = {}
    for (const m of item?.modificadores || []) inicial[m.grupoId] = [...(inicial[m.grupoId] || []), m.opcaoId]
    return inicial
  })
  const [qtd, setQtd] = useState(item?.qtd || 1)
  const [obs, setObs] = useState(item?.obs || '')
  const [precoDigitado, setPrecoDigitado] = useState(item?.precoUnit ?? (produto.config.pedePreco ? 0 : null))
  const [tentou, setTentou] = useState(false)

  const precoBase = produto.config.pedePreco ? precoDigitado || 0 : (item?.precoUnit ?? precoNaFilial(produto, filialId))

  const alternar = (g, opcaoId) => {
    setEscolhas((e) => {
      const atuais = e[g.id] || []
      if (atuais.includes(opcaoId)) return { ...e, [g.id]: atuais.filter((x) => x !== opcaoId) }
      if (g.max === 1) return { ...e, [g.id]: [opcaoId] }
      if (atuais.length >= g.max) return e
      return { ...e, [g.id]: [...atuais, opcaoId] }
    })
  }

  const modificadores = grupos.flatMap((g) =>
    (escolhas[g.id] || []).map((opcaoId) => {
      const o = g.opcoes.find((x) => x.id === opcaoId)
      return { grupoId: g.id, grupoNome: g.nome, opcaoId, nome: o.nome, preco: g.tipo === 'adicional' ? o.preco : 0, qtd: 1 }
    }),
  )
  const faltando = grupos.filter((g) => (escolhas[g.id] || []).length < g.min)
  const unitario = precoBase + modificadores.reduce((t, m) => t + m.preco, 0)
  const precoInvalido = produto.config.pedePreco && !precoDigitado

  const confirmar = () => {
    setTentou(true)
    if (faltando.length || precoInvalido) return
    aoConfirmar({ qtd, modificadores, obs: textoLimpo(obs, 120), precoUnit: precoBase })
  }

  const descontoAtual = item ? descontoManualItem(item) + promocaoItem(item) : 0

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={produto.nome}
      subtitulo={produto.descricao}
      largura="g"
      className="tema-escuro escolha-produto"
      rodape={
        <>
          {item && (
            <Botao variante="fantasma" icone="lixeira" onClick={aoRemover} className="escolha-produto__remover">
              Tirar do pedido
            </Botao>
          )}
          <div className="escolha-produto__qtd" role="group" aria-label="Quantidade">
            <button type="button" onClick={() => setQtd((q) => Math.max(1, q - 1))} aria-label="Diminuir quantidade" disabled={qtd <= 1}>
              <Icone nome="menos" tamanho={20} />
            </button>
            <span className="numero">{qtd}</span>
            <button type="button" onClick={() => setQtd((q) => Math.min(999, q + 1))} aria-label="Aumentar quantidade">
              <Icone nome="mais" tamanho={20} />
            </button>
          </div>
          <Botao tamanho="g" onClick={confirmar} className="escolha-produto__confirmar">
            {item ? 'Salvar' : 'Adicionar'} <span className="numero">{reais(unitario * qtd)}</span>
          </Botao>
        </>
      }
    >
      <div className="escolha-produto__layout">
        <div className="escolha-produto__foto">
          {produto.imagem ? <img src={produto.imagem} alt="" /> : <Icone nome="lata" tamanho={64} traco={1.2} />}
          <p className="numero">{reais(precoBase)}</p>
        </div>

        <div className="escolha-produto__grupos">
          {produto.config.pedePreco && (
            <Campo rotulo="Preço deste item" erro={tentou && precoInvalido ? 'Digite o preço.' : null}>
              {(p) => <CampoDinheiro {...p} valor={precoDigitado || 0} aoMudar={setPrecoDigitado} autoFocus grande />}
            </Campo>
          )}

          {grupos.map((g) => {
            const escolhidas = escolhas[g.id] || []
            const erro = tentou && escolhidas.length < g.min
            return (
              <fieldset key={g.id} className={`grupo-mod ${erro ? 'grupo-mod--erro' : ''}`}>
                <legend>
                  <span>{g.nome}</span>
                  <small className={erro ? 'negativo' : ''}>
                    {regra(g)}
                    {g.max > 1 && ` (${escolhidas.length}/${g.max})`}
                  </small>
                </legend>
                <div className="grupo-mod__opcoes">
                  {g.opcoes
                    .filter((o) => o.ativo !== false)
                    .map((o) => {
                      const marcada = escolhidas.includes(o.id)
                      const cheio = !marcada && g.max > 1 && escolhidas.length >= g.max
                      return (
                        <button key={o.id} type="button" className={`opcao ${marcada ? 'opcao--marcada' : ''}`} aria-pressed={marcada} onClick={() => alternar(g, o.id)} disabled={cheio}>
                          <span className="opcao__marca" aria-hidden="true">
                            {marcada && <Icone nome="check" tamanho={14} traco={2.6} />}
                          </span>
                          <span className="opcao__nome">{o.nome}</span>
                          {g.tipo === 'adicional' && o.preco > 0 && <span className="opcao__preco numero">+{valor(o.preco)}</span>}
                        </button>
                      )
                    })}
                </div>
              </fieldset>
            )
          })}

          <Campo rotulo="Observação para a cozinha">
            {(p) => <Entrada {...p} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={120} placeholder="Ex.: bem quentinha, sem molho" />}
          </Campo>

          {item && (
            <div className="escolha-produto__desconto">
              {item.desconto ? (
                <p>
                  {item.desconto.nome}: −{reais(descontoAtual)}{' '}
                  <button type="button" className="link" onClick={aoTirarDesconto}>
                    tirar desconto
                  </button>
                </p>
              ) : (
                <Botao variante="contorno" tamanho="p" icone="porcento" onClick={aoDescontoItem} disabled={!produto.config.permiteDesconto}>
                  {produto.config.permiteDesconto ? 'Desconto neste item' : 'Este produto não aceita desconto'}
                </Botao>
              )}
            </div>
          )}

          {tentou && faltando.length > 0 && (
            <p className="campo__erro" role="alert">
              Falta escolher: {faltando.map((g) => g.nome.toLowerCase()).join(', ')}.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
