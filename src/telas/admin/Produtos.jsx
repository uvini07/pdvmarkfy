// Produtos: a lista e a ficha completa, com as abas do PDV Legal
// (principal, configurações, preços por filial, sabores e adicionais,
// composição e fiscal).

import { useMemo, useState } from 'react'
import { banco, useColecao } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { useSessao } from '../../estado/sessao.js'
import { ir } from '../../rotas/useRota.js'
import { Pagina, BarraFiltros, Cartao } from '../../componentes/Pagina.jsx'
import { Tabela } from '../../componentes/Tabela.jsx'
import { Abas, Alternador, Botao, BotaoIcone, Campo, CampoDinheiro, Entrada, Marcador, Selecao, Selo, AreaTexto } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { reais, valor as fmtValor } from '../../lib/dinheiro.js'
import { digitos, textoLimpo } from '../../lib/validacao.js'
import { precoNaFilial, estaPausado } from '../../dados/precos.js'
import { FOTOS } from './fotos.js'

const UNIDADES = ['UN', 'KG', 'CX', 'PCT', 'LT', 'G', 'ML'].map((u) => ({ valor: u, rotulo: u }))

export function Produtos({ parametro }) {
  if (parametro) return <FichaProduto id={parametro} />
  return <ListaProdutos />
}

function ListaProdutos() {
  const { filial, pode } = useSessao()
  const produtos = useColecao('produtos')
  const grupos = useColecao('grupos')
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const [tipo, setTipo] = useState('venda')

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return produtos.filter((p) => (!tipo || p.tipo === tipo) && (!grupo || p.grupoId === grupo) && (!t || `${p.nome} ${p.codigo} ${p.ean}`.toLowerCase().includes(t)))
  }, [produtos, busca, grupo, tipo])

  const nomeGrupo = (id) => grupos.find((g) => g.id === id)?.nome || '—'

  return (
    <Pagina
      titulo="Produtos"
      descricao="Tudo o que o caixa vende e os insumos que o estoque controla."
      acoes={
        pode('admin.cardapio') && (
          <Botao icone="mais" onClick={() => ir('/admin/produtos/novo')}>
            Novo produto
          </Botao>
        )
      }
    >
      <BarraFiltros busca={busca} aoBuscar={setBusca} placeholder="Nome, código ou EAN" total={lista.length}>
        <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo" opcoes={[{ valor: 'venda', rotulo: 'Produtos de venda' }, { valor: 'insumo', rotulo: 'Insumos' }]} vazio="Todos os tipos" />
        <Selecao value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Grupo" opcoes={grupos.map((g) => ({ valor: g.id, rotulo: g.nome }))} vazio="Todos os grupos" />
      </BarraFiltros>
      <Tabela
        rotulo="Produtos"
        linhas={lista}
        aoClicar={(p) => ir(`/admin/produtos/${p.id}`)}
        ordemInicial={{ id: 'nome', dir: 'asc' }}
        colunas={[
          { id: 'imagem', titulo: '', largura: 60, ordenavel: false, render: (p) => (p.imagem ? <img className="miniatura" src={p.imagem} alt="" loading="lazy" /> : <span className="miniatura miniatura--vazia"><Icone nome={p.tipo === 'insumo' ? 'caixa' : 'lata'} tamanho={20} /></span>) },
          { id: 'codigo', titulo: 'Código', largura: 90, ordenar: (p) => Number(p.codigo) || 0 },
          { id: 'nome', titulo: 'Nome', render: (p) => <strong>{p.nome}</strong> },
          { id: 'grupo', titulo: 'Grupo', valor: (p) => nomeGrupo(p.grupoId) },
          { id: 'preco', titulo: `Preço (${filial?.nome})`, alinhar: 'direita', ordenar: (p) => precoNaFilial(p, filial?.id), render: (p) => (p.tipo === 'insumo' ? <span className="mudo">—</span> : <span className="numero">{reais(precoNaFilial(p, filial?.id))}</span>) },
          {
            id: 'situacao',
            titulo: 'Situação',
            largura: 150,
            ordenar: (p) => (p.ativo ? (estaPausado(p, filial?.id) ? 1 : 0) : 2),
            render: (p) => (!p.ativo ? <Selo tom="cinza">Inativo</Selo> : estaPausado(p, filial?.id) ? <Selo tom="vermelho">Esgotado aqui</Selo> : <Selo tom="verde">Ativo</Selo>),
          },
        ]}
      />
    </Pagina>
  )
}

const ABAS = [
  { id: 'principal', nome: 'Principal' },
  { id: 'config', nome: 'Configurações' },
  { id: 'precos', nome: 'Preço por filial' },
  { id: 'modificadores', nome: 'Sabores e adicionais' },
  { id: 'composicao', nome: 'Composição' },
  { id: 'fiscal', nome: 'Fiscal' },
]

const CONFIGS = [
  ['permiteDesconto', 'Aceita desconto', 'Desligado, o caixa não deixa dar desconto neste item.'],
  ['controlaEstoque', 'Baixa o próprio estoque', 'Cada venda tira uma unidade dele. Se tiver composição, baixa os componentes.'],
  ['favorito', 'Favorito', 'Aparece em “Mais pedidos” no caixa.'],
  ['chamaQuantidade', 'Pergunta a quantidade', 'Abre a janela do produto em vez de somar 1.'],
  ['pedePreco', 'Pede o preço na venda', 'Para itens de preço variável.'],
  ['maior18', 'Venda só para maiores de 18', 'O caixa pede para conferir o documento.'],
  ['autoatendimento', 'Disponível no autoatendimento', 'Para o totem, quando ele existir.'],
]

const novoProduto = (grupoId) => ({
  nome: '',
  codigo: '',
  grupoId,
  classes: [],
  tipo: 'venda',
  unidade: 'UN',
  ean: '',
  preco: 0,
  custo: 0,
  imagem: '',
  descricao: '',
  modoPreparo: '',
  gruposModificadores: [],
  composicao: [],
  config: { permiteDesconto: true, controlaEstoque: true, favorito: false, chamaQuantidade: false, pedePreco: false, maior18: false, autoatendimento: true, setor: 'cozinha' },
  ncm: '',
  cest: '',
  origem: '0',
  precos: {},
  pausado: {},
  ativo: true,
})

export function FichaProduto({ id }) {
  const { usuario, pode } = useSessao()
  const produtos = useColecao('produtos')
  const grupos = useColecao('grupos')
  const classes = useColecao('classes')
  const filiais = useColecao('filiais')
  const gruposMod = useColecao('gruposModificadores')
  const original = id === 'novo' ? null : produtos.find((p) => p.id === id)
  const [p, setP] = useState(() => (original ? structuredClone(original) : novoProduto(grupos[0]?.id)))
  const [aba, setAba] = useState('principal')
  const [erros, setErros] = useState({})
  const podeEditar = pode('admin.cardapio')
  const podePreco = pode('admin.precos')

  if (id !== 'novo' && !original) return <Pagina titulo="Produto não encontrado" voltar={{ href: '#/admin/produtos', rotulo: 'Produtos' }} />

  const mudar = (campo, v) => setP((x) => ({ ...x, [campo]: v }))
  const mudarConfig = (campo, v) => setP((x) => ({ ...x, config: { ...x.config, [campo]: v } }))

  const salvar = () => {
    const e = {}
    if (!textoLimpo(p.nome, 60)) e.nome = 'Dê um nome ao produto.'
    if (!p.grupoId) e.grupoId = 'Escolha o grupo.'
    const codigo = String(p.codigo || '').trim()
    if (codigo && produtos.some((x) => x.codigo === codigo && x.id !== p.id)) e.codigo = 'Já existe outro produto com este código.'
    if (p.ean && produtos.some((x) => x.ean === p.ean && x.id !== p.id)) e.ean = 'Já existe outro produto com este EAN.'
    if (p.ean && ![8, 12, 13, 14].includes(p.ean.length)) e.ean = 'EAN deve ter 8, 12, 13 ou 14 números.'
    if (p.ncm && p.ncm.length !== 8) e.ncm = 'O NCM tem 8 números.'
    if (p.cest && p.cest.length !== 7) e.cest = 'O CEST tem 7 números.'
    if (p.composicao.some((c) => !c.produtoId || !(c.qtd > 0))) e.composicao = 'Complete ou tire as linhas vazias da composição.'
    setErros(e)
    if (Object.keys(e).length) {
      avisar('Confira os campos marcados.', 'erro')
      if (e.nome || e.grupoId || e.codigo || e.ean) setAba('principal')
      else if (e.ncm || e.cest) setAba('fiscal')
      else if (e.composicao) setAba('composicao')
      return
    }
    const dados = { ...p, nome: textoLimpo(p.nome, 60), descricao: p.descricao.trim().slice(0, 400), modoPreparo: (p.modoPreparo || '').trim().slice(0, 400), codigo: codigo || String(Math.max(0, ...produtos.map((x) => Number(x.codigo) || 0)) + 1) }
    if (!podePreco && original) {
      dados.preco = original.preco
      dados.precos = original.precos
    }
    const { id: _id, criadoEm, atualizadoEm, ...resto } = dados
    if (original) {
      banco.atualizar('produtos', original.id, resto)
      registrar('cadastro.alterado', `Produto: ${dados.nome}`, { usuario })
      if (original.preco !== dados.preco || JSON.stringify(original.precos) !== JSON.stringify(dados.precos)) registrar('preco.alterado', `${dados.nome}: base ${reais(original.preco)} → ${reais(dados.preco)}`, { usuario })
      avisar('Produto salvo')
    } else {
      const novo = banco.inserir('produtos', resto)
      registrar('cadastro.criado', `Produto: ${novo.nome}`, { usuario })
      avisar('Produto criado')
      ir(`/admin/produtos/${novo.id}`, { substituir: true })
    }
  }

  const remover = async () => {
    const vendido = banco.lista('vendas').some((v) => v.itens.some((i) => i.produtoId === original.id))
    if (vendido) {
      if (!(await confirmar({ titulo: 'Desativar produto?', texto: 'Este produto já tem vendas, então ele é desativado (some do caixa) em vez de apagado.', botao: 'Desativar' }))) return
      banco.atualizar('produtos', original.id, { ativo: false })
      registrar('cadastro.alterado', `Produto desativado: ${original.nome}`, { usuario })
      return ir('/admin/produtos')
    }
    if (!(await confirmar({ titulo: 'Apagar produto?', texto: original.nome, botao: 'Apagar', perigo: true }))) return
    banco.remover('produtos', original.id)
    registrar('cadastro.removido', `Produto: ${original.nome}`, { usuario })
    ir('/admin/produtos')
  }

  const insumos = produtos.filter((x) => x.id !== p.id && !x.composicao?.length)

  return (
    <Pagina
      titulo={original ? original.nome : 'Novo produto'}
      descricao={original ? `Código ${original.codigo}${original.ean ? `, EAN ${original.ean}` : ''}` : 'Preencha a aba principal e salve. As outras abas podem ficar para depois.'}
      voltar={{ href: '#/admin/produtos', rotulo: 'Produtos' }}
      acoes={
        podeEditar && (
          <>
            {original && (
              <Botao variante="fantasma" icone="lixeira" onClick={remover}>
                Apagar
              </Botao>
            )}
            <Botao icone="check" onClick={salvar}>
              Salvar
            </Botao>
          </>
        )
      }
    >
      <Abas abas={ABAS} ativa={aba} aoTrocar={setAba} rotulo="Partes da ficha do produto" />

      <fieldset className="ficha" disabled={!podeEditar}>
        {aba === 'principal' && (
          <div className="ficha__principal">
            <div className="grade-campos">
              <Campo rotulo="Nome no cupom" erro={erros.nome} obrigatorio className="largo">
                {(x) => <Entrada {...x} value={p.nome} onChange={(e) => mudar('nome', e.target.value)} maxLength={60} />}
              </Campo>
              <Campo rotulo="Tipo">
                {(x) => <Selecao {...x} value={p.tipo} onChange={(e) => mudar('tipo', e.target.value)} opcoes={[{ valor: 'venda', rotulo: 'Produto de venda' }, { valor: 'insumo', rotulo: 'Insumo (só estoque)' }]} />}
              </Campo>
              <Campo rotulo="Grupo" erro={erros.grupoId} obrigatorio>
                {(x) => <Selecao {...x} value={p.grupoId} onChange={(e) => mudar('grupoId', e.target.value)} opcoes={grupos.map((g) => ({ valor: g.id, rotulo: g.nome }))} vazio="Escolha" />}
              </Campo>
              <Campo rotulo="Código de venda" erro={erros.codigo} ajuda="Vazio = próximo número">
                {(x) => <Entrada {...x} value={p.codigo} onChange={(e) => mudar('codigo', digitos(e.target.value).slice(0, 8))} inputMode="numeric" />}
              </Campo>
              <Campo rotulo="Código de barras (EAN)" erro={erros.ean}>
                {(x) => <Entrada {...x} value={p.ean} onChange={(e) => mudar('ean', digitos(e.target.value).slice(0, 14))} inputMode="numeric" />}
              </Campo>
              <Campo rotulo="Unidade de estoque">{(x) => <Selecao {...x} value={p.unidade} onChange={(e) => mudar('unidade', e.target.value)} opcoes={UNIDADES} />}</Campo>
              {p.tipo === 'venda' && (
                <Campo rotulo="Preço base" ajuda="Vale nas filiais sem preço próprio">
                  {(x) => <CampoDinheiro {...x} valor={p.preco} aoMudar={(v) => mudar('preco', v)} disabled={!podePreco} />}
                </Campo>
              )}
              <Campo rotulo="Último custo">{(x) => <CampoDinheiro {...x} valor={p.custo} aoMudar={(v) => mudar('custo', v)} />}</Campo>
              {p.tipo === 'venda' && (
                <Campo rotulo="Sai na">
                  {(x) => (
                    <Selecao
                      {...x}
                      value={p.config.setor}
                      onChange={(e) => mudarConfig('setor', e.target.value)}
                      opcoes={[
                        { valor: 'cozinha', rotulo: 'Cozinha (comanda e tela)' },
                        { valor: 'balcao', rotulo: 'Balcão (entrega direto)' },
                      ]}
                    />
                  )}
                </Campo>
              )}
              <Campo rotulo="Foto">{(x) => <Selecao {...x} value={p.imagem} onChange={(e) => mudar('imagem', e.target.value)} vazio="Sem foto" opcoes={FOTOS} />}</Campo>
              <Campo rotulo="Descrição" className="largo">
                {(x) => <AreaTexto {...x} value={p.descricao} onChange={(e) => mudar('descricao', e.target.value)} maxLength={400} />}
              </Campo>
              <Campo rotulo="Modo de preparo (sai para a cozinha)" className="largo">
                {(x) => <AreaTexto {...x} value={p.modoPreparo || ''} onChange={(e) => mudar('modoPreparo', e.target.value)} maxLength={400} />}
              </Campo>
              <div className="largo">
                <p className="campo__rotulo">Classes</p>
                <div className="linha linha--quebra">
                  {classes.map((c) => (
                    <Marcador key={c.id} rotulo={c.nome} marcado={p.classes.includes(c.id)} aoMudar={(m) => mudar('classes', m ? [...p.classes, c.id] : p.classes.filter((x) => x !== c.id))} />
                  ))}
                </div>
              </div>
              <div className="largo">
                <Alternador rotulo="Ativo" descricao="Inativo some do caixa, mas o histórico de vendas fica." ligado={p.ativo} aoMudar={(v) => mudar('ativo', v)} />
              </div>
            </div>
            <aside className="ficha__previa" aria-label="Como aparece no caixa">
              <p className="campo__rotulo">No caixa</p>
              <div className="tema-escuro ficha__previa-caixa">
                <span className="produto">
                  <span className="produto__foto">{p.imagem ? <img src={p.imagem} alt="" /> : <Icone nome="lata" tamanho={34} traco={1.4} />}</span>
                  <span className="produto__nome">{p.nome || 'Nome do produto'}</span>
                  <span className="produto__preco numero">{reais(p.preco)}</span>
                </span>
              </div>
            </aside>
          </div>
        )}

        {aba === 'config' && (
          <Cartao>
            <div className="lista-alternadores">
              {CONFIGS.map(([campo, rotulo, desc]) => (
                <Alternador key={campo} rotulo={rotulo} descricao={desc} ligado={p.config[campo]} aoMudar={(v) => mudarConfig(campo, v)} />
              ))}
            </div>
          </Cartao>
        )}

        {aba === 'precos' && (
          <Cartao titulo="Preço e disponibilidade por filial">
            {!podePreco && <p className="mudo">Seu perfil vê os preços, mas não altera.</p>}
            <table className="tabela tabela--densa">
              <thead>
                <tr>
                  <th>Filial</th>
                  <th className="alinhar-direita">Custo</th>
                  <th className="alinhar-direita">Margem</th>
                  <th>Preço de venda</th>
                  <th>Esgotado</th>
                </tr>
              </thead>
              <tbody>
                {filiais.map((f) => {
                  const preco = p.precos[f.id] ?? p.preco
                  const margem = preco ? Math.round(((preco - p.custo) / preco) * 100) : 0
                  return (
                    <tr key={f.id}>
                      <td>{f.nome}</td>
                      <td className="alinhar-direita numero">{fmtValor(p.custo)}</td>
                      <td className={`alinhar-direita numero ${margem < 30 ? 'negativo' : ''}`}>{p.custo ? `${margem}%` : '—'}</td>
                      <td style={{ width: 200 }}>
                        <div className="linha">
                          <CampoDinheiro valor={preco} aoMudar={(v) => mudar('precos', { ...p.precos, [f.id]: v })} disabled={!podePreco} aria-label={`Preço em ${f.nome}`} />
                          {p.precos[f.id] !== undefined && p.precos[f.id] !== p.preco && podePreco && (
                            <BotaoIcone
                              icone="atualizar"
                              tamanho="p"
                              rotulo="Voltar ao preço base"
                              onClick={() => {
                                const { [f.id]: _, ...resto } = p.precos
                                mudar('precos', resto)
                              }}
                            />
                          )}
                        </div>
                      </td>
                      <td>
                        <Alternador rotulo={<span className="so-leitor">Esgotado em {f.nome}</span>} ligado={Boolean(p.pausado[f.id])} aoMudar={(v) => mudar('pausado', { ...p.pausado, [f.id]: v })} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Cartao>
        )}

        {aba === 'modificadores' && (
          <Cartao titulo="Escolhas que o caixa pede ao vender este produto">
            <p className="mudo">Na ordem em que aparecem. Grupos com mínimo 1 são obrigatórios: o caixa só adiciona o produto depois da escolha.</p>
            <ol className="lista-ordenavel">
              {p.gruposModificadores.map((gid, i) => {
                const g = gruposMod.find((x) => x.id === gid)
                if (!g) return null
                return (
                  <li key={gid}>
                    <span>
                      <strong>{g.nome}</strong>
                      <small className="mudo">
                        {' '}
                        {g.tipo === 'adicional' ? 'Adicional (soma preço)' : 'Escolha'}, {g.min} a {g.max}, {g.opcoes.length} opções
                      </small>
                    </span>
                    <span className="acoes-linha">
                      <BotaoIcone icone="seta-cima" tamanho="p" rotulo="Subir" disabled={i === 0} onClick={() => mudar('gruposModificadores', trocar(p.gruposModificadores, i, i - 1))} />
                      <BotaoIcone icone="seta-baixo" tamanho="p" rotulo="Descer" disabled={i === p.gruposModificadores.length - 1} onClick={() => mudar('gruposModificadores', trocar(p.gruposModificadores, i, i + 1))} />
                      <BotaoIcone icone="fechar" tamanho="p" rotulo="Tirar" variante="perigo" onClick={() => mudar('gruposModificadores', p.gruposModificadores.filter((x) => x !== gid))} />
                    </span>
                  </li>
                )
              })}
            </ol>
            <div className="linha" style={{ marginTop: 12 }}>
              <Selecao
                value=""
                onChange={(e) => e.target.value && mudar('gruposModificadores', [...p.gruposModificadores, e.target.value])}
                aria-label="Adicionar grupo de escolhas"
                vazio="Adicionar grupo de escolhas…"
                opcoes={gruposMod.filter((g) => !p.gruposModificadores.includes(g.id)).map((g) => ({ valor: g.id, rotulo: `${g.nome} (${g.min} a ${g.max})` }))}
              />
              <a className="link" href="#/admin/modificadores">
                Criar grupo novo
              </a>
            </div>
          </Cartao>
        )}

        {aba === 'composicao' && (
          <Cartao titulo="Composição (ficha técnica)">
            <p className="mudo">O que sai do estoque a cada unidade vendida. Ex.: o Copo Mágico baixa 1 copo personalizado. Os sabores escolhidos baixam os próprios insumos (configure em Sabores e adicionais).</p>
            {erros.composicao && <p className="campo__erro">{erros.composicao}</p>}
            <table className="tabela tabela--densa">
              <thead>
                <tr>
                  <th>Componente</th>
                  <th style={{ width: 160 }}>Quantidade</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {p.composicao.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <Selecao value={c.produtoId} onChange={(e) => mudar('composicao', p.composicao.map((x, k) => (k === i ? { ...x, produtoId: e.target.value } : x)))} vazio="Escolha" opcoes={insumos.map((x) => ({ valor: x.id, rotulo: `${x.nome} (${x.unidade})` }))} aria-label="Componente" />
                    </td>
                    <td>
                      <Entrada type="number" min="0" step="0.001" value={c.qtd} onChange={(e) => mudar('composicao', p.composicao.map((x, k) => (k === i ? { ...x, qtd: Number(e.target.value) } : x)))} aria-label="Quantidade" />
                    </td>
                    <td>
                      <BotaoIcone icone="lixeira" tamanho="p" variante="perigo" rotulo="Tirar componente" onClick={() => mudar('composicao', p.composicao.filter((_, k) => k !== i))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Botao variante="contorno" tamanho="p" icone="mais" onClick={() => mudar('composicao', [...p.composicao, { produtoId: '', qtd: 1 }])}>
              Adicionar componente
            </Botao>
          </Cartao>
        )}

        {aba === 'fiscal' && (
          <Cartao titulo="Dados fiscais">
            <p className="mudo">Usados quando a emissão de NFC-e for ligada (precisa de servidor e certificado digital; ver SEGURANCA.md). Confira com o contador.</p>
            <div className="grade-campos">
              <Campo rotulo="NCM" erro={erros.ncm} ajuda="8 números. Coxinha: 1902.20.00 ou 1905.90.90">
                {(x) => <Entrada {...x} value={p.ncm} onChange={(e) => mudar('ncm', digitos(e.target.value).slice(0, 8))} inputMode="numeric" />}
              </Campo>
              <Campo rotulo="CEST" erro={erros.cest} ajuda="7 números, quando houver">
                {(x) => <Entrada {...x} value={p.cest} onChange={(e) => mudar('cest', digitos(e.target.value).slice(0, 7))} inputMode="numeric" />}
              </Campo>
              <Campo rotulo="Origem">
                {(x) => (
                  <Selecao
                    {...x}
                    value={p.origem || '0'}
                    onChange={(e) => mudar('origem', e.target.value)}
                    opcoes={[
                      { valor: '0', rotulo: '0 – Nacional' },
                      { valor: '1', rotulo: '1 – Estrangeira, importação direta' },
                      { valor: '2', rotulo: '2 – Estrangeira, mercado interno' },
                    ]}
                  />
                )}
              </Campo>
            </div>
          </Cartao>
        )}
      </fieldset>
    </Pagina>
  )
}

function trocar(lista, a, b) {
  const nova = [...lista]
  ;[nova[a], nova[b]] = [nova[b], nova[a]]
  return nova
}
