// Usuários e perfis de acesso. Moram no servidor: a lista vem das funções do
// login, que só mostram quem está no alcance de quem pede, e cada gravação é
// conferida lá — ninguém dá um perfil ou uma filial que não tem. O PIN vai
// direto para o servidor e nunca volta, nem como hash.

import { useCallback, useEffect, useState } from 'react'
import { useColecao } from '../../dados/banco.js'
import { PERMISSOES, permissoesDe, rotuloPermissao } from '../../dados/permissoes.js'
import { validarUsuario, estaBloqueado } from '../../dados/usuarios.js'
import { useSessao } from '../../estado/sessao.js'
import { useRede } from '../../estado/rede.js'
import { desbloquearUsuario, listarUsuarios, removerPerfil, salvarPerfil, salvarUsuario } from '../../firebase/pdv.js'
import { Pagina, BarraFiltros } from '../../componentes/Pagina.jsx'
import { Tabela } from '../../componentes/Tabela.jsx'
import { Modal } from '../../componentes/Modal.jsx'
import { Alternador, Botao, BotaoIcone, Campo, Carregando, Entrada, Marcador, Selecao, Selo, AreaTexto } from '../../componentes/ui.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { dataHora } from '../../lib/datas.js'

const ORDEM_PERFIS = ['perfil-admin', 'perfil-gerente', 'perfil-atendente', 'perfil-cozinha']
const ordenarPerfis = (perfis) =>
  [...perfis].sort((a, b) => ((ORDEM_PERFIS.indexOf(a.id) + 1 || 99) - (ORDEM_PERFIS.indexOf(b.id) + 1 || 99)) || a.nome.localeCompare(b.nome))

function useUsuariosDaRede() {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(
    () =>
      listarUsuarios()
        .then((r) => (setLista(r.usuarios), setErro('')))
        .catch((e) => setErro(e.message)),
    [],
  )
  useEffect(() => {
    carregar()
  }, [carregar])
  return { lista, erro, carregar }
}

export function Usuarios() {
  const { usuario: eu } = useSessao()
  const { perfis } = useRede()
  const filiais = useColecao('filiais')
  const { lista, erro: erroLista, carregar } = useUsuariosDaRede()
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null)
  const [erros, setErros] = useState({})
  const [ocupado, setOcupado] = useState(false)

  // Só o que eu posso dar: perfis com permissões que eu tenho e as minhas filiais.
  const minhas = permissoesDe(eu, perfis)
  const meuPerfil = perfis.find((p) => p.id === eu.perfilId)
  const perfisQueDou = ordenarPerfis(perfis).filter((p) => meuPerfil?.sistema || (!p.sistema && p.permissoes.every((x) => minhas.includes(x))))
  const filiaisQueDou = eu.todasFiliais ? filiais : filiais.filter((f) => eu.filiais.includes(f.id))

  const linhas = (lista || []).filter((u) => !busca || `${u.nome} ${u.email}`.toLowerCase().includes(busca.toLowerCase()))
  const nomePerfil = (id) => perfis.find((p) => p.id === id)?.nome || '—'
  const nomeFilial = (id) => filiais.find((f) => f.id === id)?.nome || id

  const abrir = (u) => {
    if (!u.editavel) return avisar('Este usuário tem mais acesso que o seu ou é de outra filial.', 'info')
    setErros({})
    setEditando({ ...u, pin: '', removerPin: false })
  }

  const novo = () => {
    setErros({})
    setEditando({ nome: '', email: '', perfilId: perfisQueDou.find((p) => p.id === 'perfil-atendente')?.id || perfisQueDou[0]?.id || '', filiais: eu.todasFiliais ? [] : eu.filiais.slice(0, 1), todasFiliais: false, ativo: true, pin: '' })
  }

  const salvar = async () => {
    const e = validarUsuario(editando, { novo: !editando.id })
    if (editando.id === eu.id && editando.ativo === false) e.ativo = 'Você não pode desativar o próprio acesso.'
    setErros(e)
    if (Object.keys(e).length) return
    setOcupado(true)
    try {
      const { id, nome, email, perfilId, todasFiliais, filiais: lojas, ativo, pin, removerPin } = editando
      await salvarUsuario({ id, nome, email, perfilId, todasFiliais, filiais: lojas, ativo, pin, removerPin })
      avisar(id ? 'Usuário salvo' : 'Usuário criado')
      setEditando(null)
      carregar()
    } catch (erro) {
      if (erro.erros) setErros(erro.erros)
      else avisar(erro.message, 'erro')
    } finally {
      setOcupado(false)
    }
  }

  const desbloquear = async (u) => {
    try {
      await desbloquearUsuario(u.id)
      avisar(`${u.nome} desbloqueado`)
      carregar()
    } catch (erro) {
      avisar(erro.message, 'erro')
    }
  }

  return (
    <Pagina
      titulo="Usuários"
      descricao="Cada pessoa tem o próprio acesso. O PIN entra no caixa e na cozinha; a conta Google (e-mail) entra na retaguarda. Nunca compartilhe."
      acoes={
        <Botao icone="mais" onClick={novo} disabled={!perfisQueDou.length}>
          Novo usuário
        </Botao>
      }
    >
      <BarraFiltros busca={busca} aoBuscar={setBusca} placeholder="Nome ou e-mail" total={linhas.length} />
      {erroLista && <p className="campo__erro">{erroLista}</p>}
      {!lista && !erroLista ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={linhas}
          aoClicar={abrir}
          ordemInicial={{ id: 'nome', dir: 'asc' }}
          colunas={[
            { id: 'nome', titulo: 'Nome', render: (u) => <span><strong>{u.nome}</strong>{u.dono && <> <Selo tom="azul">Dono da rede</Selo></>}</span> },
            { id: 'email', titulo: 'E-mail (Google)', valor: (u) => u.email || '—' },
            { id: 'perfil', titulo: 'Perfil', valor: (u) => nomePerfil(u.perfilId) },
            { id: 'filiais', titulo: 'Filiais', valor: (u) => (u.todasFiliais ? 'Todas' : u.filiais.map(nomeFilial).join(', ')) },
            { id: 'acesso', titulo: 'Acessos', valor: (u) => [u.temPin && 'PIN', u.email && 'Google'].filter(Boolean).join(' e ') || '—' },
            {
              id: 'situacao',
              titulo: 'Situação',
              render: (u) =>
                !u.ativo ? (
                  <Selo tom="cinza">Inativo</Selo>
                ) : estaBloqueado(u) ? (
                  <span className="linha">
                    <Selo tom="vermelho">Bloqueado</Selo>
                    {u.editavel && (
                      <Botao variante="contorno" tamanho="p" onClick={(e) => (e.stopPropagation(), desbloquear(u))}>
                        Desbloquear
                      </Botao>
                    )}
                  </span>
                ) : (
                  <Selo tom="verde">Ativo</Selo>
                ),
            },
          ]}
        />
      )}

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
              <Campo rotulo="E-mail da conta Google" erro={erros.email} ajuda="Para entrar na retaguarda. Vazio para quem só usa o caixa.">
                {(x) => <Entrada {...x} type="email" value={editando.email} onChange={(e) => setEditando((d) => ({ ...d, email: e.target.value.trim().toLowerCase() }))} maxLength={120} autoCapitalize="none" disabled={editando.dono} />}
              </Campo>
              <Campo rotulo="Perfil de acesso" erro={erros.perfilId}>
                {(x) => <Selecao {...x} value={editando.perfilId} onChange={(e) => setEditando((d) => ({ ...d, perfilId: e.target.value }))} opcoes={perfisQueDou.map((p) => ({ valor: p.id, rotulo: p.nome }))} disabled={editando.dono} />}
              </Campo>
              <Campo rotulo={editando.temPin ? 'Novo PIN (deixe vazio para manter)' : 'PIN do caixa'} erro={erros.pin} ajuda="4 a 6 números, sem sequência nem repetição">
                {(x) => <Entrada {...x} type="password" inputMode="numeric" value={editando.pin} onChange={(e) => setEditando((d) => ({ ...d, pin: e.target.value.replace(/\D/g, '').slice(0, 6), removerPin: false }))} autoComplete="new-password" />}
              </Campo>
            </div>
            {!editando.dono && (
              <div>
                {eu.todasFiliais && <Alternador rotulo="Todas as filiais" descricao="Para a franqueadora e supervisores." ligado={editando.todasFiliais} aoMudar={(v) => setEditando((d) => ({ ...d, todasFiliais: v }))} />}
                {!editando.todasFiliais && (
                  <>
                    {erros.filiais && <p className="campo__erro">{erros.filiais}</p>}
                    <div className="grade-marcadores">
                      {filiaisQueDou.map((f) => (
                        <Marcador key={f.id} rotulo={f.nome} marcado={editando.filiais.includes(f.id)} aoMudar={(m) => setEditando((d) => ({ ...d, filiais: m ? [...d.filiais, f.id] : d.filiais.filter((x) => x !== f.id) }))} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <Alternador rotulo="Ativo" descricao="Desative quando a pessoa sair da loja. A sessão dela cai na hora e o histórico continua." ligado={editando.ativo} aoMudar={(v) => setEditando((d) => ({ ...d, ativo: v }))} desabilitado={editando.id === eu.id} />
            {erros.ativo && <p className="campo__erro">{erros.ativo}</p>}
            {editando.temPin && editando.id !== eu.id && !editando.pin && (
              <Alternador rotulo="Tirar o PIN" descricao="A pessoa deixa de entrar no caixa e na cozinha. Se tiver e-mail, continua entrando na retaguarda." ligado={Boolean(editando.removerPin)} aoMudar={(v) => setEditando((d) => ({ ...d, removerPin: v }))} />
            )}
            {editando.criadoEm && <p className="mudo">Criado em {dataHora(editando.criadoEm)}.</p>}
            <button type="submit" hidden />
          </form>
        </Modal>
      )}
    </Pagina>
  )
}

export function Perfis() {
  const { usuario: eu } = useSessao()
  const { perfis } = useRede()
  const { lista: usuarios } = useUsuariosDaRede()
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  // Um perfil vale para a rede inteira: só quem cuida de todas as filiais altera.
  const podeEditar = eu.todasFiliais

  const salvar = async () => {
    if (!editando.nome.trim()) return setErro('Dê um nome ao perfil.')
    setOcupado(true)
    try {
      await salvarPerfil({ id: editando.id, nome: editando.nome, descricao: editando.descricao, permissoes: editando.permissoes })
      avisar('Perfil salvo')
      setEditando(null)
    } catch (e) {
      setErro(e.erros ? Object.values(e.erros)[0] : e.message)
    } finally {
      setOcupado(false)
    }
  }

  const remover = async (p) => {
    if (!(await confirmar({ titulo: 'Apagar perfil?', texto: p.nome, botao: 'Apagar', perigo: true }))) return
    try {
      await removerPerfil(p.id)
      avisar('Perfil apagado')
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  return (
    <Pagina
      titulo="Perfis de acesso"
      descricao={`O que cada tipo de usuário pode fazer, em todas as lojas. Ações sensíveis fora do perfil pedem o PIN de um gerente na hora.${podeEditar ? '' : ' Só a franqueadora altera os perfis.'}`}
      acoes={podeEditar && <Botao icone="mais" onClick={() => (setErro(''), setEditando({ nome: '', descricao: '', permissoes: ['caixa.vender'] }))}>Novo perfil</Botao>}
    >
      <Tabela
        linhas={ordenarPerfis(perfis)}
        aoClicar={(p) => podeEditar && !p.sistema && (setErro(''), setEditando({ ...p }))}
        colunas={[
          { id: 'nome', titulo: 'Perfil', render: (p) => <strong>{p.nome}</strong> },
          { id: 'descricao', titulo: 'Para quem', render: (p) => <span className="mudo">{p.descricao}</span> },
          { id: 'permissoes', titulo: 'Permissões', alinhar: 'direita', valor: (p) => (p.sistema ? 'Todas' : p.permissoes.length) },
          { id: 'usuarios', titulo: 'Usuários', alinhar: 'direita', valor: (p) => (usuarios ? usuarios.filter((u) => u.perfilId === p.id).length : '…') },
          {
            id: 'acoes',
            titulo: '',
            ordenavel: false,
            alinhar: 'direita',
            render: (p) => (p.sistema ? <Selo tom="cinza">Fixo</Selo> : podeEditar && <BotaoIcone icone="lixeira" tamanho="p" variante="perigo" rotulo={`Apagar ${p.nome}`} onClick={(e) => (e.stopPropagation(), remover(p))} />),
          },
        ]}
      />
      {editando && (
        <Modal
          aberto
          aoFechar={() => setEditando(null)}
          titulo={editando.id ? editando.nome : 'Novo perfil'}
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
