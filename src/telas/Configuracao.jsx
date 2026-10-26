// Primeiro acesso deste computador: alguém da retaguarda, com permissão de
// configurações, entra com o Google e o PDV grava o cardápio inicial aqui.
// Na primeira vez da rede, é nesse login que o servidor cria o administrador.

import { useState } from 'react'
import { Botao, Alternador, Logo } from '../componentes/ui.jsx'
import { Icone } from '../componentes/Icone.jsx'
import { banco } from '../dados/banco.js'
import { configurarSistema, concluirConfiguracao } from '../dados/inicializar.js'
import { pode, acessaFilial } from '../dados/permissoes.js'
import { sessao } from '../estado/sessao.js'
import { useRede } from '../estado/rede.js'
import { entrarComGoogle, sairDaPessoa } from '../firebase/pdv.js'
import { ir } from '../rotas/useRota.js'

export function Configuracao() {
  const { eu, perfis } = useRede()
  const [conta, setConta] = useState(null)
  const [demonstracao, setDemonstracao] = useState(true)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [pronto, setPronto] = useState(false)

  const podeConfigurar = conta && eu && pode(eu, perfis, 'admin.config')

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

  const outraConta = async () => {
    await sairDaPessoa()
    setConta(null)
  }

  const preparar = async () => {
    setOcupado(true)
    await configurarSistema({ demonstracao, usuario: conta })
    setOcupado(false)
    setPronto(true)
  }

  const entrar = () => {
    const filialId = banco.lista('filiais').find((f) => f.ativo && acessaFilial(eu, f.id))?.id
    if (!filialId) return setErro('Sua conta não tem nenhuma das filiais cadastradas. Confira em Usuários.')
    concluirConfiguracao()
    sessao.entrar({ usuario: conta, modo: 'admin', filialId })
    ir('/admin', { substituir: true })
  }

  let conteudo
  if (!conta) {
    conteudo = (
      <>
        <h1>Vamos preparar este computador</h1>
        <p className="mudo">Entre com a conta Google de quem cuida da retaguarda. Na primeira vez da rede, entre com a conta do administrador: o acesso dele é criado nesse login.</p>
        {erro && <p className="campo__erro" role="alert">{erro}</p>}
        <Botao tamanho="g" bloco carregando={ocupado} onClick={google}>
          Entrar com o Google
        </Botao>
        <p className="acesso__nota">
          <Icone nome="cadeado" tamanho={15} /> Usuários, PINs e permissões ficam no servidor da Sua Coxinha, nunca neste computador.
        </p>
      </>
    )
  } else if (!podeConfigurar) {
    conteudo = (
      <>
        <h1>Sem permissão para configurar</h1>
        <p className="mudo">A conta de {conta.nome} não pode preparar computadores. Peça a quem cuida das configurações da loja.</p>
        <Botao variante="secundario" onClick={outraConta}>
          Usar outra conta
        </Botao>
      </>
    )
  } else if (!pronto) {
    conteudo = (
      <>
        <h1>Olá, {conta.nome.split(' ')[0]}</h1>
        <p className="mudo">O PDV vai gravar neste computador o cardápio inicial, as formas de pagamento e as filiais. Tudo pode ser mudado depois na retaguarda.</p>
        <div className="acesso__opcao">
          <Alternador
            ligado={demonstracao}
            aoMudar={setDemonstracao}
            rotulo="Carregar dados de demonstração"
            descricao="Duas semanas de vendas de exemplo em todas as filiais, para ver o painel funcionando. Dá para apagar depois."
          />
        </div>
        <Botao tamanho="g" bloco carregando={ocupado} onClick={preparar}>
          {ocupado ? 'Preparando o PDV…' : 'Preparar este computador'}
        </Botao>
      </>
    )
  } else {
    conteudo = (
      <>
        <Icone nome="check-circulo" tamanho={44} className="positivo" />
        <h1>Tudo pronto, {conta.nome.split(' ')[0]}.</h1>
        <p className="mudo">Cadastre quem atende em Retaguarda › Usuários, com um PIN para cada pessoa. Para usar este computador como caixa, saia e escolha a aba Caixa: um gerente libera com o Google dele.</p>
        {erro && <p className="campo__erro" role="alert">{erro}</p>}
        <Botao tamanho="g" bloco onClick={entrar} iconeDepois="seta-dir">
          Entrar na retaguarda
        </Botao>
      </>
    )
  }

  return (
    <div className="tema-escuro acesso">
      <section className="acesso__marca" aria-hidden="true">
        <Logo claro altura={34} />
        <img className="acesso__foto" src="/fotos/sabores/catupiry.webp" alt="" />
        <p className="acesso__frase">O caixa da Sua Coxinha.</p>
      </section>
      <main className="acesso__painel">
        <div className="acesso__form">{conteudo}</div>
      </main>
    </div>
  )
}
