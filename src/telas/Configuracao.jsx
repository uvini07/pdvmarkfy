// Primeiro acesso: cria o administrador da rede e grava o cardápio inicial.

import { useState } from 'react'
import { Botao, Campo, Entrada, Alternador, Logo } from '../componentes/ui.jsx'
import { Icone } from '../componentes/Icone.jsx'
import { configurarSistema, concluirConfiguracao, USUARIOS_DEMO } from '../dados/inicializar.js'
import { validarUsuario } from '../dados/usuarios.js'
import { sessao } from '../estado/sessao.js'
import { ir } from '../rotas/useRota.js'

export function Configuracao() {
  const [dados, setDados] = useState({ nome: '', login: '', senha: '', confirmar: '', pin: '' })
  const [demonstracao, setDemonstracao] = useState(true)
  const [erros, setErros] = useState({})
  const [ocupado, setOcupado] = useState(false)
  const [pronto, setPronto] = useState(null)

  const mudar = (campo) => (e) => setDados((d) => ({ ...d, [campo]: e.target.value }))

  const criar = async (e) => {
    e.preventDefault()
    const v = validarUsuario({ ...dados, perfilId: 'perfil-admin', todasFiliais: true }, { novo: true, usuarios: [] })
    if (!dados.senha) v.senha = 'Crie uma senha para a retaguarda.'
    if (dados.senha && dados.senha !== dados.confirmar) v.confirmar = 'As senhas não são iguais.'
    setErros(v)
    if (Object.keys(v).length) return
    setOcupado(true)
    const admin = await configurarSistema({ admin: dados, demonstracao })
    setOcupado(false)
    setPronto(admin)
  }

  const entrar = () => {
    concluirConfiguracao()
    sessao.entrar({ usuario: pronto, modo: 'admin', filialId: 'f-max-morumbi' })
    ir('/admin', { substituir: true })
  }

  return (
    <div className="tema-escuro acesso">
      <section className="acesso__marca" aria-hidden="true">
        <Logo claro altura={34} />
        <img className="acesso__foto" src="/fotos/sabores/catupiry.webp" alt="" />
        <p className="acesso__frase">O caixa da Sua Coxinha.</p>
      </section>

      <main className="acesso__painel">
        {!pronto ? (
          <form className="acesso__form" onSubmit={criar} noValidate>
            <h1>Vamos configurar o PDV</h1>
            <p className="mudo">Crie o acesso do administrador. Ele vê todas as filiais e cadastra os outros usuários.</p>

            <div className="grade-campos">
              <Campo rotulo="Seu nome" erro={erros.nome} className="largo">
                {(p) => <Entrada {...p} value={dados.nome} onChange={mudar('nome')} autoComplete="name" autoFocus />}
              </Campo>
              <Campo rotulo="Login" erro={erros.login} ajuda="Sem espaço. Ex.: jonatas">
                {(p) => <Entrada {...p} value={dados.login} onChange={mudar('login')} autoComplete="username" autoCapitalize="none" />}
              </Campo>
              <Campo rotulo="PIN do caixa" erro={erros.pin} ajuda="4 a 6 números, sem sequência">
                {(p) => <Entrada {...p} value={dados.pin} onChange={(e) => setDados((d) => ({ ...d, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} inputMode="numeric" type="password" autoComplete="off" />}
              </Campo>
              <Campo rotulo="Senha da retaguarda" erro={erros.senha} ajuda="8 ou mais, com letras e números">
                {(p) => <Entrada {...p} type="password" value={dados.senha} onChange={mudar('senha')} autoComplete="new-password" />}
              </Campo>
              <Campo rotulo="Repita a senha" erro={erros.confirmar}>
                {(p) => <Entrada {...p} type="password" value={dados.confirmar} onChange={mudar('confirmar')} autoComplete="new-password" />}
              </Campo>
            </div>

            <div className="acesso__opcao">
              <Alternador
                ligado={demonstracao}
                aoMudar={setDemonstracao}
                rotulo="Carregar dados de demonstração"
                descricao="Duas semanas de vendas em todas as filiais e três usuários de teste, para ver o painel funcionando. Dá para apagar depois."
              />
            </div>

            <Botao type="submit" tamanho="g" bloco carregando={ocupado}>
              {ocupado ? 'Preparando o PDV…' : 'Criar e configurar'}
            </Botao>
            <p className="acesso__nota">
              <Icone nome="cadeado" tamanho={15} /> Senha e PIN ficam guardados só como código cifrado (hash), nunca como texto.
            </p>
          </form>
        ) : (
          <div className="acesso__form">
            <Icone nome="check-circulo" tamanho={44} className="positivo" />
            <h1>Tudo pronto, {pronto.nome.split(' ')[0]}.</h1>
            {demonstracao ? (
              <>
                <p className="mudo">Usuários de teste da filial Max Morumbi. Troque os PINs ou desative-os antes de usar na loja.</p>
                <ul className="acesso__demos">
                  {USUARIOS_DEMO.map((u) => (
                    <li key={u.login}>
                      <span>{u.nome}</span>
                      <span className="mudo">{u.perfilId.replace('perfil-', '')}</span>
                      <span className="numero">PIN {u.pin}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mudo">O cardápio inicial já está cadastrado. Agora cadastre os atendentes em Retaguarda › Usuários.</p>
            )}
            <Botao tamanho="g" bloco onClick={entrar} iconeDepois="seta-dir">
              Entrar na retaguarda
            </Botao>
          </div>
        )}
      </main>
    </div>
  )
}
