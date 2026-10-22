// Usuários e perfis de acesso. Só o hash do PIN e da senha é guardado: ao
// editar, os campos de PIN e senha ficam vazios e só mudam se forem digitados.

import { useState } from 'react'
import { banco, useColecao } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { PERMISSOES, rotuloPermissao } from '../../dados/permissoes.js'
import { salvarUsuario, validarUsuario, desbloquearUsuario, estaBloqueado } from '../../dados/usuarios.js'
import { useSessao } from '../../estado/sessao.js'
import { Pagina, BarraFiltros } from '../../componentes/Pagina.jsx'
import { Tabela } from '../../componentes/Tabela.jsx'
import { Modal } from '../../componentes/Modal.jsx'
import { Alternador, Botao, BotaoIcone, Campo, Entrada, Marcador, Selecao, Selo, AreaTexto } from '../../componentes/ui.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { dataHora } from '../../lib/datas.js'
import { textoLimpo } from '../../lib/validacao.js'

export function Usuarios() {
  const { usuario: eu } = useSessao()
  const usuarios = useColecao('usuarios')
  const perfis = useColecao('perfis')
  const filiais = useColecao('filiais')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null)
  const [erros, setErros] = useState({})
  const [ocupado, setOcupado] = useState(false)

  const lista = usuarios.filter((u) => !busca || `${u.nome} ${u.login}`.toLowerCase().includes(busca.toLowerCase()))
  const nomePerfil = (id) => perfis.find((p) => p.id === id)?.nome || '—'

  const salvar = async () => {
    const novo = !editando.id
    const e = validarUsuario(editando, { novo, usuarios })
    if (editando.senha && editando.senha !== editando.confirmar) e.confirmar = 'As senhas não são iguais.'
    if (editando.id === eu.id && editando.ativo === false) e.ativo = 'Você não pode desativar o próprio acesso.'
    if (editando.dono && editando.perfilId !== 'perfil-admin') e.perfilId = 'O administrador principal continua administrador.'
    setErros(e)
    if (Object.keys(e).length) return
    setOcupado(true)
    await salvarUsuario(editando, eu)
    if (editando.id && editando.pin && editando.demonstracao) banco.atualizar('usuarios', editando.id, { demonstracao: false })
    setOcupado(false)
    avisar(novo ? 'Usuário criado' : 'Usuário salvo')
    setEditando(null)
  }

  return (
    <Pagina
      titulo="Usuários"
      descricao="Cada pessoa tem o próprio acesso. O PIN entra no caixa e na cozinha; a senha entra na retaguarda. Nunca compartilhe."
      acoes={<Botao icone="mais" onClick={() => (setErros({}), setEditando({ nome: '', login: '', perfilId: 'perfil-atendente', filiais: [], todasFiliais: false, ativo: true, pin: '', senha: '', confirmar: '' }))}>Novo usuário</Botao>}
    >
      <BarraFiltros busca={busca} aoBuscar={setBusca} placeholder="Nome ou login" total={lista.length} />
      <Tabela
        linhas={lista}
        aoClicar={(u) => (setErros({}), setEditando({ ...u, pin: '', senha: '', confirmar: '', temSenha: Boolean(u.senha) }))}
        ordemInicial={{ id: 'nome', dir: 'asc' }}
        colunas={[
          { id: 'nome', titulo: 'Nome', render: (u) => <span><strong>{u.nome}</strong>{u.demonstracao && <> <Selo tom="laranja">PIN de demonstração</Selo></>}</span> },
          { id: 'login', titulo: 'Login' },
          { id: 'perfil', titulo: 'Perfil', valor: (u) => nomePerfil(u.perfilId) },
          { id: 'filiais', titulo: 'Filiais', valor: (u) => (u.todasFiliais ? 'Todas' : u.filiais.map((f) => filiais.find((x) => x.id === f)?.nome).join(', ')) },
          { id: 'acesso', titulo: 'Acessos', valor: (u) => [u.pin && 'PIN', u.senha && 'senha'].filter(Boolean).join(' e ') },
          {
            id: 'situacao',
            titulo: 'Situação',
            render: (u) =>
              !u.ativo ? (
                <Selo tom="cinza">Inativo</Selo>
              ) : estaBloqueado(u) ? (
                <span className="linha">
                  <Selo tom="vermelho">Bloqueado</Selo>
                  <Botao variante="contorno" tamanho="p" onClick={() => desbloquearUsuario(u.id, eu)}>
                    Desbloquear
                  </Botao>
                </span>
              ) : (
                <Selo tom="verde">Ativo</Selo>
              ),
          },
        ]}
      />

      {editando && (
        <Modal
          aberto
          aoFechar={() => setEditando(null)}
          titulo={editando.id ? editando.nome : 'Novo usuário'}
          largura="g"
          rodape={
            <>
              <Botao variante="secundario" onClick={() => setEditando(null)}>
                Cancelar
              </Botao>
              <Botao onClick={salvar} carregando={ocupado}>
                Salvar
              </Botao>
            </>
          }
        >
          <form className="pilha" onSubmit={(e) => (e.preventDefault(), salvar())} autoComplete="off">
            <div className="grade-campos">
              <Campo rotulo="Nome" erro={erros.nome}>{(x) => <Entrada {...x} value={editando.nome} onChange={(e) => setEditando((d) => ({ ...d, nome: e.target.value }))} maxLength={60} />}</Campo>
              <Campo rotulo="Login" erro={erros.login}>{(x) => <Entrada {...x} value={editando.login} onChange={(e) => setEditando((d) => ({ ...d, login: e.target.value.toLowerCase() }))} maxLength={30} autoCapitalize="none" />}</Campo>
              <Campo rotulo="Perfil de acesso" erro={erros.perfilId}>{(x) => <Selecao {...x} value={editando.perfilId} onChange={(e) => setEditando((d) => ({ ...d, perfilId: e.target.value }))} opcoes={perfis.map((p) => ({ valor: p.id, rotulo: p.nome }))} />}</Campo>
              <Campo rotulo={editando.id ? 'Novo PIN (deixe vazio para manter)' : 'PIN do caixa'} erro={erros.pin} ajuda="4 a 6 números, sem sequência nem repetição">
                {(x) => <Entrada {...x} type="password" inputMode="numeric" value={editando.pin} onChange={(e) => setEditando((d) => ({ ...d, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} autoComplete="new-password" />}
              </Campo>
              <Campo rotulo={editando.temSenha ? 'Nova senha da retaguarda (vazio = manter)' : 'Senha da retaguarda (opcional)'} erro={erros.senha} ajuda="Só para quem usa a retaguarda. 8+ caracteres com letras e números.">
                {(x) => <Entrada {...x} type="password" value={editando.senha} onChange={(e) => setEditando((d) => ({ ...d, senha: e.target.value }))} autoComplete="new-password" />}
              </Campo>
              {editando.senha && <Campo rotulo="Repita a senha" erro={erros.confirmar}>{(x) => <Entrada {...x} type="password" value={editando.confirmar} onChange={(e) => setEditando((d) => ({ ...d, confirmar: e.target.value }))} autoComplete="new-password" />}</Campo>}
            </div>
            <div>
              <Alternador rotulo="Todas as filiais" descricao="Para a franqueadora e supervisores." ligado={editando.todasFiliais} aoMudar={(v) => setEditando((d) => ({ ...d, todasFiliais: v }))} />
              {!editando.todasFiliais && (
                <>
                  {erros.filiais && <p className="campo__erro">{erros.filiais}</p>}
                  <div className="grade-marcadores">
                    {filiais.map((f) => (
                      <Marcador key={f.id} rotulo={f.nome} marcado={editando.filiais.includes(f.id)} aoMudar={(m) => setEditando((d) => ({ ...d, filiais: m ? [...d.filiais, f.id] : d.filiais.filter((x) => x !== f.id) }))} />
                    ))}
                  </div>
                </>
              )}
            </div>
            <Alternador rotulo="Ativo" descricao="Desative quando a pessoa sair da loja. O histórico continua." ligado={editando.ativo} aoMudar={(v) => setEditando((d) => ({ ...d, ativo: v }))} />
            {erros.ativo && <p className="campo__erro">{erros.ativo}</p>}
            {editando.temSenha && editando.id !== eu.id && <Alternador rotulo="Tirar o acesso à retaguarda" descricao="Apaga a senha. A pessoa continua entrando no caixa com o PIN." ligado={Boolean(editando.removerSenha)} aoMudar={(v) => setEditando((d) => ({ ...d, removerSenha: v }))} />}
            {editando.criadoEm && <p className="mudo">Criado em {dataHora(editando.criadoEm)}.</p>}
            <button type="submit" hidden />
          </form>
        </Modal>
      )}
    </Pagina>
  )
}

export function Perfis() {
  const { usuario } = useSessao()
  const perfis = useColecao('perfis')
  const usuarios = useColecao('usuarios')
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')

  const salvar = () => {
    const nome = textoLimpo(editando.nome, 40)
    if (!nome) return setErro('Dê um nome ao perfil.')
    const dados = { nome, descricao: textoLimpo(editando.descricao, 140), permissoes: editando.permissoes }
    if (editando.id) banco.atualizar('perfis', editando.id, dados)
    else banco.inserir('perfis', dados)
    registrar(editando.id ? 'cadastro.alterado' : 'cadastro.criado', `Perfil: ${nome} (${dados.permissoes.length} permissões)`, { usuario })
    avisar('Perfil salvo')
    setEditando(null)
  }

  const remover = async (p) => {
    if (p.sistema) return avisar('O perfil Administrador não pode ser apagado.', 'erro')
    if (usuarios.some((u) => u.perfilId === p.id)) return avisar('Há usuários com este perfil. Troque o perfil deles antes.', 'erro')
    if (!(await confirmar({ titulo: 'Apagar perfil?', texto: p.nome, botao: 'Apagar', perigo: true }))) return
    banco.remover('perfis', p.id)
    registrar('cadastro.removido', `Perfil: ${p.nome}`, { usuario })
  }

  return (
    <Pagina titulo="Perfis de acesso" descricao="O que cada tipo de usuário pode fazer. Ações sensíveis fora do perfil pedem o PIN de um gerente na hora." acoes={<Botao icone="mais" onClick={() => (setErro(''), setEditando({ nome: '', descricao: '', permissoes: ['caixa.vender'] }))}>Novo perfil</Botao>}>
      <Tabela
        linhas={perfis}
        aoClicar={(p) => !p.sistema && (setErro(''), setEditando({ ...p }))}
        colunas={[
          { id: 'nome', titulo: 'Perfil', render: (p) => <strong>{p.nome}</strong> },
          { id: 'descricao', titulo: 'Para quem', render: (p) => <span className="mudo">{p.descricao}</span> },
          { id: 'permissoes', titulo: 'Permissões', alinhar: 'direita', valor: (p) => p.permissoes.length },
          { id: 'usuarios', titulo: 'Usuários', alinhar: 'direita', valor: (p) => usuarios.filter((u) => u.perfilId === p.id).length },
          { id: 'acoes', titulo: '', ordenavel: false, alinhar: 'direita', render: (p) => (p.sistema ? <Selo tom="cinza">Fixo</Selo> : <BotaoIcone icone="lixeira" tamanho="p" variante="perigo" rotulo={`Apagar ${p.nome}`} onClick={() => remover(p)} />) },
        ]}
      />
      {editando && (
        <Modal aberto aoFechar={() => setEditando(null)} titulo={editando.id ? editando.nome : 'Novo perfil'} largura="g" rodape={<><Botao variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao><Botao onClick={salvar}>Salvar</Botao></>}>
          <div className="pilha">
            <div className="grade-campos">
              <Campo rotulo="Nome" erro={erro}>{(x) => <Entrada {...x} value={editando.nome} onChange={(e) => setEditando((d) => ({ ...d, nome: e.target.value }))} maxLength={40} />}</Campo>
              <Campo rotulo="Para quem é">{(x) => <AreaTexto {...x} rows={2} value={editando.descricao} onChange={(e) => setEditando((d) => ({ ...d, descricao: e.target.value }))} maxLength={140} />}</Campo>
            </div>
            {PERMISSOES.map((g) => (
              <fieldset key={g.grupo} className="grupo-permissoes">
                <legend>{g.grupo}</legend>
                {g.itens.map(([chave, rotulo]) => (
                  <Marcador key={chave} rotulo={rotulo} marcado={editando.permissoes.includes(chave)} aoMudar={(m) => setEditando((d) => ({ ...d, permissoes: m ? [...d.permissoes, chave] : d.permissoes.filter((x) => x !== chave) }))} />
                ))}
              </fieldset>
            ))}
            <p className="mudo">{editando.permissoes.length ? `Selecionado: ${editando.permissoes.map(rotuloPermissao).join('; ')}.` : 'Nenhuma permissão marcada.'}</p>
          </div>
        </Modal>
      )}
    </Pagina>
  )
}
