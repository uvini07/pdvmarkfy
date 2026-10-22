// Relatórios de vendas com exportação em CSV (abre no Excel).

import { useMemo, useState } from 'react'
import { useColecao } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { useSessao } from '../../estado/sessao.js'
import { filtrarVendas, porDia, porForma, porGarcom, porMesa, porOperador, porProduto, porFilial, resumo } from '../../dados/relatorios.js'
import { nomeTipoPedido } from '../../dados/vendas.js'
import { Pagina } from '../../componentes/Pagina.jsx'
import { Tabela } from '../../componentes/Tabela.jsx'
import { Abas, Botao } from '../../componentes/ui.jsx'
import { FiltroPeriodo, SeletorFiliais, intervaloDe, rotuloIntervalo } from '../../componentes/filtros.jsx'
import { gerarCsv, baixarArquivo } from '../../lib/arquivos.js'
import { reais, valor, quantidade } from '../../lib/dinheiro.js'
import { data, dataHora, hoje } from '../../lib/datas.js'

const RELATORIOS = [
  { id: 'dias', nome: 'Por dia' },
  { id: 'produtos', nome: 'Por produto' },
  { id: 'formas', nome: 'Por forma de pagamento' },
  { id: 'operadores', nome: 'Por atendente' },
  { id: 'filiais', nome: 'Por filial' },
  { id: 'mesas', nome: 'Por mesa' },
  { id: 'garcons', nome: 'Serviço por garçom' },
  { id: 'cancelamentos', nome: 'Cancelamentos e descontos' },
  { id: 'vendas', nome: 'Vendas uma a uma' },
]

export function Relatorios() {
  const { usuario, filiaisPermitidas, filial } = useSessao()
  const vendas = useColecao('vendas')
  const formas = useColecao('formasPagamento')
  const [aba, setAba] = useState('dias')
  const [periodo, setPeriodo] = useState('7d')
  const [livre, setLivre] = useState({ inicio: hoje(), fim: hoje() })
  const [filiais, setFiliais] = useState(() => (filiaisPermitidas.length > 1 ? filiaisPermitidas.map((f) => f.id) : [filial?.id]))
  const intervalo = intervaloDe(periodo, livre)

  const lista = useMemo(() => filtrarVendas(vendas, { ...intervalo, filiais }), [vendas, intervalo.inicio, intervalo.fim, filiais])
  const nomeFilial = (id) => filiaisPermitidas.find((f) => f.id === id)?.nome || ''
  const nomeForma = (id) => formas.find((f) => f.id === id)?.nome || ''

  const relatorio = useMemo(() => {
    const total = resumo(lista).total || 1
    switch (aba) {
      case 'dias':
        return {
          linhas: porDia(lista, intervalo.inicio, intervalo.fim).map((d) => ({ id: d.dia, ...d, ticket: d.quantidade ? Math.round(d.total / d.quantidade) : 0 })),
          colunas: [
            { id: 'dia', titulo: 'Dia', valor: (d) => data(d.dia), csv: (d) => data(d.dia) },
            { id: 'quantidade', titulo: 'Vendas', alinhar: 'direita' },
            { id: 'ticket', titulo: 'Ticket médio', alinhar: 'direita', render: (d) => reais(d.ticket), csv: (d) => valor(d.ticket) },
            { id: 'total', titulo: 'Total', alinhar: 'direita', render: (d) => <strong>{reais(d.total)}</strong>, csv: (d) => valor(d.total) },
          ],
        }
      case 'produtos':
        return {
          linhas: porProduto(lista),
          colunas: [
            { id: 'nome', titulo: 'Produto' },
            { id: 'quantidade', titulo: 'Quantidade', alinhar: 'direita', render: (p) => quantidade(p.quantidade) },
            { id: 'total', titulo: 'Total', alinhar: 'direita', render: (p) => reais(p.total), csv: (p) => valor(p.total) },
            { id: 'parte', titulo: '% das vendas', alinhar: 'direita', valor: (p) => `${((p.total / total) * 100).toFixed(1).replace('.', ',')}%`, ordenar: (p) => p.total },
          ],
        }
      case 'formas':
        return {
          linhas: porForma(lista, formas).map((f) => {
            const taxa = formas.find((x) => x.id === f.id)?.taxa || 0
            return { ...f, taxa: Math.round((f.total * taxa) / 100), liquido: f.total - Math.round((f.total * taxa) / 100) }
          }),
          colunas: [
            { id: 'nome', titulo: 'Forma' },
            { id: 'quantidade', titulo: 'Pagamentos', alinhar: 'direita' },
            { id: 'total', titulo: 'Bruto', alinhar: 'direita', render: (f) => reais(f.total), csv: (f) => valor(f.total) },
            { id: 'taxa', titulo: 'Taxa estimada', alinhar: 'direita', render: (f) => reais(f.taxa), csv: (f) => valor(f.taxa) },
            { id: 'liquido', titulo: 'Líquido', alinhar: 'direita', render: (f) => <strong>{reais(f.liquido)}</strong>, csv: (f) => valor(f.liquido) },
          ],
        }
      case 'operadores':
        return {
          linhas: porOperador(lista),
          colunas: [
            { id: 'nome', titulo: 'Atendente' },
            { id: 'quantidade', titulo: 'Vendas', alinhar: 'direita' },
            { id: 'ticket', titulo: 'Ticket médio', alinhar: 'direita', valor: (o) => reais(o.quantidade ? Math.round(o.total / o.quantidade) : 0), ordenar: (o) => o.total / Math.max(1, o.quantidade) },
            { id: 'descontos', titulo: 'Descontos dados', alinhar: 'direita', render: (o) => reais(o.descontos), csv: (o) => valor(o.descontos) },
            { id: 'canceladas', titulo: 'Canceladas', alinhar: 'direita' },
            { id: 'total', titulo: 'Total', alinhar: 'direita', render: (o) => <strong>{reais(o.total)}</strong>, csv: (o) => valor(o.total) },
          ],
        }
      case 'filiais':
        return {
          linhas: porFilial(lista, filiaisPermitidas.filter((f) => filiais.includes(f.id))),
          colunas: [
            { id: 'nome', titulo: 'Filial' },
            { id: 'quantidade', titulo: 'Vendas', alinhar: 'direita' },
            { id: 'ticket', titulo: 'Ticket médio', alinhar: 'direita', render: (f) => reais(f.ticket), csv: (f) => valor(f.ticket) },
            { id: 'cancelado', titulo: 'Cancelado', alinhar: 'direita', render: (f) => reais(f.cancelado), csv: (f) => valor(f.cancelado) },
            { id: 'total', titulo: 'Total', alinhar: 'direita', render: (f) => <strong>{reais(f.total)}</strong>, csv: (f) => valor(f.total) },
          ],
        }
      case 'mesas':
        return {
          linhas: porMesa(lista),
          colunas: [
            { id: 'nome', titulo: 'Mesa' },
            { id: 'ambiente', titulo: 'Ambiente' },
            { id: 'contas', titulo: 'Contas', alinhar: 'direita' },
            { id: 'pessoas', titulo: 'Pessoas', alinhar: 'direita' },
            { id: 'tempoMedio', titulo: 'Tempo médio', alinhar: 'direita', render: (m) => `${m.tempoMedio} min`, csv: (m) => m.tempoMedio },
            { id: 'porPessoa', titulo: 'Por pessoa', alinhar: 'direita', render: (m) => (m.pessoas ? reais(m.porPessoa) : '—'), csv: (m) => valor(m.porPessoa) },
            { id: 'servico', titulo: 'Taxa de serviço', alinhar: 'direita', render: (m) => reais(m.servico), csv: (m) => valor(m.servico) },
            { id: 'total', titulo: 'Consumo', alinhar: 'direita', render: (m) => <strong>{reais(m.total)}</strong>, csv: (m) => valor(m.total) },
          ],
        }
      case 'garcons':
        return {
          linhas: porGarcom(lista),
          colunas: [
            { id: 'nome', titulo: 'Garçom (quem abriu a mesa)' },
            { id: 'contas', titulo: 'Contas', alinhar: 'direita' },
            { id: 'pessoas', titulo: 'Pessoas', alinhar: 'direita' },
            { id: 'total', titulo: 'Consumo', alinhar: 'direita', render: (g) => reais(g.total), csv: (g) => valor(g.total) },
            { id: 'servico', titulo: 'Taxa de serviço', alinhar: 'direita', render: (g) => <strong>{reais(g.servico)}</strong>, csv: (g) => valor(g.servico) },
          ],
        }
      case 'cancelamentos': {
        const linhas = []
        for (const v of lista) {
          if (v.status !== 'concluida') linhas.push({ id: v.id, em: v.encerramento?.em || v.criadoEm, filial: nomeFilial(v.filialId), tipo: v.status === 'cancelada' ? (v.antesDoPagamento ? (v.mesa ? 'Conta de mesa cancelada' : 'Pedido cancelado antes de cobrar') : 'Venda cancelada') : 'Venda estornada', descricao: v.numero ? `Pedido ${v.numero}${v.mesa ? `, ${v.mesa.nome}` : ''}` : v.mesa?.nome || 'Pedido —', valor: v.total, motivo: v.encerramento?.motivo, quem: v.encerramento?.usuarioNome, autorizou: v.encerramento?.autorizadorNome })
          for (const [k, c] of (v.itensCancelados || []).entries()) linhas.push({ id: `${v.id}-c${k}`, em: c.em, filial: nomeFilial(v.filialId), tipo: 'Item cancelado', descricao: `${c.qtd}× ${c.nome}`, valor: c.total ?? c.precoUnit * c.qtd, motivo: c.motivo, quem: c.por || v.operadorNome, autorizou: c.autorizadoPor })
          if (v.status === 'concluida' && v.descontos) linhas.push({ id: `${v.id}-d`, em: v.criadoEm, filial: nomeFilial(v.filialId), tipo: 'Desconto', descricao: `Pedido ${v.numero}${v.descontoPedido ? `: ${v.descontoPedido.nome}` : ''}`, valor: v.descontos, motivo: v.descontoPedido?.nome || v.itens.find((i) => i.desconto)?.desconto?.nome || '', quem: v.operadorNome, autorizou: v.descontoPedido?.autorizadoPor })
        }
        return {
          linhas: linhas.sort((a, b) => b.em.localeCompare(a.em)),
          colunas: [
            { id: 'em', titulo: 'Quando', valor: (l) => dataHora(l.em) },
            { id: 'filial', titulo: 'Filial' },
            { id: 'tipo', titulo: 'Tipo' },
            { id: 'descricao', titulo: 'O quê' },
            { id: 'motivo', titulo: 'Motivo' },
            { id: 'quem', titulo: 'Quem' },
            { id: 'autorizou', titulo: 'Autorizou', valor: (l) => l.autorizou || '' },
            { id: 'valor', titulo: 'Valor', alinhar: 'direita', render: (l) => reais(l.valor), csv: (l) => valor(l.valor) },
          ],
        }
      }
      default:
        return {
          linhas: [...lista].filter((v) => v.numero).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
          colunas: [
            { id: 'criadoEm', titulo: 'Quando', valor: (v) => dataHora(v.criadoEm) },
            { id: 'filial', titulo: 'Filial', valor: (v) => nomeFilial(v.filialId) },
            { id: 'numero', titulo: 'Pedido', alinhar: 'direita' },
            { id: 'tipo', titulo: 'Tipo', valor: (v) => (v.mesa ? v.mesa.nome : nomeTipoPedido(v.tipo)) },
            { id: 'operadorNome', titulo: 'Atendente' },
            { id: 'itens', titulo: 'Itens', valor: (v) => v.itens.map((i) => `${i.qtd}× ${i.nome}`).join(', ') },
            { id: 'pagamento', titulo: 'Pagamento', valor: (v) => v.pagamentos.map((p) => nomeForma(p.formaId)).join(' + ') },
            { id: 'status', titulo: 'Situação', valor: (v) => ({ concluida: 'Concluída', cancelada: 'Cancelada', estornada: 'Estornada' })[v.status] },
            { id: 'servico', titulo: 'Serviço', alinhar: 'direita', render: (v) => (v.servico ? reais(v.servico) : ''), csv: (v) => (v.servico ? valor(v.servico) : '') },
            { id: 'total', titulo: 'Total', alinhar: 'direita', render: (v) => reais(v.total), csv: (v) => valor(v.total) },
          ],
        }
    }
  }, [aba, lista, formas, intervalo.inicio, intervalo.fim, filiais])

  const exportar = () => {
    const colunas = relatorio.colunas.map((c) => ({ titulo: c.titulo, valor: c.csv || (typeof c.valor === 'function' ? c.valor : (l) => l[c.id]) }))
    const nome = `${RELATORIOS.find((r) => r.id === aba).nome.toLowerCase().replace(/\s+/g, '-')}_${intervalo.inicio}_${intervalo.fim}.csv`
    baixarArquivo(nome, gerarCsv(colunas, relatorio.linhas))
    registrar('relatorio.exportado', nome, { usuario })
  }

  return (
    <Pagina titulo="Relatórios" descricao={rotuloIntervalo(intervalo)} acoes={<Botao variante="secundario" icone="baixar" onClick={exportar} disabled={!relatorio.linhas.length}>Exportar para Excel</Botao>}>
      <div className="painel-filtros">
        <FiltroPeriodo periodo={periodo} aoMudar={setPeriodo} livre={livre} aoMudarLivre={setLivre} />
        {filiaisPermitidas.length > 1 && <SeletorFiliais filiais={filiaisPermitidas} selecionadas={filiais} aoMudar={setFiliais} />}
      </div>
      <Abas abas={RELATORIOS} ativa={aba} aoTrocar={setAba} rotulo="Relatório" />
      <Tabela key={aba} linhas={relatorio.linhas} colunas={relatorio.colunas} densa vazio="Nada neste período." />
    </Pagina>
  )
}
