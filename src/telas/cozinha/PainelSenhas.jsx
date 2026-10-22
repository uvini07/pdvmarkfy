// Painel de senhas para a TV do salão. Mostra só o número e o primeiro nome —
// nenhum outro dado do cliente. Atualiza sozinho quando a cozinha marca "pronto".

import { useEffect, useMemo, useRef, useState } from 'react'
import { useColecao } from '../../dados/banco.js'
import { hoje, hora } from '../../lib/datas.js'
import { Logo, useRelogio } from '../../componentes/ui.jsx'

function chamar() {
  try {
    const ctx = new AudioContext()
    ;[660, 880].forEach((f, i) => {
      const osc = ctx.createOscillator()
      const vol = ctx.createGain()
      osc.frequency.value = f
      vol.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.22)
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.5)
      osc.connect(vol).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.22)
      osc.stop(ctx.currentTime + i * 0.22 + 0.52)
    })
  } catch {
    // Sem áudio liberado: só o visual
  }
}

const primeiroNome = (n) => (n || '').trim().split(/\s+/)[0]

export function PainelSenhas({ filialId }) {
  const vendas = useColecao('vendas')
  const filiais = useColecao('filiais')
  const agora = useRelogio(30_000)
  const filial = filiais.find((f) => f.id === filialId)
  const [destaque, setDestaque] = useState(null)
  const prontosAntes = useRef(null)

  const dia = hoje()
  const doDia = useMemo(() => vendas.filter((v) => v.filialId === filialId && v.dia === dia && v.status === 'concluida' && v.cozinha), [vendas, filialId, dia])
  const preparando = doDia.filter((v) => ['novo', 'preparo'].includes(v.cozinha.status)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
  const prontos = doDia.filter((v) => v.cozinha.status === 'pronto').sort((a, b) => (b.cozinha.prontoEm || '').localeCompare(a.cozinha.prontoEm || ''))

  useEffect(() => {
    const ids = new Set(prontos.map((v) => v.id))
    const novo = prontos.find((v) => prontosAntes.current && !prontosAntes.current.has(v.id))
    if (novo) {
      setDestaque(novo.id)
      chamar()
    }
    prontosAntes.current = ids
  }, [prontos])

  if (!filial) {
    return (
      <div className="painel painel--erro">
        <p>Painel sem loja. Abra pelo menu do caixa ou da cozinha.</p>
      </div>
    )
  }

  const principal = prontos.find((v) => v.id === destaque) || prontos[0]

  return (
    <div className="painel">
      <header className="painel__topo">
        <Logo altura={40} />
        <span className="painel__hora numero">{hora(agora)}</span>
      </header>
      <main className="painel__corpo">
        <section className="painel__prontos" aria-live="polite">
          <h1>Pronto! Pode retirar</h1>
          {principal ? (
            <div key={principal.id} className="painel__chamada">
              <span className="painel__senha numero">{String(principal.numero).padStart(3, '0')}</span>
              {primeiroNome(principal.cliente?.nome) && <span className="painel__nome">{primeiroNome(principal.cliente.nome)}</span>}
            </div>
          ) : (
            <p className="painel__espera">Assim que ficar pronto, sua senha aparece aqui.</p>
          )}
          <ul className="painel__outros">
            {prontos
              .filter((v) => v !== principal)
              .slice(0, 6)
              .map((v) => (
                <li key={v.id} className="numero">
                  {String(v.numero).padStart(3, '0')}
                </li>
              ))}
          </ul>
        </section>
        <section className="painel__preparando">
          <h2>Preparando</h2>
          <ul>
            {preparando.slice(0, 18).map((v) => (
              <li key={v.id} className="numero">
                {String(v.numero).padStart(3, '0')}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <img className="painel__mascote" src="/fotos/produtos/mascote.webp" alt="" />
    </div>
  )
}
