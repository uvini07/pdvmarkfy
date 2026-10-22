// Grupos (as gotas do caixa, com foto, cor e ordem) e classes.

import { useState } from 'react'
import { banco, useColecao } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { useSessao } from '../../estado/sessao.js'
import { Pagina } from '../../componentes/Pagina.jsx'
import { Modal } from '../../componentes/Modal.jsx'
import { CadastroSimples } from '../../componentes/CadastroSimples.jsx'
import { Botao, BotaoIcone, Campo, Entrada, Alternador, Selo, Selecao } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { textoLimpo } from '../../lib/validacao.js'
import { FOTOS } from './fotos.js'

export function Grupos() {
  const { usuario, pode } = useSessao()
  const grupos = useColecao('grupos')
  const produtos = useColecao('produtos')
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')
  const ordenados = [...grupos].sort((a, b) => a.ordem - b.ordem)

  const mover = (g, delta) => {
    const i = ordenados.indexOf(g)
    const outro = ordenados[i + delta]
    if (!outro) return
    banco.substituir(
      'grupos',
      grupos.map((x) => (x.id === g.id ? { ...x, ordem: outro.ordem } : x.id === outro.id ? { ...x, ordem: g.ordem } : x)),
    )
  }

  const salvar = () => {
    const nome = textoLimpo(editando.nome, 40)
    if (!nome) return setErro('Dê um nome ao grupo.')
    const dados = { nome, imagem: editando.imagem || '', cor: editando.cor || '#F9C115', noCaixa: editando.noCaixa !== false, ativo: editando.ativo !== false }
    if (editando.id) banco.atualizar('grupos', editando.id, dados)
    else banco.inserir('grupos', { ...dados, codigo: String(480100 + grupos.length * 7), ordem: Math.max(0, ...grupos.map((g) => g.ordem)) + 1 })
    registrar(editando.id ? 'cadastro.alterado' : 'cadastro.criado', `Grupo: ${nome}`, { usuario })
    avisar('Grupo salvo')
    setEditando(null)
  }

  const remover = async (g) => {
    if (produtos.some((p) => p.grupoId === g.id)) return avisar('Este grupo tem produtos. Mova os produtos para outro grupo ou desative o grupo.', 'erro')
    if (!(await confirmar({ titulo: 'Apagar grupo?', texto: g.nome, botao: 'Apagar', perigo: true }))) return
    banco.remover('grupos', g.id)
    registrar('cadastro.removido', `Grupo: ${g.nome}`, { usuario })
  }

  const podeEditar = pode('admin.cardapio')

  return (
    <Pagina
      titulo="Grupos"
      descricao="Os grupos são as gotas do lado esquerdo do caixa, nesta ordem. Use as setas para reordenar."
      acoes={
        podeEditar && (
          <Botao icone="mais" onClick={() => (setErro(''), setEditando({ ativo: true, noCaixa: true, cor: '#F9C115' }))}>
            Novo grupo
          </Botao>
        )
      }
    >
      <ul className="lista-grupos">
        {ordenados.map((g, i) => {
          const qtd = produtos.filter((p) => p.grupoId === g.id).length
          return (
            <li key={g.id} className="lista-grupos__item">
              <span className="lista-grupos__gota" style={{ background: g.imagem ? 'var(--preto)' : g.cor }}>
                {g.imagem ? <img src={g.imagem} alt="" /> : <Icone nome={g.icone || 'caixa'} tamanho={22} />}
              </span>
              <span className="lista-grupos__info">
                <strong>{g.nome}</strong>
                <small className="mudo">
                  {qtd} produto(s), código {g.codigo}
                </small>
              </span>
              {!g.noCaixa && <Selo tom="cinza">Fora do caixa</Selo>}
              {g.ativo === false && <Selo tom="cinza">Inativo</Selo>}
              {podeEditar && (
                <span className="acoes-linha">
                  <BotaoIcone icone="seta-cima" rotulo={`Subir ${g.nome}`} tamanho="p" onClick={() => mover(g, -1)} disabled={i === 0} />
                  <BotaoIcone icone="seta-baixo" rotulo={`Descer ${g.nome}`} tamanho="p" onClick={() => mover(g, 1)} disabled={i === ordenados.length - 1} />
                  <BotaoIcone icone="editar" rotulo={`Editar ${g.nome}`} tamanho="p" onClick={() => (setErro(''), setEditando({ ...g }))} />
                  <BotaoIcone icone="lixeira" rotulo={`Apagar ${g.nome}`} tamanho="p" variante="perigo" onClick={() => remover(g)} />
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {editando && (
        <Modal
          aberto
          aoFechar={() => setEditando(null)}
          titulo={editando.id ? 'Editar grupo' : 'Novo grupo'}
          largura="m"
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
            <Campo rotulo="Nome" erro={erro}>
              {(p) => <Entrada {...p} value={editando.nome || ''} onChange={(e) => setEditando((d) => ({ ...d, nome: e.target.value }))} maxLength={40} autoFocus />}
            </Campo>
            <Campo rotulo="Foto da gota">
              {(p) => <Selecao {...p} value={editando.imagem || ''} onChange={(e) => setEditando((d) => ({ ...d, imagem: e.target.value }))} vazio="Sem foto (usa a cor)" opcoes={FOTOS} />}
            </Campo>
            {!editando.imagem && (
              <Campo rotulo="Cor">
                {(p) => <input {...p} type="color" className="entrada entrada-cor" value={editando.cor || '#F9C115'} onChange={(e) => setEditando((d) => ({ ...d, cor: e.target.value }))} />}
              </Campo>
            )}
            <Alternador rotulo="Aparece no caixa" descricao="Desligue para grupos internos, como insumos." ligado={editando.noCaixa !== false} aoMudar={(v) => setEditando((d) => ({ ...d, noCaixa: v }))} />
            <Alternador rotulo="Ativo" ligado={editando.ativo !== false} aoMudar={(v) => setEditando((d) => ({ ...d, ativo: v }))} />
          </div>
        </Modal>
      )}
    </Pagina>
  )
}

export function Classes() {
  const produtos = useColecao('produtos')
  return (
    <CadastroSimples
      colecao="classes"
      titulo="Classes"
      descricao="Etiquetas extras do produto (um produto pode ter várias). “Mais pedidos” vira a primeira gota do caixa."
      singular="Classe"
      permissao="admin.cardapio"
      campos={[{ id: 'nome', rotulo: 'Nome', obrigatorio: true, max: 40, largo: true }]}
      podeRemover={(c) => (c.id === 'c-mais-pedidos' ? '“Mais pedidos” é usada pelo caixa e não pode ser apagada.' : true)}
      colunas={[
        { id: 'nome', titulo: 'Classe' },
        { id: 'produtos', titulo: 'Produtos', alinhar: 'direita', valor: (c) => produtos.filter((p) => p.classes?.includes(c.id)).length },
      ]}
    />
  )
}
