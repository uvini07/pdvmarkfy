// Painel de vendas: o "Dashboard" do PDV Legal, com período, horário e
// filiais, comparação com o período anterior e os mesmos quadros (mais
// vendidos, vendas por hora, formas de recebimento, faturamento por filial).

import { useMemo, useState } from 'react'
import { useColecao } from '../../dados/banco.js'
import { useSessao } from '../../estado/sessao.js'
import { filtrarVendas, resumo, porHora, porDia, porForma, porProduto, porFilial, variacao } from '../../dados/relatorios.js'
import { Pagina, Cartao } from '../../componentes/Pagina.jsx'
import { Colunas, Barras } from '../../componentes/graficos.jsx'
import { FiltroPeriodo, SeletorFiliais, intervaloDe, intervaloAnterior, rotuloIntervalo } from '../../componentes/filtros.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { Vazio } from '../../componentes/ui.jsx'
import { reais, quantidade } from '../../lib/dinheiro.js'
import { dataCurta, diaSemana, hoje } from '../../lib/datas.js'
import { saldo } from '../../dados/estoque.js'
import { useDoc } from '../../dados/banco.js'

function Variacao({ atual, anterior, inverso }) {
  const v = variacao(atual, anterior)
  if (v === null) return <span className="kpi__variacao mudo">sem comparação</span>
  const bom = inverso ? v <= 0 : v >= 0
  return (
    <span className={`kpi__variacao ${bom ? 'positivo' : 'negativo'}`}>
      <Icone nome={v >= 0 ? 'seta-cima' : 'seta-baixo'} tamanho={14} traco={2.2} />
      {Math.abs(v).toLocaleString('pt-BR')}% vs período anterior
    </span>
  )
}

export function Painel() {
  const { filiaisPermitidas, filial } = useSessao()
  const vendas = useColecao('vendas')
  const formas = useColecao('formasPagamento')
  const produtos = useColecao('produtos')
  const saldos = useDoc('saldos')
  const [periodo, setPeriodo] = useState('hoje')
  const [livre, setLivre] = useState({ inicio: hoje(), fim: hoje() })
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [filiais, setFiliais] = useState(() => (filiaisPermitidas.length > 1 ? filiaisPermitidas.map((f) => f.id) : [filial?.id]))

  const intervalo = intervaloDe(periodo, livre)
  const anterior = intervaloAnterior(intervalo)
  const filtro = { filiais, horaInicio, horaFim }

  const atuais = useMemo(() => filtrarVendas(vendas, { ...intervalo, ...filtro }), [vendas, intervalo.inicio, intervalo.fim, filiais, horaInicio, horaFim])
  const anteriores = useMemo(() => filtrarVendas(vendas, { ...anterior, ...filtro }), [vendas, anterior.inicio, anterior.fim, filiais, horaInicio, horaFim])
  const r = resumo(atuais)
  const ra = resumo(anteriores)
  const umDia = intervalo.inicio === intervalo.fim
  const horas = porHora(atuais).filter((h) => h.hora >= 7 && h.hora <= 22)
  const dias = porDia(atuais, intervalo.inicio, intervalo.fim)
  const formasPag = porForma(atuais, formas)
  const maisVendidos = porProduto(atuais)
  const filiaisRank = porFilial(atuais, filiaisPermitidas.filter((f) => filiais.includes(f.id)))

  const estoqueBaixo = produtos
    .filter((p) => p.ativo && p.tipo === 'venda' && p.config.controlaEstoque && !p.composicao?.length)
    .flatMap((p) => filiais.map((f) => ({ produto: p, filialId: f, saldo: saldo(saldos, f, p.id) })))
    .filter((x) => x.saldo <= 5)
    .sort((a, b) => a.saldo - b.saldo)
    .slice(0, 6)

  return (
    <Pagina titulo="Painel de vendas" descricao={`${rotuloIntervalo(intervalo)}${horaInicio || horaFim ? `, das ${horaInicio || '00:00'} às ${horaFim || '24:00'}` : ''}`}>
      <div className="painel-filtros">
        <FiltroPeriodo periodo={periodo} aoMudar={setPeriodo} livre={livre} aoMudarLivre={setLivre} />
        <div className="painel-filtros__horas">
          <input type="time" className="entrada" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} aria-label="Hora inicial" />
          <span>às</span>
          <input type="time" className="entrada" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} aria-label="Hora final" />
        </div>
        {filiaisPermitidas.length > 1 && <SeletorFiliais filiais={filiaisPermitidas} selecionadas={filiais} aoMudar={setFiliais} />}
      </div>

      <div className="kpis">
        <div className="kpi kpi--principal">
          <span className="kpi__rotulo">Vendido</span>
          <strong className="kpi__valor numero">{reais(r.total)}</strong>
          <span className="kpi__detalhe">{r.quantidade} vendas concluídas</span>
          <Variacao atual={r.total} anterior={ra.total} />
        </div>
        <div className="kpi">
          <span className="kpi__rotulo">Ticket médio</span>
          <strong className="kpi__valor numero">{reais(r.ticket)}</strong>
          <span className="kpi__detalhe">{quantidade(Math.round((r.itens / Math.max(1, r.quantidade)) * 10) / 10)} itens por pedido</span>
          <Variacao atual={r.ticket} anterior={ra.ticket} />
        </div>
        <div className="kpi">
          <span className="kpi__rotulo">Cancelamentos</span>
          <strong className="kpi__valor numero">{reais(r.cancelado)}</strong>
          <span className="kpi__detalhe">{r.vendasComCancelamento ? `${r.vendasComCancelamento} vendas com item cancelado` : 'Nenhum cancelamento'}</span>
          <Variacao atual={r.cancelado} anterior={ra.cancelado} inverso />
        </div>
        <div className="kpi">
          <span className="kpi__rotulo">Estornos e descontos</span>
          <strong className="kpi__valor numero">{reais(r.estornado + r.descontos)}</strong>
          <span className="kpi__detalhe">
            {r.estornos ? `${r.estornos} estorno(s), ` : 'Nenhum estorno, '}
            {reais(r.descontos)} em descontos
          </span>
        </div>
      </div>

      {!atuais.length ? (
        <Cartao>
          <Vazio mascote titulo="Nenhuma venda neste período" texto="Troque o período ou as filiais. As vendas do caixa aparecem aqui na hora." />
        </Cartao>
      ) : (
        <div className="painel-grade">
          <Cartao titulo={umDia ? 'Vendas por hora' : 'Vendas por dia'} className="painel-grade__largo">
            {umDia ? (
              <Colunas titulo="Vendas por hora" dados={horas} rotulo={(h) => `${h.hora}h`} valor={(h) => h.total} formatar={reais} />
            ) : (
              <Colunas titulo="Vendas por dia" dados={dias} rotulo={(d) => (dias.length <= 14 ? `${diaSemana(d.dia)} ${dataCurta(d.dia).slice(0, 2)}` : dataCurta(d.dia))} valor={(d) => d.total} formatar={reais} />
            )}
          </Cartao>

          <Cartao titulo="Produtos mais vendidos" acao={<a className="link" href="#/admin/relatorios">Ver todos</a>}>
            <Barras dados={maisVendidos} nome={(p) => p.nome} valor={(p) => p.quantidade} formatar={(q) => `${quantidade(q)} un`} detalhe={(p) => reais(p.total)} />
          </Cartao>

          <Cartao titulo="Formas de recebimento">
            <Barras dados={formasPag} nome={(f) => f.nome} valor={(f) => f.total} formatar={reais} detalhe={(f) => `${Math.round((f.total / Math.max(1, r.total)) * 100)}%`} />
          </Cartao>

          {filiaisRank.length > 1 && (
            <Cartao titulo="Faturamento por filial">
              <Barras dados={filiaisRank} nome={(f) => f.nome} valor={(f) => f.total} formatar={reais} detalhe={(f) => `ticket ${reais(f.ticket)}`} limite={20} />
            </Cartao>
          )}

          {!umDia && (
            <Cartao titulo="Vendas por hora (média do período)">
              <Colunas titulo="Vendas por hora" dados={horas.map((h) => ({ ...h, total: Math.round(h.total / dias.length) }))} rotulo={(h) => `${h.hora}h`} valor={(h) => h.total} formatar={reais} altura={200} />
            </Cartao>
          )}

          <Cartao titulo="Estoque acabando" acao={<a className="link" href="#/admin/estoque">Ver estoque</a>}>
            {estoqueBaixo.length ? (
              <ul className="lista-simples">
                {estoqueBaixo.map((x) => (
                  <li key={`${x.filialId}${x.produto.id}`}>
                    <span>
                      {x.produto.nome} <small className="mudo">{filiaisPermitidas.find((f) => f.id === x.filialId)?.nome}</small>
                    </span>
                    <span className={`numero forte ${x.saldo <= 0 ? 'negativo' : ''}`}>{quantidade(x.saldo)} un</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mudo">Nenhum produto com 5 unidades ou menos.</p>
            )}
          </Cartao>
        </div>
      )}
    </Pagina>
  )
}
