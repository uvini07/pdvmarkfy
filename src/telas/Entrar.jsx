// Entrada no PDV.
//
// Caixa e cozinha: o computador precisa ter sido liberado por um gerente (uma
// vez, com o Google dele). Depois, cada pessoa escolhe o próprio nome e digita
// o PIN — conferido no servidor, que bloqueia depois de 5 erros.
// Retaguarda: com a conta Google cadastrada em Usuários.
//
// O computador "lembra" da loja e do caixa dele: é a liberação.

import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Carregando, Entrada, Logo, Segmentos, Selecao, useRelogio } from '../componentes/ui.jsx'
import { Icone } from '../componentes/Icone.jsx'
import { TecladoPin } from '../componentes/TecladoPin.jsx'
import { confirmar, avisar } from '../componentes/dialogos.jsx'
import { useColecao } from '../dados/banco.js'
import { pode, acessaFilial } from '../dados/permissoes.js'
import { sessao } from '../estado/sessao.js'
import { useRede } from '../estado/rede.js'
import { entrarComGoogle, entrarComPin, esquecerComputador, liberarComputador, listarOperadores, sairDaPessoa, useComputador } from '../firebase/pdv.js'
import { ir } from '../rotas/useRota.js'
import { extenso, hora } from '../lib/datas.js'
import { textoLimpo } from '../lib/validacao.js'

const CHAVE_DISPOSITIVO = 'scpdv:dispositivo'

export function lerDispositivo() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_DISPOSITIVO)) || {}
  } catch {
    return {}
  }
}

export function gravarDispositivo(d) {
  localStorage.setItem(CHAVE_DISPOSITIVO, JSON.stringify({ ...lerDispositivo(), ...d }))
}

export function PainelMarca({ frase = 'Pedido rápido, coxinha quentinha.' }) {
  const agora = useRelogio(15_000)
  return (
    <section className="acesso__marca" aria-hidden="true">
      <Logo claro altura={34} />
      <img className="acesso__foto" src="/fotos/sabores/frango.webp" alt="" />
      <div>
        <p className="acesso__hora numero">{hora(agora)}</p>
        <p className="acesso__data">{extenso(agora)}</p>
        <p className="acesso__frase">{frase}</p>
      </div>
    </section>
  )
}

function Erro({ children }) {
  return children ? (
    <p className="campo__erro" role="alert">
      {children}
    </p>
  ) : null
}

// --- Liberar o computador (uma vez, por um gerente) ----------------------------------

function LiberarComputador() {
  const filiais = useColecao('filiais').filter((f) => f.ativo)
  const pontosVenda = useColecao('pontosVenda')
  const { eu, perfis } = useRede()
  const [conta, setConta] = useState(null)
  const [filialId, setFilialId] = useState('')
  const [pdvId, setPdvId] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const permitidas = conta ? filiais.filter((f) => acessaFilial(eu, f.id)) : []
  const caixas = pontosVenda.filter((p) => p.ativo && p.filialId === filialId)
  const podeLiberar = conta && eu && pode(eu, perfis, 'admin.config')

  const google = async () => {
    setErro('')
    setOcupado(true)
    try {
      setConta(await entrarComGoogle())
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(false)
    }
  }

  const escolherFilial = (id) => {
    setFilialId(id)
    const primeiro = pontosVenda.find((p) => p.ativo && p.filialId === id)
    setPdvId(primeiro?.id || '')
    setNome(primeiro?.nome || '')
  }

  const liberar = async (e) => {
    e.preventDefault()
    if (!filialId || !pdvId) return setErro('Escolha a loja e o caixa deste computador.')
    setErro('')
    setOcupado(true)
    try {
      await liberarComputador({ filialId, pdvId, nome: textoLimpo(nome, 40) || 'Caixa' })
      gravarDispositivo({ filialId, pdvId })
      await sairDaPessoa()
      avisar('Computador liberado. Agora cada pessoa entra com o PIN.')
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(false)
    }
  }

  const cancelar = async () => {
    await sairDaPessoa()
    setConta(null)
    setErro('')
  }

  if (!conta) {
    return (
      <div className="acesso__passo">
        <h2>Este computador ainda não é um caixa</h2>
        <p className="mudo">Um gerente libera este computador uma vez, com a conta Google dele. Depois, cada pessoa entra com o próprio PIN.</p>
        <Erro>{erro}</Erro>
        <Botao tamanho="g" bloco icone="cadeado" carregando={ocupado} onClick={google}>
          Liberar com o Google
        </Botao>
      </div>
    )
  }

  if (!podeLiberar) {
    return (
      <div className="acesso__passo">
        <h2>Sem permissão para liberar</h2>
        <p className="mudo">A conta de {conta.nome} não pode liberar computadores. Peça a quem cuida das configurações da loja.</p>
        <Botao variante="secundario" onClick={cancelar}>
          Voltar
        </Botao>
      </div>
    )
  }

  return (
    <form className="acesso__passo" onSubmit={liberar} noValidate>
      <h2>Liberar este computador</h2>
      <p className="mudo">Escolha a loja e o caixa. Só pessoas desta loja vão aparecer para entrar aqui.</p>
      <Campo rotulo="Loja">{(p) => <Selecao {...p} value={filialId} onChange={(e) => escolherFilial(e.target.value)} vazio="Escolha" opcoes={permitidas.map((f) => ({ valor: f.id, rotulo: f.nome }))} />}</Campo>
      {filialId && (
        <Campo rotulo="Caixa" ajuda={caixas.length ? null : 'Esta loja não tem caixa cadastrado. Cadastre em Retaguarda › Administrativo.'}>
          {(p) => (
            <Selecao
              {...p}
              value={pdvId}
              onChange={(e) => (setPdvId(e.target.value), setNome(caixas.find((c) => c.id === e.target.value)?.nome || ''))}
              vazio="Escolha"
              opcoes={caixas.map((c) => ({ valor: c.id, rotulo: c.nome }))}
            />
          )}
        </Campo>
      )}
      {pdvId && <Campo rotulo="Nome deste computador" ajuda="Aparece na retaguarda, para desligar se ele sumir.">{(p) => <Entrada {...p} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} />}</Campo>}
      <Erro>{erro}</Erro>
      <Botao type="submit" tamanho="g" bloco carregando={ocupado} disabled={!pdvId}>
        Liberar este computador
      </Botao>
      <Botao variante="fantasma" onClick={cancelar}>
        Cancelar
      </Botao>
    </form>
  )
}

// --- Escolher a pessoa e digitar o PIN ---------------------------------------------

function EntrarComPin({ modo, terminal }) {
  const filiais = useColecao('filiais')
  const [dados, setDados] = useState(null)
  const [erroLista, setErroLista] = useState('')
  const [escolhido, setEscolhido] = useState(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    setErroLista('')
    try {
      setDados(await listarOperadores())
    } catch (e) {
      setErroLista(e.message)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar, terminal.id])

  const conferir = async (pin) => {
    setOcupado(true)
    setErro('')
    try {
      const r = await entrarComPin({ usuarioId: escolhido.id, pin, modo })
      gravarDispositivo({ filialId: r.filialId, pdvId: r.pdvId })
      sessao.entrar({ usuario: r.usuario, modo, filialId: r.filialId, pdvId: r.pdvId })
      ir(`/${modo}`, { substituir: true })
    } catch (e) {
      setErro(e.message)
      if (e.motivo === 'bloqueado') carregar()
    } finally {
      setOcupado(false)
    }
  }

  const trocarComputador = async () => {
    const ok = await confirmar({
      titulo: 'Desligar este computador do caixa?',
      texto: 'Para usar de novo, um gerente vai precisar liberar com a conta Google dele.',
      botao: 'Desligar',
      perigo: true,
    })
    if (ok) await esquecerComputador()
  }

  if (erroLista && !dados) {
    return (
      <div className="acesso__passo">
        <h2>Não foi possível abrir o caixa</h2>
        <Erro>{erroLista}</Erro>
        <Botao icone="atualizar" onClick={carregar}>
          Tentar de novo
        </Botao>
      </div>
    )
  }
  if (!dados) return <Carregando texto="Procurando quem atende aqui…" />

  const filial = filiais.find((f) => f.id === dados.terminal.filialId)
  const pessoas = dados.pessoas.filter((p) => (modo === 'caixa' ? p.caixa : p.cozinha))

  if (escolhido) {
    return (
      <div className="acesso__passo acesso__passo--pin">
        <button type="button" className="link-voltar" onClick={() => (setEscolhido(null), setErro(''))}>
          <Icone nome="seta-esq" tamanho={16} /> Trocar pessoa
        </button>
        <div className="acesso__quem">
          <span className="cartao-usuario__inicial" aria-hidden="true">
            {escolhido.nome[0]}
          </span>
          <strong>{escolhido.nome}</strong>
        </div>
        <TecladoPin aoConfirmar={conferir} erro={erro} ocupado={ocupado} tamanho={escolhido.pinDigitos} />
      </div>
    )
  }

  return (
    <div className="acesso__passo">
      <div className="linha linha--entre">
        <h2>Quem vai {modo === 'caixa' ? 'atender' : 'cuidar da cozinha'}?</h2>
        <button type="button" className="link-filial" onClick={carregar} title="Atualizar a lista">
          <Icone nome="loja" tamanho={16} /> {filial?.nome || 'Loja'} · {dados.terminal.nome}
        </button>
      </div>
      {pessoas.length ? (
        <ul className="grade-pessoas">
          {pessoas.map((u) => (
            <li key={u.id}>
              <button type="button" className="pessoa" onClick={() => setEscolhido(u)} disabled={u.bloqueado}>
                <span className="pessoa__inicial" aria-hidden="true">
                  {u.nome[0]}
                </span>
                <span className="pessoa__nome">{u.nome.split(' ').slice(0, 2).join(' ')}</span>
                {u.bloqueado && <span className="pessoa__bloqueio">Bloqueado</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mudo">Ninguém desta loja tem acesso {modo === 'caixa' ? 'ao caixa' : 'à cozinha'} com PIN ainda. O gerente cadastra em Retaguarda › Usuários.</p>
      )}
      <Erro>{erroLista}</Erro>
      <button type="button" className="link-voltar" onClick={trocarComputador}>
        <Icone nome="monitor" tamanho={16} /> Desligar este computador
      </button>
    </div>
  )
}

function Computador({ modo }) {
  const { carregando, terminal } = useComputador()
  if (carregando) return <Carregando />
  if (!terminal) return <LiberarComputador />
  return <EntrarComPin key={`${modo}-${terminal.id}`} modo={modo} terminal={terminal} />
}

// --- Retaguarda: Google ------------------------------------------------------------------

function EntrarComGoogle() {
  const filiais = useColecao('filiais')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const entrar = async () => {
    setErro('')
    setOcupado(true)
    try {
      const usuario = await entrarComGoogle()
      const permitidas = filiais.filter((f) => f.ativo && acessaFilial(usuario, f.id))
      const filialId = permitidas.find((f) => f.id === lerDispositivo().filialId)?.id || permitidas[0]?.id
      if (!filialId) {
        await sairDaPessoa()
        return setErro('Sua conta não tem nenhuma filial deste computador. Peça ao administrador para conferir em Usuários.')
      }
      sessao.entrar({ usuario, modo: 'admin', filialId })
      ir('/admin', { substituir: true })
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="acesso__passo">
      <h2>Retaguarda</h2>
      <p className="mudo">Cardápio, preços, estoque, financeiro e relatórios. Entre com a conta Google cadastrada em Usuários.</p>
      <Erro>{erro}</Erro>
      <Botao tamanho="g" bloco carregando={ocupado} onClick={entrar}>
        Entrar com o Google
      </Botao>
      <p className="acesso__nota">
        <Icone nome="cadeado" tamanho={15} /> O PDV não guarda senha: quem confere é o Google.
      </p>
    </div>
  )
}

export function Entrar() {
  const [modo, setModo] = useState(() => lerDispositivo().modo || 'caixa')
  const trocar = (m) => {
    setModo(m)
    gravarDispositivo({ modo: m })
  }
  return (
    <div className="tema-escuro acesso">
      <PainelMarca />
      <main className="acesso__painel">
        <div className="acesso__conteudo">
          <Segmentos
            rotulo="Onde entrar"
            valor={modo}
            aoMudar={trocar}
            opcoes={[
              { valor: 'caixa', rotulo: 'Caixa', icone: 'recibo' },
              { valor: 'cozinha', rotulo: 'Cozinha', icone: 'cozinha' },
              { valor: 'admin', rotulo: 'Retaguarda', icone: 'grafico' },
            ]}
          />
          {modo === 'admin' ? <EntrarComGoogle /> : <Computador modo={modo} />}
        </div>
      </main>
    </div>
  )
}
