// Tela da cozinha (KDS): os pedidos chegam sozinhos do caixa, em três colunas.
// O tempo de cada pedido muda de cor quando passa do alerta configurado.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useColecao, useDoc } from '../../dados/banco.js'
import { avancarCozinha, nomeTipoPedido } from '../../dados/vendas.js'
import { useSessao, sessao } from '../../estado/sessao.js'
import { Icone } from '../../componentes/Icone.jsx'
import { Logo, useRelogio } from '../../componentes/ui.jsx'
import { Menu } from '../../componentes/Menu.jsx'
import { ir } from '../../rotas/useRota.js'
import { decorrido, hoje, hora, minutosDesde } from '../../lib/datas.js'

const COLUNAS = [
  { id: 'novo', nome: 'Na fila', acao: 'Começar', proximo: 'preparo', icone: 'play' },
  { id: 'preparo', nome: 'Preparando', acao: 'Pronto', proximo: 'pronto', icone: 'check' },
  { id: 'pronto', nome: 'Pronto para entregar', acao: 'Entregue', proximo: 'entregue', icone: 'check-circulo' },
]
const ANTERIOR = { preparo: 'novo', pronto: 'preparo' }

// Um "plim" curto quando chega pedido novo, sem arquivo de áudio.
function tocarAviso() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const vol = ctx.createGain()
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12)
    vol.gain.setValueAtTime(0.18, ctx.currentTime)
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(vol).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.42)
  } catch {
    // Sem áudio liberado pelo navegador: segue sem som
  }
}

function CartaoPedido({ venda, coluna, alerta, agora }) {
  const desde = venda.cozinha?.[`${coluna.id}Em`] || venda.criadoEm
  const min = minutosDesde(venda.criadoEm, agora)
  const atrasado = coluna.id !== 'pronto' && min >= alerta
  const quase = coluna.id !== 'pronto' && min >= alerta * 0.6
  const itens = venda.itens.filter((i) => i.setor === 'cozinha')
  const outros = venda.itens.filter((i) => i.setor !== 'cozinha')

  return (
    <article className={`kds-pedido ${atrasado ? 'kds-pedido--atrasado' : quase ? 'kds-pedido--atencao' : ''}`} aria-label={`Pedido ${venda.numero}`}>
      <header>
        <span className="kds-pedido__numero numero">{String(venda.numero).padStart(3, '0')}</span>
        <span className="kds-pedido__info">
          <strong>{venda.cliente?.nome || nomeTipoPedido(venda.tipo)}</strong>
          <small>
            {venda.cliente?.nome ? `${nomeTipoPedido(venda.tipo)}, ` : ''}
            {hora(venda.criadoEm)}
          </small>
        </span>
        <span className="kds-pedido__tempo numero">
          <Icone nome="relogio" tamanho={16} /> {decorrido(coluna.id === 'pronto' ? desde : venda.criadoEm, agora)}
        </span>
      </header>
      <ul className="kds-pedido__itens">
        {itens.map((i, n) => (
          <li key={n}>
            <span className="kds-pedido__qtd numero">{i.qtd}</span>
            <span>
              <strong>{i.nome}</strong>
              {i.modificadores?.length > 0 && <small>{i.modificadores.map((m) => m.nome).join(', ')}</small>}
              {i.obs && <em>{i.obs}</em>}
            </span>
          </li>
        ))}
      </ul>
      {outros.length > 0 && <p className="kds-pedido__balcao">Balcão: {outros.map((i) => `${i.qtd}× ${i.nome}`).join(', ')}</p>}
      <footer>
        {ANTERIOR[coluna.id] && (
          <button type="button" className="kds-voltar" onClick={() => avancarCozinha(venda.id, ANTERIOR[coluna.id])} aria-label="Voltar uma etapa">
            <Icone nome="seta-esq" tamanho={20} />
          </button>
        )}
        <button type="button" className={`kds-avancar kds-avancar--${coluna.id}`} onClick={() => avancarCozinha(venda.id, coluna.proximo)}>
          <Icone nome={coluna.icone} tamanho={20} /> {coluna.acao}
        </button>
      </footer>
    </article>
  )
}

export function Cozinha() {
  const { filial, usuario, pode } = useSessao()
  const vendas = useColecao('vendas')
  const config = useDoc('config')
  const agora = useRelogio(15_000)
  const [som, setSom] = useState(true)
  const conhecidos = useRef(null)

  const dia = hoje()
  const ativos = useMemo(
    () => vendas.filter((v) => v.filialId === filial.id && v.dia === dia && v.status === 'concluida' && v.cozinha && ['novo', 'preparo', 'pronto'].includes(v.cozinha.status)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
    [vendas, filial.id, dia],
  )

  useEffect(() => {
    const ids = new Set(ativos.filter((v) => v.cozinha.status === 'novo').map((v) => v.id))
    if (conhecidos.current && som && [...ids].some((id) => !conhecidos.current.has(id))) tocarAviso()
    conhecidos.current = ids
  }, [ativos, som])

  const alerta = config.alertaCozinhaMin || 8
  const menu = [
    { rotulo: som ? 'Desligar som de pedido novo' : 'Ligar som de pedido novo', icone: 'sino', acao: () => setSom((s) => !s) },
    { rotulo: 'Abrir painel de senhas', icone: 'monitor', acao: () => window.open(`#/painel/${filial.id}`, 'painel-senhas', 'noopener') },
    ...(pode('caixa.vender') ? [{ rotulo: 'Ir para o caixa', icone: 'recibo', acao: () => ir('/caixa') }] : []),
    { separador: true },
    { rotulo: 'Sair', icone: 'sair', acao: () => sessao.sair() },
  ]

  return (
    <div className="tema-escuro kds">
      <header className="kds__topo">
        <Logo claro altura={22} />
        <h1>
          Cozinha <span className="mudo">{filial.nome}</span>
        </h1>
        <div className="kds__resumo">
          {COLUNAS.map((c) => (
            <span key={c.id}>
              <strong className="numero">{ativos.filter((v) => v.cozinha.status === c.id).length}</strong> {c.nome.toLowerCase()}
            </span>
          ))}
        </div>
        <span className="caixa__hora numero">{hora(agora)}</span>
        <span className="mudo">{usuario.nome.split(' ')[0]}</span>
        <Menu rotulo="Opções da cozinha" itens={menu} />
      </header>
      <main className="kds__colunas">
        {COLUNAS.map((c) => {
          const lista = ativos.filter((v) => v.cozinha.status === c.id)
          return (
            <section key={c.id} className={`kds__coluna kds__coluna--${c.id}`} aria-label={c.nome}>
              <h2>
                {c.nome} <span className="numero">{lista.length}</span>
              </h2>
              <div className="kds__lista rolagem">
                {lista.map((v) => (
                  <CartaoPedido key={v.id} venda={v} coluna={c} alerta={alerta} agora={agora} />
                ))}
                {!lista.length && <p className="kds__vazio">{c.id === 'novo' ? 'Nenhum pedido na fila. Os pedidos cobrados no caixa aparecem aqui.' : 'Nada aqui agora.'}</p>}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
