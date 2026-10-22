// Entrada no PDV. Caixa e cozinha: escolhe a pessoa e digita o PIN (como nos
// PDVs de balcão). Retaguarda: login e senha.
//
// O computador "lembra" de qual filial e de qual caixa ele é, para o atendente
// não precisar escolher toda vez.

import { useMemo, useState } from 'react'
import { Botao, Campo, Entrada, Logo, Segmentos, useRelogio } from '../componentes/ui.jsx'
import { Icone } from '../componentes/Icone.jsx'
import { TecladoPin } from '../componentes/TecladoPin.jsx'
import { useColecao } from '../dados/banco.js'
import { pode, acessaFilial } from '../dados/permissoes.js'
import { conferirPin, conferirSenha, estaBloqueado } from '../dados/usuarios.js'
import { sessao } from '../estado/sessao.js'
import { ir } from '../rotas/useRota.js'
import { extenso, hora } from '../lib/datas.js'

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

function EntrarComPin({ modo }) {
  const filiais = useColecao('filiais').filter((f) => f.ativo)
  const pontosVenda = useColecao('pontosVenda')
  const usuarios = useColecao('usuarios')
  const perfis = useColecao('perfis')
  const dispositivo = lerDispositivo()
  const [filialId, setFilialId] = useState(dispositivo.filialId && filiais.some((f) => f.id === dispositivo.filialId) ? dispositivo.filialId : '')
  const [escolhido, setEscolhido] = useState(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [precisaPdv, setPrecisaPdv] = useState(null)

  const permissao = modo === 'caixa' ? 'caixa.vender' : 'cozinha.ver'
  const pessoas = useMemo(
    () => usuarios.filter((u) => u.ativo && u.pin && acessaFilial(u, filialId) && pode(u, perfis, permissao)).sort((a, b) => a.nome.localeCompare(b.nome)),
    [usuarios, perfis, filialId, permissao],
  )
  const pdvsDaFilial = pontosVenda.filter((p) => p.ativo && p.filialId === filialId)

  const concluir = (usuario, pdvId) => {
    gravarDispositivo({ filialId, ...(pdvId ? { pdvId } : {}) })
    sessao.entrar({ usuario, modo, filialId, pdvId })
    ir(`/${modo}`, { substituir: true })
  }

  const conferir = async (pin) => {
    setOcupado(true)
    setErro('')
    const r = await conferirPin(escolhido.id, pin)
    setOcupado(false)
    if (!r.ok) return setErro(r.erro)
    if (modo !== 'caixa') return concluir(r.usuario)
    const lembrado = pdvsDaFilial.find((p) => p.id === dispositivo.pdvId)
    if (lembrado) return concluir(r.usuario, lembrado.id)
    if (pdvsDaFilial.length === 1) return concluir(r.usuario, pdvsDaFilial[0].id)
    if (!pdvsDaFilial.length) return setErro('Esta filial não tem nenhum ponto de venda ativo. Cadastre em Retaguarda › Administrativo.')
    setPrecisaPdv(r.usuario)
  }

  if (!filialId) {
    return (
      <div className="acesso__passo">
        <h2>De qual loja é este computador?</h2>
        <ul className="grade-escolha">
          {filiais.map((f) => (
            <li key={f.id}>
              <button type="button" className="escolha" onClick={() => setFilialId(f.id)}>
                <Icone nome="loja" tamanho={22} />
                <span>
                  <strong>{f.nome}</strong>
                  <small>{f.cidade}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (precisaPdv) {
    return (
      <div className="acesso__passo">
        <h2>Qual caixa é este?</h2>
        <p className="mudo">O computador vai lembrar da escolha.</p>
        <ul className="grade-escolha">
          {pdvsDaFilial.map((p) => (
            <li key={p.id}>
              <button type="button" className="escolha" onClick={() => concluir(precisaPdv, p.id)}>
                <Icone nome="monitor" tamanho={22} />
                <span>
                  <strong>{p.nome}</strong>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const filial = filiais.find((f) => f.id === filialId)

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
        <button type="button" className="link-filial" onClick={() => setFilialId('')}>
          <Icone nome="loja" tamanho={16} /> {filial?.nome}
        </button>
      </div>
      {pessoas.length ? (
        <ul className="grade-pessoas">
          {pessoas.map((u) => (
            <li key={u.id}>
              <button type="button" className="pessoa" onClick={() => setEscolhido(u)} disabled={estaBloqueado(u)}>
                <span className="pessoa__inicial" aria-hidden="true">
                  {u.nome[0]}
                </span>
                <span className="pessoa__nome">{u.nome.split(' ').slice(0, 2).join(' ')}</span>
                {estaBloqueado(u) && <span className="pessoa__bloqueio">Bloqueado</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mudo">Ninguém desta filial tem acesso {modo === 'caixa' ? 'ao caixa' : 'à cozinha'} ainda. O gerente cadastra em Retaguarda › Usuários.</p>
      )}
    </div>
  )
}

function EntrarComSenha() {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [ver, setVer] = useState(false)
  const filiais = useColecao('filiais')

  const enviar = async (e) => {
    e.preventDefault()
    if (!login || !senha) return setErro('Preencha login e senha.')
    setOcupado(true)
    setErro('')
    const r = await conferirSenha(login, senha)
    setOcupado(false)
    if (!r.ok) {
      setSenha('')
      return setErro(r.erro)
    }
    const dispositivo = lerDispositivo()
    const permitida = filiais.filter((f) => f.ativo && acessaFilial(r.usuario, f.id))
    const filialId = permitida.find((f) => f.id === dispositivo.filialId)?.id || permitida[0]?.id
    sessao.entrar({ usuario: r.usuario, modo: 'admin', filialId })
    ir('/admin', { substituir: true })
  }

  return (
    <form className="acesso__passo" onSubmit={enviar} noValidate>
      <h2>Retaguarda</h2>
      <p className="mudo">Cardápio, preços, estoque, financeiro e relatórios.</p>
      <Campo rotulo="Login">{(p) => <Entrada {...p} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus />}</Campo>
      <Campo rotulo="Senha">
        {(p) => (
          <div className="entrada-senha">
            <Entrada {...p} type={ver ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
            <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}>
              <Icone nome={ver ? 'olho-fechado' : 'olho'} tamanho={18} />
            </button>
          </div>
        )}
      </Campo>
      {erro && (
        <p className="campo__erro" role="alert">
          {erro}
        </p>
      )}
      <Botao type="submit" tamanho="g" bloco carregando={ocupado}>
        Entrar
      </Botao>
    </form>
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
          {modo === 'admin' ? <EntrarComSenha /> : <EntrarComPin key={modo} modo={modo} />}
        </div>
      </main>
    </div>
  )
}

