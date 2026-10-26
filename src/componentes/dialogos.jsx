// Diálogos globais chamados como função, de qualquer lugar:
//   avisar('Produto salvo')                       → aviso rápido no canto
//   await confirmar({ titulo, texto, perigo })    → true | false
//   await pedirAutorizacao({ permissao, acao, filialId }) → { id, nome, autorizacaoId } de quem autorizou | null
//   await escolher({ titulo, opcoes })             → opção escolhida | null
// O componente <Dialogos /> fica uma vez só, no App.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Modal } from './Modal.jsx'
import { Botao, Carregando } from './ui.jsx'
import { Icone } from './Icone.jsx'
import { TecladoPin } from './TecladoPin.jsx'
import { autorizar, listarSupervisores } from '../firebase/pdv.js'

let estado = { avisos: [], confirmacao: null, autorizacao: null, escolha: null }
const ouvintes = new Set()
const mudar = (parcial) => {
  estado = { ...estado, ...parcial }
  ouvintes.forEach((fn) => fn())
}
const assinar = (fn) => {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

let contador = 0
export function avisar(texto, tom = 'sucesso', duracao = 3200) {
  const id = ++contador
  mudar({ avisos: [...estado.avisos, { id, texto, tom }] })
  setTimeout(() => mudar({ avisos: estado.avisos.filter((a) => a.id !== id) }), duracao)
}

export function confirmar({ titulo, texto, botao = 'Confirmar', perigo = false, cancelar = 'Voltar' }) {
  return new Promise((resolve) => mudar({ confirmacao: { titulo, texto, botao, perigo, cancelar, resolve } }))
}

export function pedirAutorizacao({ permissao, acao, filialId }) {
  return new Promise((resolve) => mudar({ autorizacao: { permissao, acao, filialId, resolve } }))
}

export function escolher({ titulo, subtitulo, opcoes }) {
  return new Promise((resolve) => mudar({ escolha: { titulo, subtitulo, opcoes, resolve } }))
}

function Escolha({ dados }) {
  const fechar = (r) => {
    mudar({ escolha: null })
    dados.resolve(r)
  }
  return (
    <Modal aberto aoFechar={() => fechar(null)} titulo={dados.titulo} subtitulo={dados.subtitulo} largura="p">
      <ul className="lista-escolha">
        {dados.opcoes.map((o) => (
          <li key={o}>
            <button type="button" onClick={() => fechar(o)}>
              {o}
              <Icone nome="seta-dir" tamanho={18} />
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function Confirmacao({ dados }) {
  const fechar = (r) => {
    mudar({ confirmacao: null })
    dados.resolve(r)
  }
  return (
    <Modal
      aberto
      aoFechar={() => fechar(false)}
      titulo={dados.titulo}
      largura="p"
      rodape={
        <>
          <Botao variante="secundario" onClick={() => fechar(false)}>
            {dados.cancelar}
          </Botao>
          <Botao variante={dados.perigo ? 'perigo' : 'primario'} onClick={() => fechar(true)} autoFocus>
            {dados.botao}
          </Botao>
        </>
      }
    >
      {dados.texto && <p className="texto-modal">{dados.texto}</p>}
    </Modal>
  )
}

// Quem pode autorizar e a conferência do PIN vêm do servidor: o PIN do
// gerente nunca é conferido neste navegador, e cada autorização fica
// registrada lá (pdv_autorizacoes), com quem pediu e quem autorizou.
function Autorizacao({ dados }) {
  const [supervisores, setSupervisores] = useState(null)
  const [escolhido, setEscolhido] = useState(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    listarSupervisores(dados.permissao, dados.filialId)
      .then((r) => setSupervisores(r.pessoas))
      .catch((e) => (setSupervisores([]), setErro(e.message)))
  }, [dados.permissao, dados.filialId])

  const fechar = (r) => {
    mudar({ autorizacao: null })
    dados.resolve(r)
  }

  const conferir = async (pin) => {
    setErro('')
    setOcupado(true)
    try {
      const r = await autorizar({ supervisorId: escolhido.id, pin, permissao: dados.permissao, filialId: dados.filialId, acao: dados.acao })
      fechar({ ...r.usuario, autorizacaoId: r.autorizacaoId })
    } catch (e) {
      setErro(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Modal aberto aoFechar={() => fechar(null)} titulo="Autorização de supervisor" subtitulo={dados.acao} largura="p" className="tema-escuro">
      {!supervisores && <Carregando texto="Procurando quem pode autorizar…" />}
      {!escolhido && erro && <p className="campo__erro" role="alert">{erro}</p>}
      {supervisores && !supervisores.length && !erro && <p className="texto-modal">Nenhum usuário desta filial pode autorizar isso. Peça ao administrador para dar a permissão a um gerente.</p>}
      {!escolhido && supervisores?.length > 0 && (
        <ul className="lista-usuarios">
          {supervisores.map((u) => (
            <li key={u.id}>
              <button type="button" className="cartao-usuario" onClick={() => (setEscolhido(u), setErro(''))} disabled={u.bloqueado}>
                <span className="cartao-usuario__inicial" aria-hidden="true">
                  {u.nome[0]}
                </span>
                <span>{u.nome}{u.bloqueado ? ' (bloqueado)' : ''}</span>
                <Icone nome="seta-dir" tamanho={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {escolhido && (
        <>
          <button type="button" className="link-voltar" onClick={() => (setEscolhido(null), setErro(''))}>
            <Icone nome="seta-esq" tamanho={16} /> {escolhido.nome}
          </button>
          <TecladoPin rotulo={`PIN de ${escolhido.nome.split(' ')[0]}`} aoConfirmar={conferir} erro={erro} ocupado={ocupado} tamanho={escolhido.pinDigitos} />
        </>
      )}
    </Modal>
  )
}

export function Dialogos() {
  const e = useSyncExternalStore(assinar, () => estado)
  return (
    <>
      <div className="avisos" aria-live="polite" role="status">
        {e.avisos.map((a) => (
          <div key={a.id} className={`aviso aviso--${a.tom}`}>
            <Icone nome={a.tom === 'erro' ? 'alerta' : a.tom === 'info' ? 'info' : 'check-circulo'} tamanho={20} />
            {a.texto}
          </div>
        ))}
      </div>
      {e.confirmacao && <Confirmacao dados={e.confirmacao} />}
      {e.autorizacao && <Autorizacao dados={e.autorizacao} />}
      {e.escolha && <Escolha dados={e.escolha} />}
    </>
  )
}
