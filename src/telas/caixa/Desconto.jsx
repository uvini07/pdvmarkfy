// Desconto no pedido ou num item. Cada tipo de desconto tem um limite; acima
// dele, ou em tipos que exigem autorização (cortesia, reclamação), um gerente
// confirma com o PIN.

import { useState } from 'react'
import { Modal } from '../../componentes/Modal.jsx'
import { Botao, CampoDinheiro, Campo, Entrada, Segmentos } from '../../componentes/ui.jsx'
import { pedirAutorizacao, avisar } from '../../componentes/dialogos.jsx'
import { useColecao } from '../../dados/banco.js'
import { brutoItem, promocaoItem, totaisPedido } from '../../dados/vendas.js'
import { useSessao } from '../../estado/sessao.js'
import { porcentagem, reais } from '../../lib/dinheiro.js'

export function Desconto({ pedido, item, aoFechar, aoAplicar }) {
  const { pode, filial, usuario } = useSessao()
  const tipos = useColecao('tiposDesconto').filter((t) => t.ativo)
  const [tipoId, setTipoId] = useState(tipos[0]?.id)
  const [modo, setModo] = useState('percentual')
  const [percentual, setPercentual] = useState(10)
  const [valor, setValor] = useState(0)

  const tipo = tipos.find((t) => t.id === tipoId)
  const base = item ? brutoItem(item) - promocaoItem(item) : (() => {
    const t = totaisPedido({ ...pedido, descontoPedido: null })
    return t.total
  })()
  const desconto = modo === 'percentual' ? porcentagem(base, percentual) : Math.min(valor, base)
  const pctEfetivo = base ? (desconto / base) * 100 : 0

  const aplicar = async () => {
    if (!tipo || desconto <= 0) return
    const precisa = !pode('caixa.desconto') || tipo.exigeAutorizacao || pctEfetivo > tipo.maxPercentual + 0.001
    let autorizador = usuario
    if (precisa && !pode('caixa.descontoLivre')) {
      const motivo = tipo.exigeAutorizacao ? `${tipo.nome} exige autorização` : pctEfetivo > tipo.maxPercentual ? `acima do limite de ${tipo.maxPercentual}%` : 'sem permissão de desconto'
      autorizador = await pedirAutorizacao({ permissao: 'caixa.descontoLivre', acao: `Desconto de ${reais(desconto)} (${motivo})`, filialId: filial.id })
      if (!autorizador) return
    }
    aoAplicar({
      tipoId: tipo.id,
      nome: tipo.nome,
      ...(modo === 'percentual' ? { percentual } : { valor: desconto }),
      autorizadoPor: autorizador.id !== usuario.id ? autorizador.nome : null,
    })
    avisar(`Desconto de ${reais(desconto)} aplicado`, 'info')
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={item ? `Desconto em ${item.nome}` : 'Desconto no pedido'}
      subtitulo={`Sobre ${reais(base)}`}
      largura="m"
      className="tema-escuro"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={aplicar} disabled={desconto <= 0}>
            Aplicar −{reais(desconto)}
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <fieldset className="grupo-mod">
          <legend>
            <span>Motivo do desconto</span>
          </legend>
          <div className="grupo-mod__opcoes">
            {tipos.map((t) => (
              <button key={t.id} type="button" className={`opcao ${t.id === tipoId ? 'opcao--marcada' : ''}`} aria-pressed={t.id === tipoId} onClick={() => setTipoId(t.id)}>
                <span className="opcao__nome">{t.nome}</span>
                <span className="opcao__preco">{t.exigeAutorizacao ? 'com gerente' : `até ${t.maxPercentual}%`}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Segmentos
          rotulo="Tipo de valor"
          valor={modo}
          aoMudar={setModo}
          opcoes={[
            { valor: 'percentual', rotulo: 'Porcentagem' },
            { valor: 'valor', rotulo: 'Valor em reais' },
          ]}
        />
        {modo === 'percentual' ? (
          <div className="linha linha--quebra">
            {[5, 10, 15, 20, 50, 100].map((p) => (
              <button key={p} type="button" className={`chip-valor ${percentual === p ? 'chip-valor--ativo' : ''}`} onClick={() => setPercentual(p)}>
                {p}%
              </button>
            ))}
            <Campo rotulo="Outro (%)" className="campo-curto">
              {(p) => <Entrada {...p} type="number" min={1} max={100} value={percentual} onChange={(e) => setPercentual(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />}
            </Campo>
          </div>
        ) : (
          <Campo rotulo="Valor do desconto">{(p) => <CampoDinheiro {...p} valor={valor} aoMudar={setValor} autoFocus />}</Campo>
        )}
        {tipo && pctEfetivo > tipo.maxPercentual + 0.001 && !pode('caixa.descontoLivre') && <p className="mudo">Acima de {tipo.maxPercentual}% para {tipo.nome.toLowerCase()}: um gerente vai precisar autorizar.</p>}
      </div>
    </Modal>
  )
}
