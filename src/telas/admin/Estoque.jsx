// Estoque: saldo por filial, histórico de movimentações e lançamento de
// entrada, saída, perda, transferência, inventário e produção — inclusive pela
// importação do XML da NF-e do fornecedor.

import { useMemo, useRef, useState } from 'react'
import { banco, useColecao, useDoc } from '../../dados/banco.js'
import { useSessao } from '../../estado/sessao.js'
import { movimentar, saldo, TIPOS_MOVIMENTO } from '../../dados/estoque.js'
import { ir } from '../../rotas/useRota.js'
import { Pagina, BarraFiltros, Cartao } from '../../componentes/Pagina.jsx'
import { Tabela } from '../../componentes/Tabela.jsx'
import { Abas, Botao, BotaoIcone, Campo, CampoDinheiro, Entrada, Segmentos, Selecao, Selo } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { reais, quantidade } from '../../lib/dinheiro.js'
import { dataHora, data } from '../../lib/datas.js'
import { lerArquivoTexto } from '../../lib/arquivos.js'
import { lerNfe } from '../../lib/nfe.js'
import { formatarCnpj, textoLimpo } from '../../lib/validacao.js'

const estocaveis = (produtos) => produtos.filter((p) => p.ativo !== false && !p.composicao?.length && (p.tipo === 'insumo' || p.config.controlaEstoque))

export function Estoque() {
  const { filial, pode } = useSessao()
  const produtos = useColecao('produtos')
  const grupos = useColecao('grupos')
  const saldos = useDoc('saldos')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')

  const lista = useMemo(() => {
    const t = busca.toLowerCase()
    return estocaveis(produtos)
      .map((p) => ({ ...p, saldo: saldo(saldos, filial.id, p.id) }))
      .filter((p) => (!t || p.nome.toLowerCase().includes(t)) && (filtro === 'todos' || (filtro === 'baixo' ? p.saldo > 0 && p.saldo <= 5 : p.saldo <= 0)))
  }, [produtos, saldos, filial.id, busca, filtro])

  const valorTotal = lista.reduce((t, p) => t + Math.max(0, p.saldo) * (p.custo || 0), 0)

  return (
    <Pagina
      titulo="Estoque"
      descricao={`Saldo em ${filial.nome}. Valor em estoque pelo último custo: ${reais(valorTotal)}.`}
      acoes={pode('admin.estoque') && <Botao icone="mais" onClick={() => ir('/admin/movimentos/novo')}>Nova movimentação</Botao>}
    >
      <BarraFiltros busca={busca} aoBuscar={setBusca} placeholder="Buscar produto ou insumo" total={lista.length}>
        <Segmentos
          rotulo="Filtrar saldo"
          tamanho="p"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: 'todos', rotulo: 'Todos' },
            { valor: 'baixo', rotulo: 'Acabando (até 5)' },
            { valor: 'zerado', rotulo: 'Zerado ou negativo' },
          ]}
        />
      </BarraFiltros>
      <Tabela
        linhas={lista}
        densa
        ordemInicial={{ id: 'saldo', dir: 'asc' }}
        colunas={[
          { id: 'codigo', titulo: 'Código', largura: 90, ordenar: (p) => Number(p.codigo) },
          { id: 'nome', titulo: 'Produto', render: (p) => <strong>{p.nome}</strong> },
          { id: 'grupo', titulo: 'Grupo', valor: (p) => grupos.find((g) => g.id === p.grupoId)?.nome },
          { id: 'custo', titulo: 'Último custo', alinhar: 'direita', ordenar: (p) => p.custo, render: (p) => <span className="numero">{p.custo ? reais(p.custo) : '—'}</span> },
          {
            id: 'saldo',
            titulo: 'Saldo',
            alinhar: 'direita',
            ordenar: (p) => p.saldo,
            render: (p) => (
              <span className={`numero forte ${p.saldo <= 0 ? 'negativo' : ''}`}>
                {quantidade(p.saldo)} {p.unidade}
                {p.saldo > 0 && p.saldo <= 5 && (
                  <>
                    {' '}
                    <Selo tom="laranja">acabando</Selo>
                  </>
                )}
              </span>
            ),
          },
        ]}
      />
    </Pagina>
  )
}

export function Movimentos({ parametro }) {
  if (parametro === 'novo') return <NovoMovimento />
  return <ListaMovimentos />
}

function ListaMovimentos() {
  const { filial, pode } = useSessao()
  const movimentos = useColecao('movimentosEstoque')
  const filiais = useColecao('filiais')
  const [tipo, setTipo] = useState('')
  const [incluirVendas, setIncluirVendas] = useState(false)
  const [aberto, setAberto] = useState(null)

  const lista = movimentos
    .filter((m) => (m.filialId === filial.id || m.destinoId === filial.id) && (!tipo || m.tipo === tipo) && (incluirVendas || !['venda', 'devolucao'].includes(m.tipo)))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))

  const nomeFilial = (id) => filiais.find((f) => f.id === id)?.nome || ''
  const produtos = useColecao('produtos')
  const nomeProduto = (id) => produtos.find((p) => p.id === id)?.nome || 'Produto removido'

  return (
    <Pagina titulo="Movimentações de estoque" descricao={`Entradas, saídas e ajustes em ${filial.nome}.`} acoes={pode('admin.estoque') && <Botao icone="mais" onClick={() => ir('/admin/movimentos/novo')}>Nova movimentação</Botao>}>
      <BarraFiltros total={lista.length}>
        <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo" vazio="Todos os tipos" opcoes={Object.entries(TIPOS_MOVIMENTO).map(([id, t]) => ({ valor: id, rotulo: t.nome }))} />
        <label className="linha">
          <input type="checkbox" checked={incluirVendas} onChange={(e) => setIncluirVendas(e.target.checked)} /> Mostrar baixas automáticas das vendas
        </label>
      </BarraFiltros>
      <Tabela
        linhas={lista}
        aoClicar={(m) => setAberto(aberto === m.id ? null : m.id)}
        vazio="Nenhuma movimentação ainda. Use “Nova movimentação” para dar entrada nas mercadorias."
        colunas={[
          { id: 'criadoEm', titulo: 'Data', valor: (m) => dataHora(m.criadoEm) },
          { id: 'tipo', titulo: 'Tipo', render: (m) => <Selo tom={TIPOS_MOVIMENTO[m.tipo].sinal > 0 ? 'verde' : TIPOS_MOVIMENTO[m.tipo].sinal < 0 ? 'vermelho' : 'azul'}>{TIPOS_MOVIMENTO[m.tipo].nome}{m.tipo === 'transferencia' ? (m.filialId === filial.id ? ` para ${nomeFilial(m.destinoId)}` : ` de ${nomeFilial(m.filialId)}`) : ''}</Selo> },
          { id: 'documento', titulo: 'Documento / obs.', render: (m) => <span>{m.documento}{m.obs ? <small className="mudo"> {m.obs}</small> : null}</span> },
          { id: 'itens', titulo: 'Itens', render: (m) => (aberto === m.id ? <ul className="lista-mini">{m.itens.map((i, k) => <li key={k}>{quantidade(i.qtd)}× {nomeProduto(i.produtoId)}</li>)}</ul> : `${m.itens.length} item(ns)`) },
          { id: 'valor', titulo: 'Valor', alinhar: 'direita', render: (m) => <span className="numero">{m.valor ? reais(m.valor) : '—'}</span> },
          { id: 'usuarioNome', titulo: 'Por' },
        ]}
      />
    </Pagina>
  )
}

export function NovoMovimento() {
  const { usuario, filial, filiaisPermitidas } = useSessao()
  const produtos = useColecao('produtos')
  const fornecedores = useColecao('fornecedores')
  const movimentos = useColecao('movimentosEstoque')
  const saldos = useDoc('saldos')
  const [aba, setAba] = useState('manual')
  const [tipo, setTipo] = useState('entrada')
  const [destinoId, setDestinoId] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [documento, setDocumento] = useState('')
  const [obs, setObs] = useState('')
  const [itens, setItens] = useState([])
  const [leitor, setLeitor] = useState('')
  const [nota, setNota] = useState(null)
  const arquivoRef = useRef(null)

  const lista = estocaveis(produtos)
  const adicionar = (produtoId, extra = {}) => {
    if (!produtoId) return
    setItens((l) => {
      const i = l.findIndex((x) => x.produtoId === produtoId && !extra.descricaoNota)
      if (i >= 0 && !extra.descricaoNota) return l.map((x, k) => (k === i ? { ...x, qtd: x.qtd + (extra.qtd || 1) } : x))
      const p = produtos.find((x) => x.id === produtoId)
      return [...l, { produtoId, qtd: tipo === 'inventario' ? saldo(saldos, filial.id, produtoId) : 1, custo: p?.custo || 0, ...extra }]
    })
  }

  const lerCodigo = (e) => {
    if (e.key !== 'Enter') return
    const t = leitor.trim()
    const p = lista.find((x) => x.ean === t || x.codigo === t)
    if (p) adicionar(p.id)
    else avisar('Nenhum produto com esse código.', 'erro')
    setLeitor('')
  }

  const importar = async (arquivo) => {
    try {
      const n = lerNfe(await lerArquivoTexto(arquivo, 5_000_000))
      if (movimentos.some((m) => m.chaveNfe === n.chave)) return avisar(`A nota ${n.numero} já foi importada.`, 'erro')
      setNota(n)
      setTipo('entrada')
      setDocumento(`NF-e ${n.numero}/${n.serie}`)
      const forn = fornecedores.find((f) => f.cnpj && f.cnpj === n.emitente.cnpj)
      setFornecedorId(forn?.id || '')
      setItens(
        n.itens.map((it) => {
          const p = lista.find((x) => (it.ean && x.ean === it.ean) || x.nome.toLowerCase() === it.descricao.toLowerCase())
          return { produtoId: p?.id || '', qtd: it.quantidade, fator: 1, custo: it.valorUnitario, descricaoNota: `${it.descricao} (${it.unidade})`, eanNota: it.ean }
        }),
      )
      setAba('manual')
      avisar(`Nota ${n.numero} lida: ${n.itens.length} item(ns). Confira os produtos.`, 'info')
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  const salvar = async () => {
    if (!itens.length) return avisar('Adicione ao menos um item.', 'erro')
    if (itens.some((i) => !i.produtoId)) return avisar('Escolha o produto de todas as linhas da nota.', 'erro')
    if (tipo === 'transferencia' && (!destinoId || destinoId === filial.id)) return avisar('Escolha a filial de destino.', 'erro')
    if (itens.some((i) => !(i.qtd >= 0))) return avisar('Confira as quantidades.', 'erro')
    if (!(await confirmar({ titulo: `Confirmar ${TIPOS_MOVIMENTO[tipo].nome.toLowerCase()}?`, texto: `${itens.length} item(ns) em ${filial.nome}${tipo === 'transferencia' ? ` para ${filiaisPermitidas.find((f) => f.id === destinoId)?.nome}` : ''}.`, botao: 'Confirmar' }))) return
    const mov = movimentar({
      tipo,
      filialId: filial.id,
      destinoId: tipo === 'transferencia' ? destinoId : null,
      fornecedorId: fornecedorId || null,
      documento: textoLimpo(documento, 60),
      obs: textoLimpo(obs, 200),
      itens: itens.map((i) => ({ produtoId: i.produtoId, qtd: i.qtd * (i.fator || 1), custo: i.fator ? Math.round(i.custo / (i.fator || 1)) : i.custo })),
      usuario,
    })
    if (mov && nota) {
      banco.atualizar('movimentosEstoque', mov.id, { chaveNfe: nota.chave, emitente: nota.emitente })
      // Guarda o EAN da nota no produto que ainda não tinha, para a próxima importação casar sozinha
      for (const i of itens) {
        const p = produtos.find((x) => x.id === i.produtoId)
        if (i.eanNota && p && !p.ean && !produtos.some((x) => x.ean === i.eanNota)) banco.atualizar('produtos', p.id, { ean: i.eanNota })
      }
    }
    avisar('Movimentação registrada')
    ir('/admin/movimentos')
  }

  const mudarItem = (i, campo, v) => setItens((l) => l.map((x, k) => (k === i ? { ...x, [campo]: v } : x)))
  const totalNota = itens.reduce((t, i) => t + i.custo * i.qtd, 0)

  return (
    <Pagina titulo="Nova movimentação" descricao={`Em ${filial.nome}`} voltar={{ href: '#/admin/movimentos', rotulo: 'Movimentações' }} acoes={<Botao icone="check" onClick={salvar}>Confirmar</Botao>}>
      <Abas abas={[{ id: 'manual', nome: 'Lançamento' }, { id: 'xml', nome: 'Importar XML da nota' }]} ativa={aba} aoTrocar={setAba} />

      {aba === 'xml' ? (
        <Cartao>
          <div className="importar-xml">
            <Icone nome="nota" tamanho={40} traco={1.3} />
            <h2>Entrada pela NF-e do fornecedor</h2>
            <p className="mudo">Escolha o arquivo XML que o fornecedor mandou por e-mail. O PDV lê os itens, procura os produtos pelo código de barras e preenche a entrada para você conferir.</p>
            <input ref={arquivoRef} type="file" accept=".xml,text/xml,application/xml" hidden onChange={(e) => e.target.files[0] && importar(e.target.files[0])} />
            <Botao icone="enviar" onClick={() => arquivoRef.current?.click()}>
              Escolher arquivo XML
            </Botao>
            <p className="mudo importar-xml__nota">A busca automática das notas na Sefaz (manifesto do destinatário) precisa do certificado digital da loja e de um servidor. Entra quando o banco de dados estiver pronto.</p>
          </div>
        </Cartao>
      ) : (
        <div className="pilha">
          <Cartao>
            <div className="grade-campos">
              <div className="largo">
                <Segmentos
                  rotulo="Tipo de movimentação"
                  valor={tipo}
                  aoMudar={(t) => {
                    setTipo(t)
                    if (t === 'inventario') setItens((l) => l.map((i) => ({ ...i, qtd: saldo(saldos, filial.id, i.produtoId) })))
                  }}
                  opcoes={['entrada', 'saida', 'perda', 'transferencia', 'inventario', 'producao'].map((id) => ({ valor: id, rotulo: TIPOS_MOVIMENTO[id].nome }))}
                />
              </div>
              {tipo === 'transferencia' && (
                <Campo rotulo="Para a filial">{(x) => <Selecao {...x} value={destinoId} onChange={(e) => setDestinoId(e.target.value)} vazio="Escolha" opcoes={filiaisPermitidas.filter((f) => f.id !== filial.id).map((f) => ({ valor: f.id, rotulo: f.nome }))} />}</Campo>
              )}
              {tipo === 'entrada' && (
                <Campo rotulo="Fornecedor">{(x) => <Selecao {...x} value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} vazio="Sem fornecedor" opcoes={fornecedores.map((f) => ({ valor: f.id, rotulo: f.fantasia || f.razaoSocial }))} />}</Campo>
              )}
              <Campo rotulo="Nº do documento">{(x) => <Entrada {...x} value={documento} onChange={(e) => setDocumento(e.target.value)} maxLength={60} placeholder="Ex.: NF 2178" />}</Campo>
              <Campo rotulo="Observação">{(x) => <Entrada {...x} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder={tipo === 'perda' ? 'Ex.: caiu no chão, vencido' : ''} />}</Campo>
            </div>
            {nota && (
              <p className="faixa" style={{ marginTop: 12 }}>
                <Icone nome="nota" tamanho={18} /> NF-e {nota.numero} de {nota.emitente.nome} ({formatarCnpj(nota.emitente.cnpj)}), emitida em {data(nota.emissao)}, total {reais(nota.valorTotal)}.
              </p>
            )}
            {tipo === 'inventario' && <p className="mudo" style={{ marginTop: 12 }}>No inventário você digita o que contou. O sistema ajusta a diferença e guarda o saldo anterior.</p>}
          </Cartao>

          <Cartao titulo="Itens">
            <div className="linha linha--quebra" style={{ marginBottom: 12 }}>
              <Selecao value="" onChange={(e) => adicionar(e.target.value)} aria-label="Adicionar produto" vazio="Adicionar produto…" opcoes={lista.map((p) => ({ valor: p.id, rotulo: `${p.nome} (${p.unidade})` }))} />
              <Entrada icone="busca" value={leitor} onChange={(e) => setLeitor(e.target.value)} onKeyDown={lerCodigo} placeholder="Leitor de código de barras" aria-label="Código de barras" />
            </div>
            {itens.length ? (
              <table className="tabela tabela--densa">
                <thead>
                  <tr>
                    <th>Produto</th>
                    {nota && <th style={{ width: 110 }}>Un. por item da nota</th>}
                    <th style={{ width: 130 }}>{tipo === 'inventario' ? 'Contado' : 'Quantidade'}</th>
                    {tipo === 'inventario' && <th className="alinhar-direita">Sistema</th>}
                    {['entrada', 'producao'].includes(tipo) && <th style={{ width: 170 }}>Custo unitário</th>}
                    <th style={{ width: 50 }} />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i, k) => (
                    <tr key={k}>
                      <td>
                        {i.descricaoNota && <small className="mudo bloco">Na nota: {i.descricaoNota}</small>}
                        {i.descricaoNota ? (
                          <Selecao value={i.produtoId} onChange={(e) => mudarItem(k, 'produtoId', e.target.value)} vazio="Escolha o produto" opcoes={lista.map((p) => ({ valor: p.id, rotulo: p.nome }))} aria-label="Produto" />
                        ) : (
                          <strong>{produtos.find((p) => p.id === i.produtoId)?.nome}</strong>
                        )}
                      </td>
                      {nota && (
                        <td>
                          <Entrada type="number" min="1" value={i.fator || 1} onChange={(e) => mudarItem(k, 'fator', Math.max(1, Number(e.target.value) || 1))} aria-label="Unidades por item da nota" title="Ex.: a nota vende pacote com 12 unidades → 12" />
                        </td>
                      )}
                      <td>
                        <Entrada type="number" min="0" step="0.001" value={i.qtd} onChange={(e) => mudarItem(k, 'qtd', Number(e.target.value))} aria-label="Quantidade" />
                      </td>
                      {tipo === 'inventario' && <td className="alinhar-direita numero">{quantidade(saldo(saldos, filial.id, i.produtoId))}</td>}
                      {['entrada', 'producao'].includes(tipo) && (
                        <td>
                          <CampoDinheiro valor={i.custo} aoMudar={(v) => mudarItem(k, 'custo', v)} aria-label="Custo unitário" />
                        </td>
                      )}
                      <td>
                        <BotaoIcone icone="lixeira" tamanho="p" variante="perigo" rotulo="Tirar item" onClick={() => setItens((l) => l.filter((_, x) => x !== k))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {['entrada', 'producao'].includes(tipo) && (
                  <tfoot>
                    <tr>
                      <td colSpan={nota ? 3 : 2}>Total</td>
                      <td className="numero">{reais(totalNota)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <p className="mudo">Nenhum item ainda. Escolha um produto, passe o leitor ou importe o XML da nota.</p>
            )}
          </Cartao>
        </div>
      )}
    </Pagina>
  )
}
