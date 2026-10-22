import { useEffect, useState } from 'react'
import { useDoc } from './dados/banco.js'
import { sistemaConfigurado } from './dados/inicializar.js'
import { sessao, useSessao } from './estado/sessao.js'
import { useRota, ir } from './rotas/useRota.js'
import { Dialogos } from './componentes/dialogos.jsx'
import { Impressao } from './componentes/Impressao.jsx'
import { Botao } from './componentes/ui.jsx'
import { Configuracao } from './telas/Configuracao.jsx'
import { Entrar } from './telas/Entrar.jsx'
import { Bloqueio } from './telas/Bloqueio.jsx'
import { Caixa } from './telas/caixa/Caixa.jsx'
import { Cozinha } from './telas/cozinha/Cozinha.jsx'
import { PainelSenhas } from './telas/cozinha/PainelSenhas.jsx'
import { Admin } from './telas/admin/Admin.jsx'
import { TODAS } from './dados/permissoes.js'

// Bloqueia a tela depois de N minutos sem uso. A cozinha e o painel de senhas
// ficam ligados o dia todo sem ninguém tocar, então não bloqueiam.
function useInatividade(ativo, minutos) {
  useEffect(() => {
    if (!ativo) return
    let ultimo = 0
    const tocar = () => {
      const agora = Date.now()
      if (agora - ultimo > 5000) {
        ultimo = agora
        sessao.tocar()
      }
    }
    const conferir = () => {
      const s = sessao.obter()
      if (s && !s.bloqueada && Date.now() - s.ultimoUso > minutos * 60_000) sessao.bloquear()
    }
    window.addEventListener('pointerdown', tocar)
    window.addEventListener('keydown', tocar)
    const t = setInterval(conferir, 10_000)
    return () => {
      window.removeEventListener('pointerdown', tocar)
      window.removeEventListener('keydown', tocar)
      clearInterval(t)
    }
  }, [ativo, minutos])
}

function AvisoArmazenamento() {
  const [cheio, setCheio] = useState(false)
  useEffect(() => {
    const fn = () => setCheio(true)
    window.addEventListener('scpdv:falha-gravacao', fn)
    return () => window.removeEventListener('scpdv:falha-gravacao', fn)
  }, [])
  if (!cheio) return null
  return (
    <div className="faixa-alerta" role="alert">
      Não foi possível gravar a última mudança no computador (disco cheio ou dados bloqueados pelo navegador). Não feche esta aba: faça o backup em Retaguarda › Segurança e backup e chame o suporte.
      <button type="button" onClick={() => setCheio(false)}>
        Entendi
      </button>
    </div>
  )
}

function SemAcesso({ texto }) {
  return (
    <div className="tema-escuro tela-cheia-centro">
      <div className="pilha" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28 }}>Sem acesso</h1>
        <p className="mudo">{texto}</p>
        <Botao onClick={() => ir('/')}>Voltar ao início</Botao>
      </div>
    </div>
  )
}

function Rotas() {
  const config = useDoc('config')
  const { partes } = useRota()
  const s = useSessao()
  const modoSemBloqueio = s.sessao?.modo === 'cozinha'
  useInatividade(Boolean(s.sessao) && !modoSemBloqueio, config.bloqueioMinutos || 5)

  // Sessão expirada ou usuário desativado: volta para a entrada.
  useEffect(() => {
    if (s.expirada) sessao.sair()
  }, [s.expirada])

  if (partes[0] === 'painel') return <PainelSenhas filialId={partes[1]} />
  if (!sistemaConfigurado(config)) return <Configuracao />
  if (!s.sessao) return <Entrar />
  if (s.sessao.bloqueada) return <Bloqueio />

  const area = partes[0] || s.sessao.modo
  if (area === 'caixa') {
    if (!s.pode('caixa.vender')) return <SemAcesso texto="Seu perfil não registra pedidos no caixa." />
    return <Caixa />
  }
  if (area === 'cozinha') {
    if (!s.pode('cozinha.ver')) return <SemAcesso texto="Seu perfil não tem acesso à tela da cozinha." />
    return <Cozinha />
  }
  if (area === 'admin') {
    if (!TODAS.some((p) => p.startsWith('admin.') && s.pode(p))) return <SemAcesso texto="Seu perfil não tem acesso à retaguarda." />
    return <Admin />
  }
  return <Redirecionar para={`/${s.sessao.modo}`} />
}

function Redirecionar({ para }) {
  useEffect(() => ir(para, { substituir: true }), [para])
  return null
}

export default function App() {
  return (
    <>
      <Rotas />
      <Dialogos />
      <Impressao />
      <AvisoArmazenamento />
    </>
  )
}
