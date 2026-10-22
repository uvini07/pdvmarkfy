// Impressão de cupom (cliente), comanda (cozinha) e relatório de fechamento,
// no formato de impressora térmica de 80 mm. Usa a impressão do navegador:
// num computador de caixa com o Chrome em modo quiosque (--kiosk-printing),
// sai direto na térmica, sem janela.

import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { banco } from '../dados/banco.js'
import { nomeTipoPedido, valorUnitario } from '../dados/vendas.js'
import { resumoCaixa } from '../dados/caixa.js'
import { reais, valor } from '../lib/dinheiro.js'
import { dataHora, hora } from '../lib/datas.js'
import { mascararCpf } from '../lib/validacao.js'

let trabalho = null
const ouvintes = new Set()
const mudar = (t) => {
  trabalho = t
  ouvintes.forEach((fn) => fn())
}

export const imprimir = (tipo, dados) => mudar({ tipo, dados, id: Date.now() })

function Linha({ esquerda, direita, forte }) {
  return (
    <div className={`imp-linha ${forte ? 'imp-forte' : ''}`}>
      <span>{esquerda}</span>
      <span>{direita}</span>
    </div>
  )
}

function Cabecalho({ filial }) {
  const config = banco.doc('config')
  return (
    <header className="imp-cabecalho">
      <img src="/marca/logo-sua-coxinha.svg" alt="" />
      <p className="imp-forte">
        {config.empresa} {filial?.nome}
      </p>
      {filial?.cnpj && <p>CNPJ {filial.cnpj}</p>}
      {filial?.endereco && <p>{filial.endereco}</p>}
    </header>
  )
}

function Cupom({ venda }) {
  const filial = banco.obter('filiais', venda.filialId)
  const pdv = banco.obter('pontosVenda', venda.pdvId)
  const formas = banco.lista('formasPagamento')
  const config = banco.doc('config')
  const troco = venda.pagamentos.reduce((t, p) => t + (p.troco || 0), 0)
  return (
    <div className="imp-folha">
      <Cabecalho filial={filial} />
      <p className="imp-centro imp-forte">CUPOM NÃO FISCAL</p>
      <hr />
      <Linha esquerda={`Pedido ${String(venda.numero).padStart(3, '0')}`} direita={nomeTipoPedido(venda.tipo)} forte />
      <p>
        {dataHora(venda.criadoEm)} · {pdv?.nome} · {venda.operadorNome}
      </p>
      {venda.status !== 'concluida' && <p className="imp-forte">*** VENDA {venda.status.toUpperCase()} ***</p>}
      <hr />
      {venda.itens.map((i, n) => (
        <div key={n} className="imp-item">
          <Linha esquerda={`${i.qtd}× ${i.nome}`} direita={valor(valorUnitario(i) * i.qtd)} />
          {i.modificadores?.map((m, k) => (
            <p key={k} className="imp-mod">
              {m.preco ? `+ ${m.nome} (${valor(m.preco)})` : `· ${m.nome}`}
            </p>
          ))}
          {i.obs && <p className="imp-mod">Obs.: {i.obs}</p>}
        </div>
      ))}
      <hr />
      <Linha esquerda="Subtotal" direita={valor(venda.bruto)} />
      {venda.promocoes > 0 && <Linha esquerda="Promoções" direita={`-${valor(venda.promocoes)}`} />}
      {venda.descontos > 0 && <Linha esquerda="Descontos" direita={`-${valor(venda.descontos)}`} />}
      <Linha esquerda="TOTAL" direita={reais(venda.total)} forte />
      {venda.pagamentos.map((p, n) => (
        <Linha key={n} esquerda={formas.find((f) => f.id === p.formaId)?.nome || 'Pagamento'} direita={valor(p.valor)} />
      ))}
      {troco > 0 && <Linha esquerda="Troco" direita={valor(troco)} />}
      {venda.cliente?.cpf && <p>CPF do consumidor: {mascararCpf(venda.cliente.cpf)}</p>}
      <hr />
      <p className="imp-centro">{config.mensagemCupom}</p>
      <p className="imp-centro imp-pequeno">Documento sem valor fiscal</p>
    </div>
  )
}

function Comanda({ venda }) {
  const itens = venda.itens.filter((i) => i.setor === 'cozinha')
  const outros = venda.itens.filter((i) => i.setor !== 'cozinha')
  return (
    <div className="imp-folha">
      <p className="imp-centro imp-senha">{String(venda.numero).padStart(3, '0')}</p>
      <p className="imp-centro imp-forte">{nomeTipoPedido(venda.tipo).toUpperCase()}</p>
      {venda.cliente?.nome && <p className="imp-centro imp-forte">{venda.cliente.nome}</p>}
      <p className="imp-centro">{hora(venda.criadoEm)}</p>
      <hr />
      {itens.map((i, n) => (
        <div key={n} className="imp-item imp-cozinha">
          <p className="imp-forte">
            {i.qtd}× {i.nome}
          </p>
          {i.modificadores?.map((m, k) => (
            <p key={k} className="imp-mod">
              {m.nome}
            </p>
          ))}
          {i.obs && <p className="imp-mod imp-forte">OBS: {i.obs}</p>}
        </div>
      ))}
      {outros.length > 0 && (
        <>
          <hr />
          <p className="imp-pequeno">Balcão: {outros.map((i) => `${i.qtd}× ${i.nome}`).join(', ')}</p>
        </>
      )}
      {venda.obs && <p className="imp-forte">Pedido: {venda.obs}</p>}
    </div>
  )
}

function Fechamento({ caixa }) {
  const filial = banco.obter('filiais', caixa.filialId)
  const pdv = banco.obter('pontosVenda', caixa.pdvId)
  const formas = banco.lista('formasPagamento')
  const r = resumoCaixa(caixa, banco.lista('vendas'), formas)
  return (
    <div className="imp-folha">
      <Cabecalho filial={filial} />
      <p className="imp-centro imp-forte">FECHAMENTO DE CAIXA</p>
      <p>
        {pdv?.nome} · {caixa.operadorNome}
      </p>
      <p>Aberto {dataHora(caixa.abertoEm)}</p>
      {caixa.fechadoEm && <p>Fechado {dataHora(caixa.fechadoEm)}</p>}
      <hr />
      <Linha esquerda="Vendas" direita={r.vendas} />
      <Linha esquerda="Total vendido" direita={valor(r.vendido)} forte />
      <Linha esquerda="Descontos" direita={valor(r.descontos)} />
      <Linha esquerda="Canceladas" direita={`${r.canceladas} (${valor(r.valorCancelado)})`} />
      <Linha esquerda="Fundo de troco" direita={valor(caixa.fundo)} />
      <Linha esquerda="Suprimentos" direita={valor(r.suprimentos)} />
      <Linha esquerda="Sangrias" direita={valor(r.sangrias)} />
      <hr />
      <Linha esquerda="Forma" direita="Esperado / Contado" forte />
      {formas.map((f) => (
        <Linha key={f.id} esquerda={f.nome} direita={`${valor(caixa.esperado?.[f.id] ?? r.esperado[f.id] ?? 0)} / ${caixa.contado ? valor(caixa.contado[f.id] || 0) : '—'}`} />
      ))}
      {caixa.contado && <Linha esquerda="Diferença" direita={reais(caixa.diferenca)} forte />}
      {caixa.obs && <p>Obs.: {caixa.obs}</p>}
      <hr />
      <p className="imp-centro imp-pequeno">Conferir e assinar</p>
      <p className="imp-assinatura">______________________________</p>
    </div>
  )
}

export function Impressao() {
  const t = useSyncExternalStore(
    (fn) => (ouvintes.add(fn), () => ouvintes.delete(fn)),
    () => trabalho,
  )

  useEffect(() => {
    if (!t) return
    const fim = () => mudar(null)
    window.addEventListener('afterprint', fim, { once: true })
    // Espera o logo carregar antes de abrir a impressão
    const tempo = setTimeout(() => window.print(), 250)
    return () => {
      clearTimeout(tempo)
      window.removeEventListener('afterprint', fim)
    }
  }, [t])

  if (!t) return null
  const alvo = document.getElementById('impressao')
  const conteudo = t.tipo === 'cupom' ? <Cupom venda={t.dados} /> : t.tipo === 'comanda' ? <Comanda venda={t.dados} /> : <Fechamento caixa={t.dados} />
  return createPortal(conteudo, alvo)
}
