// Sabores e adicionais (os "modificadores" do PDV Legal): grupos de escolha
// com mínimo, máximo e as opções. Opção ligada a um insumo baixa o estoque.

import { useState } from 'react'
import { banco, useColecao } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { useSessao } from '../../estado/sessao.js'
import { Pagina, BarraFiltros } from '../../componentes/Pagina.jsx'
import { Tabela } from '../../componentes/Tabela.jsx'
import { Modal } from '../../componentes/Modal.jsx'
import { Botao, BotaoIcone, Campo, CampoDinheiro, Entrada, Segmentos, Selecao, Selo } from '../../componentes/ui.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { textoLimpo } from '../../lib/validacao.js'
import { novoId } from '../../lib/seguranca.js'
import { valor } from '../../lib/dinheiro.js'

export function Modificadores() {
  const { usuario, pode } = useSessao()
  const grupos = useColecao('gruposModificadores')
  const produtos = useColecao('produtos')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null)
  const [erros, setErros] = useState({})

  const usadoPor = (g) => produtos.filter((p) => p.gruposModificadores.includes(g.id))
  const lista = grupos.filter((g) => !busca || g.nome.toLowerCase().includes(busca.toLowerCase()) || g.opcoes.some((o) => o.nome.toLowerCase().includes(busca.toLowerCase())))
  const estocaveis = produtos.filter((p) => !p.composicao?.length)

  const salvar = () => {
    const e = {}
    const nome = textoLimpo(editando.nome, 50)
    if (!nome) e.nome = 'Dê um nome ao grupo.'
    const opcoes = editando.opcoes.filter((o) => textoLimpo(o.nome, 50))
    if (!opcoes.length) e.opcoes = 'Cadastre ao menos uma opção.'
    const min = Number(editando.min) || 0
    const max = Number(editando.max) || 1
    if (max < 1) e.max = 'O máximo é pelo menos 1.'
    if (min > max) e.min = 'O mínimo não pode passar do máximo.'
    if (min > opcoes.length) e.min = 'O mínimo é maior que o número de opções.'
    setErros(e)
    if (Object.keys(e).length) return
    const dados = { nome, tipo: editando.tipo, min, max, rateio: Number(editando.rateio) || 0, opcoes: opcoes.map((o) => ({ ...o, nome: textoLimpo(o.nome, 50), preco: editando.tipo === 'adicional' ? o.preco || 0 : 0 })) }
    if (editando.id) banco.atualizar('gruposModificadores', editando.id, dados)
    else banco.inserir('gruposModificadores', dados)
    registrar(editando.id ? 'cadastro.alterado' : 'cadastro.criado', `Sabores e adicionais: ${nome}`, { usuario })
    avisar('Grupo salvo')
    setEditando(null)
  }

  const remover = async (g) => {
    const usos = usadoPor(g)
    if (usos.length) return avisar(`Usado em ${usos.length} produto(s), como ${usos[0].nome}. Tire dos produtos antes de apagar.`, 'erro')
    if (!(await confirmar({ titulo: 'Apagar grupo?', texto: g.nome, botao: 'Apagar', perigo: true }))) return
    banco.remover('gruposModificadores', g.id)
    registrar('cadastro.removido', `Sabores e adicionais: ${g.nome}`, { usuario })
  }

  const mudarOpcao = (i, campo, v) => setEditando((d) => ({ ...d, opcoes: d.opcoes.map((o, k) => (k === i ? { ...o, [campo]: v } : o)) }))
  const podeEditar = pode('admin.cardapio')

  return (
    <Pagina
      titulo="Sabores e adicionais"
      descricao="Grupos de escolha que o caixa pede: sabores das caixas, recheios, coberturas. “Escolha” não muda o preço; “Adicional” soma o preço da opção."
      acoes={
        podeEditar && (
          <Botao icone="mais" onClick={() => (setErros({}), setEditando({ nome: '', tipo: 'observacao', min: 1, max: 1, rateio: 0, opcoes: [{ id: novoId(8), nome: '', preco: 0, insumoId: null, ativo: true }] }))}>
            Novo grupo
          </Botao>
        )
      }
    >
      <BarraFiltros busca={busca} aoBuscar={setBusca} placeholder="Grupo ou opção" total={lista.length} />
      <Tabela
        linhas={lista}
        aoClicar={podeEditar ? (g) => (setErros({}), setEditando(structuredClone(g))) : undefined}
        colunas={[
          { id: 'nome', titulo: 'Grupo', render: (g) => <strong>{g.nome}</strong> },
          { id: 'tipo', titulo: 'Tipo', render: (g) => (g.tipo === 'adicional' ? <Selo tom="amarelo">Adicional</Selo> : <Selo tom="cinza">Escolha</Selo>) },
          { id: 'regra', titulo: 'Mín – máx', valor: (g) => `${g.min} – ${g.max}` },
          { id: 'opcoes', titulo: 'Opções', render: (g) => <span className="mudo">{g.opcoes.map((o) => o.nome).join(', ')}</span> },
          { id: 'uso', titulo: 'Produtos', alinhar: 'direita', valor: (g) => usadoPor(g).length },
          ...(podeEditar ? [{ id: 'acoes', titulo: '', ordenavel: false, alinhar: 'direita', render: (g) => <BotaoIcone icone="lixeira" tamanho="p" variante="perigo" rotulo={`Apagar ${g.nome}`} onClick={() => remover(g)} /> }] : []),
        ]}
      />

      {editando && (
        <Modal
          aberto
          aoFechar={() => setEditando(null)}
          titulo={editando.id ? editando.nome : 'Novo grupo de escolhas'}
          largura="g"
          rodape={
            <>
              <Botao variante="secundario" onClick={() => setEditando(null)}>
                Cancelar
              </Botao>
              <Botao onClick={salvar}>Salvar</Botao>
            </>
          }
        >
          <div className="pilha">
            <div className="grade-campos">
              <Campo rotulo="Nome" erro={erros.nome} className="largo">
                {(x) => <Entrada {...x} value={editando.nome} onChange={(e) => setEditando((d) => ({ ...d, nome: e.target.value }))} maxLength={50} placeholder="Ex.: Sabores (até 5)" />}
              </Campo>
              <div className="largo">
                <Segmentos
                  rotulo="Tipo"
                  valor={editando.tipo}
                  aoMudar={(t) => setEditando((d) => ({ ...d, tipo: t }))}
                  opcoes={[
                    { valor: 'observacao', rotulo: 'Escolha (não muda o preço)' },
                    { valor: 'adicional', rotulo: 'Adicional (soma o preço)' },
                  ]}
                />
              </div>
              <Campo rotulo="Mínimo" erro={erros.min} ajuda="0 = opcional">
                {(x) => <Entrada {...x} type="number" min={0} value={editando.min} onChange={(e) => setEditando((d) => ({ ...d, min: e.target.value }))} />}
              </Campo>
              <Campo rotulo="Máximo" erro={erros.max}>
                {(x) => <Entrada {...x} type="number" min={1} value={editando.max} onChange={(e) => setEditando((d) => ({ ...d, max: e.target.value }))} />}
              </Campo>
              <Campo rotulo="Unidades divididas entre os sabores" ajuda="Ex.: caixa de 50 com 2 sabores = 25 de cada no estoque. 0 = cada opção baixa a própria quantidade.">
                {(x) => <Entrada {...x} type="number" min={0} value={editando.rateio} onChange={(e) => setEditando((d) => ({ ...d, rateio: e.target.value }))} />}
              </Campo>
            </div>
            <div>
              <p className="campo__rotulo">Opções</p>
              {erros.opcoes && <p className="campo__erro">{erros.opcoes}</p>}
              <table className="tabela tabela--densa">
                <thead>
                  <tr>
                    <th>Nome</th>
                    {editando.tipo === 'adicional' && <th style={{ width: 150 }}>Preço</th>}
                    <th>Baixa do estoque</th>
                    <th style={{ width: 50 }} />
                  </tr>
                </thead>
                <tbody>
                  {editando.opcoes.map((o, i) => (
                    <tr key={o.id}>
                      <td>
                        <Entrada value={o.nome} onChange={(e) => mudarOpcao(i, 'nome', e.target.value)} maxLength={50} aria-label="Nome da opção" />
                      </td>
                      {editando.tipo === 'adicional' && (
                        <td>
                          <CampoDinheiro valor={o.preco || 0} aoMudar={(v) => mudarOpcao(i, 'preco', v)} aria-label="Preço da opção" />
                        </td>
                      )}
                      <td>
                        <Selecao value={o.insumoId || ''} onChange={(e) => mudarOpcao(i, 'insumoId', e.target.value || null)} vazio="Não baixa" opcoes={estocaveis.map((p) => ({ valor: p.id, rotulo: p.nome }))} aria-label="Insumo baixado" />
                      </td>
                      <td>
                        <BotaoIcone icone="lixeira" tamanho="p" variante="perigo" rotulo="Tirar opção" onClick={() => setEditando((d) => ({ ...d, opcoes: d.opcoes.filter((_, k) => k !== i) }))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Botao variante="contorno" tamanho="p" icone="mais" onClick={() => setEditando((d) => ({ ...d, opcoes: [...d.opcoes, { id: novoId(8), nome: '', preco: 0, insumoId: null, ativo: true }] }))}>
                Adicionar opção
              </Botao>
            </div>
            {editando.tipo === 'adicional' && editando.opcoes.some((o) => o.preco) && <p className="mudo">Preço somado ao item: {editando.opcoes.filter((o) => o.preco).map((o) => `${o.nome} +${valor(o.preco)}`).join(', ')}</p>}
          </div>
        </Modal>
      )}
    </Pagina>
  )
}
