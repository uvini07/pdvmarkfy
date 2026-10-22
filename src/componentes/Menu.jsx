// Menu suspenso acessível: abre no botão, fecha com Esc, com clique fora e
// depois de escolher. Setas do teclado andam entre as opções.

import { useEffect, useId, useRef, useState } from 'react'
import { Icone } from './Icone.jsx'

export function Menu({ itens, rotulo, icone = 'menu', alinhar = 'direita', gatilho }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!aberto) return
    const fora = (e) => !caixa.current?.contains(e.target) && setAberto(false)
    const tecla = (e) => {
      if (e.key === 'Escape') setAberto(false)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const botoes = [...caixa.current.querySelectorAll('[role="menuitem"]:not(:disabled)')]
        const i = botoes.indexOf(document.activeElement)
        const prox = e.key === 'ArrowDown' ? (i + 1) % botoes.length : (i - 1 + botoes.length) % botoes.length
        botoes[prox]?.focus()
      }
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    caixa.current.querySelector('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  return (
    <div className="menu" ref={caixa}>
      <button type="button" className={gatilho ? 'menu__gatilho-livre' : 'botao-icone'} aria-haspopup="menu" aria-expanded={aberto} aria-controls={id} aria-label={rotulo} title={rotulo} onClick={() => setAberto((a) => !a)}>
        {gatilho || <Icone nome={icone} tamanho={22} />}
      </button>
      {aberto && (
        <div className={`menu__lista menu__lista--${alinhar}`} role="menu" id={id}>
          {itens.map((item, i) =>
            item.separador ? (
              <hr key={i} />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={item.perigo ? 'menu__perigo' : ''}
                disabled={item.desabilitado}
                onClick={() => {
                  setAberto(false)
                  item.acao()
                }}
              >
                {item.icone && <Icone nome={item.icone} tamanho={18} />}
                {item.rotulo}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
