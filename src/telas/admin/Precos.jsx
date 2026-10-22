// Tabela de preços por filial (com copiar entre filiais e reajuste em lote) e
// promoções automáticas.

import { useMemo, useState } from 'react'
import { banco, useColecao } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { useSessao } from '../../estado/sessao.js'
import { Pagina, BarraFiltros } from '../../componentes/Pagina.jsx'
import { Tabela } from '../../componentes/Tabela.jsx'
import { Modal } from '../../componentes/Modal.jsx'
import { Alternador, Botao, BotaoIcone, Campo, CampoDinheiro, Entrada, Marcador, Segmentos, Selecao, Selo } from '../../componentes/ui.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { porcentagem, reais } from '../../lib/dinheiro.js'
import { data } from '../../lib/datas.js'
import { textoLimpo } from '../../lib/validacao.js'
import { precoNaFilial, promocaoValida, DIAS_SEMANA } from '../../dados/precos.js'

export function TabelaPrecos() {
  const { usuario, filial, filiaisPermitidas, pode } = useSessao()
  const produtos = useColecao('produtos')
  const grupos = useColecao('grupos')
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const [rascunho, setRascunho] = useState({})
  const [janela, setJanela] = useState(null)
  const podeEditar = pode('admin.precos')

  const lista = useMemo(
    () => produtos.filter((p) => p.tipo === 'venda' && p.ativo && (!grupo || p.grupoId === grupo) && (!busca || p.nome.toLowerCase().includes(busca.toLowerCase()))),
    [produtos, grupo, busca],
  )
  const alterados = Object.keys(rascunho).length

  const salvar = () => {
    for (const [id, v] of Object.entries(rascunho)) {
      const p = produtos.find((x) => x.id === id)
      banco.atualizar('produtos', id, { precos: { ...p.precos, [filial.id]: v } })
      registrar('preco.alterado', `${p.nome} em ${filial.nome}: ${reais(precoNaFilial(p, filial.id))} → ${reais(v)}`, { usuario, filialId: filial.id })
    }
    avisar(`${alterados} preço(s) salvos em ${filial.nome}`)
    setRascunho({})
  }

  return (
    <Pagina
      titulo="Tabela de preços"
      descricao={`Preços de venda em ${filial?.nome}. Troque a filial no topo da tela.`}
      acoes={
        podeEditar && (
          <>
            <Botao variante="secundario" icone="copiar" onClick={() => setJanela('copiar')}>
              Copiar de outra filial
            </Botao>
            <Botao variante="secundario" icone="porcento" onClick={() => setJanela('reajuste')}>
              Reajustar
            </Botao>
            <Botao icone="check" onClick={salvar} disabled={!alterados}>
              Salvar {alterados ? `(${alterados})` : ''}
            </Botao>
          </>
        )
      }
    >
      <BarraFiltros busca={busca} aoBuscar={setBusca} placeholder="Buscar produto" total={lista.length}>
        <Selecao value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Grupo" vazio="Todos os grupos" opcoes={grupos.filter((g) => g.noCaixa).map((g) => ({ valor: g.id, rotulo: g.nome }))} />
      </BarraFiltros>
      <Tabela
        linhas={lista}
        densa
        colunas={[
          { id: 'codigo', titulo: 'Código', largura: 90, ordenar: (p) => Number(p.codigo) },
          { id: 'nome', titulo: 'Produto' },
          { id: 'grupo', titulo: 'Grupo', valor: (p) => grupos.find((g) => g.id === p.grupoId)?.nome },
          { id: 'base', titulo: 'Preço base', alinhar: 'direita', ordenar: (p) => p.preco, render: (p) => <span className="numero mudo">{reais(p.preco)}</span> },
          { id: 'custo', titulo: 'Margem', alinhar: 'direita', ordenar: (p) => p.custo, render: (p) => {
            const v = rascunho[p.id] ?? precoNaFilial(p, filial.id)
            return p.custo && v ? <span className="numero">{Math.round(((v - p.custo) / v) * 100)}%</span> : <span className="mudo">—</span>
          } },
          {
            id: 'preco',
            titulo: `Preço em ${filial?.nome}`,
            largura: 200,
            ordenar: (p) => precoNaFilial(p, filial.id),
            render: (p) => <CampoDinheiro valor={rascunho[p.id] ?? precoNaFilial(p, filial.id)} aoMudar={(v) => setRascunho((r) => ({ ...r, [p.id]: v }))} disabled={!podeEditar} aria-label={`Preço de ${p.nome}`} />,
          },
        ]}
      />
      {janela === 'copiar' && <CopiarPrecos destino={filial} filiais={filiaisPermitidas} produtos={produtos} usuario={usuario} aoFechar={() => setJanela(null)} />}
      {janela === 'reajuste' && <Reajuste filial={filial} produtos={lista} usuario={usuario} aoFechar={() => setJanela(null)} />}
    </Pagina>
  )
}

function CopiarPrecos({ destino, filiais, produtos, usuario, aoFechar }) {
  const [origem, setOrigem] = useState(filiais.find((f) => f.id !== destino.id)?.id || '')
  const copiar = async () => {
    const f = filiais.find((x) => x.id === origem)
    if (!(await confirmar({ titulo: `Copiar os preços de ${f.nome}?`, texto: `Todos os preços de ${destino.nome} ficam iguais aos de ${f.nome}.`, botao: 'Copiar preços' }))) return
    for (const p of produtos.filter((x) => x.tipo === 'venda')) banco.atualizar('produtos', p.id, { precos: { ...p.precos, [destino.id]: precoNaFilial(p, origem) } })
    registrar('preco.alterado', `Preços copiados de ${f.nome} para ${destino.nome}`, { usuario, filialId: destino.id })
    avisar('Preços copiados')
    aoFechar()
  }
  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Copiar preços para ${destino.nome}`} largura="p" rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao onClick={copiar} disabled={!origem}>Copiar</Botao></>}>
      <Campo rotulo="Copiar de">{(x) => <Selecao {...x} value={origem} onChange={(e) => setOrigem(e.target.value)} opcoes={filiais.filter((f) => f.id !== destino.id).map((f) => ({ valor: f.id, rotulo: f.nome }))} />}</Campo>
    </Modal>
  )
}

function Reajuste({ filial, produtos, usuario, aoFechar }) {
  const [pct, setPct] = useState(5)
  const [arredondar, setArredondar] = useState(true)
  const novo = (v) => {
    const r = v + porcentagem(v, pct)
    return arredondar ? Math.max(0, Math.ceil((r + 10) / 50) * 50 - 10) : r
  }
  const exemplo = produtos[0]
  const aplicar = async () => {
    if (!(await confirmar({ titulo: `Reajustar ${produtos.length} preço(s)?`, texto: `${pct > 0 ? '+' : ''}${pct}% em ${filial.nome}, nos produtos que estão na lista agora.`, botao: 'Reajustar' }))) return
    for (const p of produtos) banco.atualizar('produtos', p.id, { precos: { ...p.precos, [filial.id]: novo(precoNaFilial(p, filial.id)) } })
    registrar('preco.alterado', `Reajuste de ${pct}% em ${produtos.length} produto(s) em ${filial.nome}`, { usuario, filialId: filial.id })
    avisar('Preços reajustados')
    aoFechar()
  }
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Reajustar preços" subtitulo={`${produtos.length} produto(s) da lista atual, em ${filial.nome}`} largura="p" rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao onClick={aplicar}>Aplicar</Botao></>}>
      <div className="pilha">
        <Campo rotulo="Reajuste (%)" ajuda="Use número negativo para baixar.">{(x) => <Entrada {...x} type="number" step="0.5" value={pct} onChange={(e) => setPct(Number(e.target.value) || 0)} />}</Campo>
        <Alternador rotulo="Terminar em ,40 ou ,90" ligado={arredondar} aoMudar={setArredondar} />
        {exemplo && (
          <p className="mudo">
            Ex.: {exemplo.nome} de {reais(precoNaFilial(exemplo, filial.id))} para <strong>{reais(novo(precoNaFilial(exemplo, filial.id)))}</strong>
          </p>
        )}
      </div>
    </Modal>
  )
}

export function Promocoes() {
  const { usuario, filial, pode } = useSessao()
  const promocoes = useColecao('promocoes')
  const produtos = useColecao('produtos').filter((p) => p.tipo === 'venda')
  const grupos = useColecao('grupos').filter((g) => g.noCaixa)
  const filiais = useColecao('filiais')
  const [editando, setEditando] = useState(null)
  const [erros, setErros] = useState({})
  const podeEditar = pode('admin.precos')

  const descrever = (p) => {
    const quando = [p.dias?.length ? p.dias.map((d) => DIAS_SEMANA[d]).join(', ') : 'Todo dia', p.horaInicio || p.horaFim ? `${p.horaInicio || '00:00'}–${p.horaFim || '24:00'}` : ''].filter(Boolean).join(', ')
    const periodo = p.inicio || p.fim ? ` de ${p.inicio ? data(p.inicio) : 'hoje'} a ${p.fim ? data(p.fim) : 'sem fim'}` : ''
    return quando + periodo
  }

  const salvar = () => {
    const e = {}
    const nome = textoLimpo(editando.nome, 40)
    if (!nome) e.nome = 'Dê um nome (aparece no caixa e no cupom).'
    if (!(editando.valor > 0)) e.valor = 'Informe o desconto.'
    if (editando.tipo === 'percentual' && editando.valor > 100) e.valor = 'No máximo 100%.'
    if (!editando.grupos.length && !editando.produtos.length) e.alvo = 'Escolha ao menos um grupo ou produto.'
    if (editando.inicio && editando.fim && editando.fim < editando.inicio) e.fim = 'O fim é antes do início.'
    setErros(e)
    if (Object.keys(e).length) return
    const { id, criadoEm, atualizadoEm, ...dados } = { ...editando, nome }
    if (id) banco.atualizar('promocoes', id, dados)
    else banco.inserir('promocoes', dados)
    registrar(id ? 'cadastro.alterado' : 'cadastro.criado', `Promoção: ${nome}`, { usuario })
    avisar('Promoção salva')
    setEditando(null)
  }

  const remover = async (p) => {
    if (!(await confirmar({ titulo: 'Apagar promoção?', texto: p.nome, botao: 'Apagar', perigo: true }))) return
    banco.remover('promocoes', p.id)
    registrar('cadastro.removido', `Promoção: ${p.nome}`, { usuario })
  }

  const alternarLista = (campo, id, marcado) => setEditando((d) => ({ ...d, [campo]: marcado ? [...d[campo], id] : d[campo].filter((x) => x !== id) }))

  return (
    <Pagina
      titulo="Promoções"
      descricao="Descontos que o caixa aplica sozinho nos dias e horários escolhidos. Aparecem na gota “Ofertas” e no cupom."
      acoes={podeEditar && <Botao icone="mais" onClick={() => (setErros({}), setEditando({ nome: '', tipo: 'percentual', valor: 10, grupos: [], produtos: [], dias: [], horaInicio: '', horaFim: '', inicio: '', fim: '', filiais: [], ativo: true }))}>Nova promoção</Botao>}
    >
      <Tabela
        linhas={promocoes}
        aoClicar={podeEditar ? (p) => (setErros({}), setEditando(structuredClone(p))) : undefined}
        vazio="Nenhuma promoção ainda."
        colunas={[
          { id: 'nome', titulo: 'Promoção', render: (p) => <strong>{p.nome}</strong> },
          { id: 'valor', titulo: 'Desconto', valor: (p) => (p.tipo === 'valor' ? reais(p.valor) : `${p.valor}%`) },
          { id: 'alvo', titulo: 'Vale para', render: (p) => <span className="mudo">{[...p.grupos.map((g) => grupos.find((x) => x.id === g)?.nome), ...p.produtos.map((x) => produtos.find((y) => y.id === x)?.nome)].filter(Boolean).join(', ')}</span> },
          { id: 'quando', titulo: 'Quando', render: (p) => <span className="mudo">{descrever(p)}</span> },
          { id: 'agora', titulo: `Agora em ${filial?.nome}`, render: (p) => (promocaoValida(p, filial?.id) ? <Selo tom="verde">Valendo</Selo> : p.ativo ? <Selo tom="cinza">Fora do horário</Selo> : <Selo tom="cinza">Inativa</Selo>) },
          ...(podeEditar ? [{ id: 'acoes', titulo: '', ordenavel: false, alinhar: 'direita', render: (p) => <BotaoIcone icone="lixeira" tamanho="p" variante="perigo" rotulo={`Apagar ${p.nome}`} onClick={() => remover(p)} /> }] : []),
        ]}
      />

      {editando && (
        <Modal aberto aoFechar={() => setEditando(null)} titulo={editando.id ? editando.nome : 'Nova promoção'} largura="g" rodape={<><Botao variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao><Botao onClick={salvar}>Salvar</Botao></>}>
          <div className="pilha">
            <div className="grade-campos">
              <Campo rotulo="Nome" erro={erros.nome}>{(x) => <Entrada {...x} value={editando.nome} onChange={(e) => setEditando((d) => ({ ...d, nome: e.target.value }))} maxLength={40} placeholder="Ex.: Terça do churros" />}</Campo>
              <div>
                <p className="campo__rotulo">Tipo de desconto</p>
                <Segmentos rotulo="Tipo de desconto" valor={editando.tipo} aoMudar={(t) => setEditando((d) => ({ ...d, tipo: t, valor: t === 'valor' ? 100 : 10 }))} opcoes={[{ valor: 'percentual', rotulo: 'Porcentagem' }, { valor: 'valor', rotulo: 'Valor fixo' }]} />
              </div>
              <Campo rotulo={editando.tipo === 'valor' ? 'Desconto por unidade' : 'Desconto (%)'} erro={erros.valor}>
                {(x) => (editando.tipo === 'valor' ? <CampoDinheiro {...x} valor={editando.valor} aoMudar={(v) => setEditando((d) => ({ ...d, valor: v }))} /> : <Entrada {...x} type="number" min={1} max={100} value={editando.valor} onChange={(e) => setEditando((d) => ({ ...d, valor: Number(e.target.value) }))} />)}
              </Campo>
              <Campo rotulo="Das (hora)">{(x) => <Entrada {...x} type="time" value={editando.horaInicio} onChange={(e) => setEditando((d) => ({ ...d, horaInicio: e.target.value }))} />}</Campo>
              <Campo rotulo="Até (hora)">{(x) => <Entrada {...x} type="time" value={editando.horaFim} onChange={(e) => setEditando((d) => ({ ...d, horaFim: e.target.value }))} />}</Campo>
              <Campo rotulo="Começa em">{(x) => <Entrada {...x} type="date" value={editando.inicio} onChange={(e) => setEditando((d) => ({ ...d, inicio: e.target.value }))} />}</Campo>
              <Campo rotulo="Termina em" erro={erros.fim}>{(x) => <Entrada {...x} type="date" value={editando.fim} onChange={(e) => setEditando((d) => ({ ...d, fim: e.target.value }))} />}</Campo>
            </div>
            <div>
              <p className="campo__rotulo">Dias da semana (nenhum marcado = todos)</p>
              <div className="linha linha--quebra">
                {DIAS_SEMANA.map((nome, i) => (
                  <Marcador key={i} rotulo={nome} marcado={editando.dias.includes(i)} aoMudar={(m) => alternarLista('dias', i, m)} />
                ))}
              </div>
            </div>
            <div>
              <p className="campo__rotulo">Vale para estes grupos</p>
              {erros.alvo && <p className="campo__erro">{erros.alvo}</p>}
              <div className="linha linha--quebra">
                {grupos.map((g) => (
                  <Marcador key={g.id} rotulo={g.nome} marcado={editando.grupos.includes(g.id)} aoMudar={(m) => alternarLista('grupos', g.id, m)} />
                ))}
              </div>
            </div>
            <Campo rotulo="E também estes produtos">
              {(x) => <Selecao {...x} value="" onChange={(e) => e.target.value && alternarLista('produtos', e.target.value, true)} vazio="Adicionar produto…" opcoes={produtos.filter((p) => !editando.produtos.includes(p.id)).map((p) => ({ valor: p.id, rotulo: p.nome }))} />}
            </Campo>
            {editando.produtos.length > 0 && (
              <div className="linha linha--quebra">
                {editando.produtos.map((id) => (
                  <button key={id} type="button" className="chip-remover" onClick={() => alternarLista('produtos', id, false)}>
                    {produtos.find((p) => p.id === id)?.nome} ×
                  </button>
                ))}
              </div>
            )}
            <div>
              <p className="campo__rotulo">Filiais (nenhuma marcada = todas)</p>
              <div className="linha linha--quebra">
                {filiais.map((f) => (
                  <Marcador key={f.id} rotulo={f.nome} marcado={editando.filiais.includes(f.id)} aoMudar={(m) => alternarLista('filiais', f.id, m)} />
                ))}
              </div>
            </div>
            <Alternador rotulo="Ativa" ligado={editando.ativo} aoMudar={(v) => setEditando((d) => ({ ...d, ativo: v }))} />
          </div>
        </Modal>
      )}
    </Pagina>
  )
}
