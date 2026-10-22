// Tela bloqueada por inatividade. O caixa e o pedido em andamento continuam;
// só a mesma pessoa destrava com o PIN, ou sai para outra entrar.

import { useState } from 'react'
import { TecladoPin } from '../componentes/TecladoPin.jsx'
import { Botao } from '../componentes/ui.jsx'
import { conferirPin } from '../dados/usuarios.js'
import { sessao, useSessao } from '../estado/sessao.js'
import { PainelMarca } from './Entrar.jsx'

export function Bloqueio() {
  const { usuario, filial } = useSessao()
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const conferir = async (pin) => {
    setOcupado(true)
    const r = await conferirPin(usuario.id, pin)
    setOcupado(false)
    if (r.ok) sessao.desbloquear()
    else setErro(r.erro)
  }

  return (
    <div className="tema-escuro acesso">
      <PainelMarca frase="Tela bloqueada para proteger o caixa." />
      <main className="acesso__painel">
        <div className="acesso__conteudo acesso__passo--pin">
          <div className="acesso__quem">
            <span className="cartao-usuario__inicial" aria-hidden="true">
              {usuario.nome[0]}
            </span>
            <span>
              <strong>{usuario.nome}</strong>
              <small className="mudo"> {filial?.nome}</small>
            </span>
          </div>
          <TecladoPin rotulo="Digite seu PIN para continuar" aoConfirmar={conferir} erro={erro} ocupado={ocupado} tamanho={usuario.pinDigitos} />
          <Botao variante="fantasma" onClick={() => sessao.sair()}>
            Entrar com outra pessoa
          </Botao>
        </div>
      </main>
    </div>
  )
}
