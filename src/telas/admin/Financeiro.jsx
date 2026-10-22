// Financeiro: conferência dos caixas fechados (o "acerto de caixa") e contas a
// pagar e receber com o resumo do mês.

import { useMemo, useState } from 'react'
import { banco, useColecao, useDoc } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { conferirCaixa, resumoCaixa } from '../../dados/caixa.js'
import { useSessao } from '../../estado/sessao.js'
import { Pagina, BarraFiltros, Cartao } from '../../componentes/Pagina.jsx'
import { Tabela } from '../../componentes/Tabela.jsx'
import { Modal } from '../../componentes/Modal.jsx'
import { Botao, BotaoIcone, Campo, CampoDinheiro, Entrada, Segmentos, Selecao, Selo, AreaTexto } from '../../componentes/ui.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { imprimir } from '../../componentes/Impressao.jsx'
import { reais } from '../../lib/dinheiro.js'
import { data, dataHora, hoje } from '../../lib/datas.js'
import { textoLimpo } from '../../lib/validacao.js'

const SITUACAO_CAIXA = { aberto: ['azul', 'Aberto'], fechado: ['laranja', 'A conferir'], conferido: ['verde', 'Conferido'] }

export function ConferenciaCaixa() {
  const { usuario, filial, pode } = useSessao()
  const caixas = useColecao('caixas')
  const vendas = useColecao('vendas')
  const formas = useColecao('formasPagamento')
  const pontos = useColecao('pontosVenda')
  const [aberto, setAberto] = useState(null)
  const [obs, setObs] = useState('')

  const lista = caixas.filter((c) => c.filialId === filial.id).sort((a, b) => b.abertoEm.localeCompare(a.abertoEm))
  const caixa = aberto && caixas.find((c) => c.id === aberto)
  const r = caixa && resumoCaixa(caixa, vendas, formas)

  return (
    <Pagina titulo="Conferência de caixa" descricao={`Caixas de ${filial.nome}. O operador fecha sem ver o valor esperado; aqui o gerente confere a diferença.`}>
      <Tabela
        linhas={lista}
        aoClicar={(c) => (setObs(''), setAberto(c.id))}
        vazio="Nenhum caixa aberto nesta filial ainda."
        colunas={[
          { id: 'abertoEm', titulo: 'Aberto em', valor: (c) => dataHora(c.abertoEm) },
          { id: 'pdv', titulo: 'Caixa', valor: (c) => pontos.find((p) => p.id === c.pdvId)?.nome },
          { id: 'operadorNome', titulo: 'Operador' },
          { id: 'vendido', titulo: 'Vendido', alinhar: 'direita', render: (c) => <span className="numero">{reais(c.vendido ?? resumoCaixa(c, vendas, formas).vendido)}</span> },
          { id: 'diferenca', titulo: 'Diferença', alinhar: 'direita', render: (c) => (c.status === 'aberto' ? <span className="mudo">—</span> : <span className={`numero forte ${c.diferenca < 0 ? 'negativo' : c.diferenca > 0 ? 'positivo' : ''}`}>{reais(c.diferenca)}</span>) },
          { id: 'status', titulo: 'Situação', render: (c) => <Selo tom={SITUACAO_CAIXA[c.status][0]}>{SITUACAO_CAIXA[c.status][1]}</Selo> },
        ]}
      />

      {caixa && (
        <Modal
          aberto
          aoFechar={() => setAberto(null)}
          titulo={`Caixa de ${caixa.operadorNome}`}
          subtitulo={`${pontos.find((p) => p.id === caixa.pdvId)?.nome}, aberto ${dataHora(caixa.abertoEm)}${caixa.fechadoEm ? `, fechado ${dataHora(caixa.fechadoEm)}` : ''}`}
          largura="g"
          rodape={
            <>
              <Botao variante="secundario" icone="imprimir" onClick={() => imprimir('fechamento', caixa)}>
                Imprimir
              </Botao>
              {caixa.status === 'fechado' && pode('admin.financeiro') && (
                <Botao
                  icone="check"
                  onClick={() => {
                    conferirCaixa(caixa.id, { usuario, obs: textoLimpo(obs, 200) })
                    avisar('Caixa conferido')
                    setAberto(null)
                  }}
                >
                  Marcar como conferido
                </Botao>
              )}
            </>
          }
        >
          <div className="pilha">
            <div className="resumo-caixa">
              <div>
                <span>Vendas</span>
                <strong className="numero">{r.vendas}</strong>
              </div>
              <div>
                <span>Vendido</span>
                <strong className="numero">{reais(r.vendido)}</strong>
              </div>
              <div>
                <span>Descontos</span>
                <strong className="numero">{reais(r.descontos)}</strong>
              </div>
              <div>
                <span>Canceladas</span>
                <strong className="numero">
                  {r.canceladas} ({reais(r.valorCancelado)})
                </strong>
              </div>
              {r.servico > 0 && (
                <div>
                  <span>Taxa de serviço (mesas)</span>
                  <strong className="numero">{reais(r.servico)}</strong>
                </div>
              )}
            </div>
            <table className="tabela tabela--densa">
              <thead>
                <tr>
                  <th>Forma</th>
                  <th className="alinhar-direita">Esperado</th>
                  <th className="alinhar-direita">Contado</th>
                  <th className="alinhar-direita">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {formas.map((f) => {
                  const esp = caixa.esperado?.[f.id] ?? r.esperado[f.id] ?? 0
                  const cont = caixa.contado?.[f.id]
                  const dif = cont === undefined ? null : cont - esp
                  return (
                    <tr key={f.id}>
                      <td>{f.nome}</td>
                      <td className="alinhar-direita numero">{reais(esp)}</td>
                      <td className="alinhar-direita numero">{cont === undefined ? '—' : reais(cont)}</td>
                      <td className={`alinhar-direita numero ${dif < 0 ? 'negativo' : dif > 0 ? 'positivo' : ''}`}>{dif === null ? '—' : reais(dif)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mudo">
              Fundo de troco {reais(caixa.fundo)}, suprimentos {reais(r.suprimentos)}, sangrias {reais(r.sangrias)}.
              {caixa.obs && ` Obs. do operador: ${caixa.obs}`}
              {caixa.conferidoPor && ` Conferido por ${caixa.conferidoPor} em ${dataHora(caixa.conferidoEm)}.`}
            </p>
            {caixa.movimentos.length > 0 && (
              <ul className="lista-simples">
                {caixa.movimentos.map((m) => (
                  <li key={m.id}>
                    <span>
                      {dataHora(m.em)} {m.tipo === 'sangria' ? 'Sangria' : 'Suprimento'} por {m.usuarioNome}
                      {m.motivo && <small className="mudo"> {m.motivo}</small>}
                    </span>
                    <span className="numero">{reais(m.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
            {caixa.status === 'fechado' && <Campo rotulo="Observação da conferência">{(x) => <Entrada {...x} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder="Ex.: diferença explicada pelo operador" />}</Campo>}
          </div>
        </Modal>
      )}
    </Pagina>
  )
}

export function Contas() {
  const { usuario, filial, pode } = useSessao()
  const contas = useColecao('contas')
  const fornecedores = useColecao('fornecedores')
  const vendas = useColecao('vendas')
  const config = useDoc('config')
  const [tipo, setTipo] = useState('pagar')
  const [mes, setMes] = useState(hoje().slice(0, 7))
  const [editando, setEditando] = useState(null)
  const [erros, setErros] = useState({})
  const plano = config.planoContas || { pagar: [], receber: [] }
  const h = hoje()

  const doMes = useMemo(() => contas.filter((c) => c.filialId === filial.id && c.vencimento.startsWith(mes)), [contas, filial.id, mes])
  const lista = doMes.filter((c) => c.tipo === tipo).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  const soma = (l) => l.reduce((t, c) => t + c.valor, 0)
  const vendasMes = vendas.filter((v) => v.filialId === filial.id && v.status === 'concluida' && v.dia.startsWith(mes)).reduce((t, v) => t + v.total, 0)
  const pagar = doMes.filter((c) => c.tipo === 'pagar')
  const receber = doMes.filter((c) => c.tipo === 'receber')
  const vencidas = doMes.filter((c) => !c.pagoEm && c.vencimento < h)

  const salvar = () => {
    const e = {}
    if (!textoLimpo(editando.descricao, 80)) e.descricao = 'Descreva a conta.'
    if (!(editando.valor > 0)) e.valor = 'Informe o valor.'
    if (!editando.vencimento) e.vencimento = 'Informe o vencimento.'
    setErros(e)
    if (Object.keys(e).length) return
    const { id, criadoEm, atualizadoEm, ...dados } = { ...editando, descricao: textoLimpo(editando.descricao, 80), obs: textoLimpo(editando.obs, 300) }
    if (id) banco.atualizar('contas', id, dados)
    else banco.inserir('contas', { ...dados, filialId: filial.id })
    registrar(id ? 'cadastro.alterado' : 'cadastro.criado', `Conta a ${dados.tipo}: ${dados.descricao}, ${reais(dados.valor)}`, { usuario, filialId: filial.id })
    avisar('Conta salva')
    setEditando(null)
  }

  const baixar = (c) => {
    banco.atualizar('contas', c.id, { pagoEm: c.pagoEm ? null : h })
    registrar('cadastro.alterado', `${c.pagoEm ? 'Reaberta' : c.tipo === 'pagar' ? 'Paga' : 'Recebida'}: ${c.descricao}`, { usuario, filialId: filial.id })
  }

  const remover = async (c) => {
    if (!(await confirmar({ titulo: 'Apagar conta?', texto: `${c.descricao}, ${reais(c.valor)}`, botao: 'Apagar', perigo: true }))) return
    banco.remover('contas', c.id)
    registrar('cadastro.removido', `Conta: ${c.descricao}`, { usuario, filialId: filial.id })
  }

  const podeEditar = pode('admin.financeiro')

  return (
    <Pagina
      titulo="Contas a pagar e receber"
      descricao={`${filial.nome}. Vendas do caixa entram sozinhas no resultado.`}
      acoes={podeEditar && <Botao icone="mais" onClick={() => (setErros({}), setEditando({ tipo, descricao: '', categoria: plano[tipo][0], valor: 0, vencimento: h, pagoEm: null, fornecedorId: '', obs: '' }))}>Nova conta</Botao>}
    >
      <div className="resumo-caixa resumo-caixa--grande">
        <div>
          <span>Vendas no caixa</span>
          <strong className="numero">{reais(vendasMes)}</strong>
        </div>
        <div>
          <span>Outras receitas</span>
          <strong className="numero positivo">{reais(soma(receber))}</strong>
        </div>
        <div>
          <span>Despesas</span>
          <strong className="numero negativo">{reais(soma(pagar))}</strong>
        </div>
        <div>
          <span>Resultado do mês</span>
          <strong className={`numero ${vendasMes + soma(receber) - soma(pagar) < 0 ? 'negativo' : ''}`}>{reais(vendasMes + soma(receber) - soma(pagar))}</strong>
        </div>
      </div>
      {vencidas.length > 0 && (
        <p className="faixa faixa--alerta">
          {vencidas.length} conta(s) vencida(s) sem baixa neste mês, total {reais(soma(vencidas))}.
        </p>
      )}
      <BarraFiltros total={lista.length}>
        <Segmentos rotulo="Tipo" valor={tipo} aoMudar={setTipo} opcoes={[{ valor: 'pagar', rotulo: `A pagar (${pagar.length})` }, { valor: 'receber', rotulo: `A receber (${receber.length})` }]} />
        <input type="month" className="entrada entrada-mes" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês" />
      </BarraFiltros>
      <Tabela
        linhas={lista}
        aoClicar={podeEditar ? (c) => (setErros({}), setEditando({ ...c })) : undefined}
        vazio={`Nenhuma conta a ${tipo} neste mês.`}
        colunas={[
          { id: 'vencimento', titulo: 'Vencimento', valor: (c) => data(c.vencimento) },
          { id: 'descricao', titulo: 'Descrição', render: (c) => <span><strong>{c.descricao}</strong>{c.fornecedorId && <small className="mudo"> {fornecedores.find((f) => f.id === c.fornecedorId)?.fantasia}</small>}</span> },
          { id: 'categoria', titulo: 'Categoria' },
          { id: 'valor', titulo: 'Valor', alinhar: 'direita', ordenar: (c) => c.valor, render: (c) => <span className="numero forte">{reais(c.valor)}</span> },
          { id: 'situacao', titulo: 'Situação', ordenar: (c) => (c.pagoEm ? 2 : c.vencimento < h ? 0 : 1), render: (c) => (c.pagoEm ? <Selo tom="verde">{tipo === 'pagar' ? 'Paga' : 'Recebida'} {data(c.pagoEm)}</Selo> : c.vencimento < h ? <Selo tom="vermelho">Vencida</Selo> : <Selo tom="cinza">Em aberto</Selo>) },
          ...(podeEditar
            ? [
                {
                  id: 'acoes',
                  titulo: '',
                  alinhar: 'direita',
                  ordenavel: false,
                  render: (c) => (
                    <span className="acoes-linha">
                      <Botao variante="contorno" tamanho="p" onClick={() => baixar(c)}>
                        {c.pagoEm ? 'Reabrir' : tipo === 'pagar' ? 'Pagar' : 'Receber'}
                      </Botao>
                      <BotaoIcone icone="lixeira" tamanho="p" variante="perigo" rotulo="Apagar" onClick={() => remover(c)} />
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />

      {editando && (
        <Modal aberto aoFechar={() => setEditando(null)} titulo={editando.id ? 'Editar conta' : `Nova conta a ${editando.tipo}`} largura="m" rodape={<><Botao variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao><Botao onClick={salvar}>Salvar</Botao></>}>
          <div className="grade-campos">
            <div className="largo">
              <Segmentos rotulo="Tipo" valor={editando.tipo} aoMudar={(t) => setEditando((d) => ({ ...d, tipo: t, categoria: plano[t][0] }))} opcoes={[{ valor: 'pagar', rotulo: 'A pagar' }, { valor: 'receber', rotulo: 'A receber' }]} />
            </div>
            <Campo rotulo="Descrição" erro={erros.descricao} className="largo">{(x) => <Entrada {...x} value={editando.descricao} onChange={(e) => setEditando((d) => ({ ...d, descricao: e.target.value }))} maxLength={80} />}</Campo>
            <Campo rotulo="Categoria">{(x) => <Selecao {...x} value={editando.categoria} onChange={(e) => setEditando((d) => ({ ...d, categoria: e.target.value }))} opcoes={plano[editando.tipo].map((c) => ({ valor: c, rotulo: c }))} />}</Campo>
            <Campo rotulo="Valor" erro={erros.valor}>{(x) => <CampoDinheiro {...x} valor={editando.valor} aoMudar={(v) => setEditando((d) => ({ ...d, valor: v }))} />}</Campo>
            <Campo rotulo="Vencimento" erro={erros.vencimento}>{(x) => <Entrada {...x} type="date" value={editando.vencimento} onChange={(e) => setEditando((d) => ({ ...d, vencimento: e.target.value }))} />}</Campo>
            {editando.tipo === 'pagar' && <Campo rotulo="Fornecedor">{(x) => <Selecao {...x} value={editando.fornecedorId || ''} onChange={(e) => setEditando((d) => ({ ...d, fornecedorId: e.target.value }))} vazio="Nenhum" opcoes={fornecedores.map((f) => ({ valor: f.id, rotulo: f.fantasia || f.razaoSocial }))} />}</Campo>}
            <Campo rotulo="Observação" className="largo">{(x) => <AreaTexto {...x} value={editando.obs || ''} onChange={(e) => setEditando((d) => ({ ...d, obs: e.target.value }))} maxLength={300} />}</Campo>
          </div>
        </Modal>
      )}
    </Pagina>
  )
}
