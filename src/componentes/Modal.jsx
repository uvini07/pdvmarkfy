// Janela modal com <dialog> nativo: o navegador cuida do foco preso dentro,
// da tecla Esc e de deixar o fundo inerte para leitores de tela.

import { useEffect, useId, useRef } from 'react'
import { BotaoIcone } from './ui.jsx'

export function Modal({ aberto, aoFechar, titulo, subtitulo, children, rodape, largura = 'm', fecharNoFundo = true, className = '', semCabecalho }) {
  const ref = useRef(null)
  const idTitulo = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  if (!aberto) return null

  return (
    <dialog
      ref={ref}
      className={`modal modal--${largura} ${className}`}
      aria-labelledby={titulo ? idTitulo : undefined}
      onCancel={(e) => {
        e.preventDefault()
        aoFechar?.()
      }}
      onClick={(e) => {
        if (fecharNoFundo && e.target === ref.current) aoFechar?.()
      }}
    >
      <div className="modal__caixa">
        {!semCabecalho && (
          <header className="modal__cabecalho">
            <div>
              <h2 id={idTitulo}>{titulo}</h2>
              {subtitulo && <p className="modal__subtitulo">{subtitulo}</p>}
            </div>
            {aoFechar && <BotaoIcone icone="fechar" rotulo="Fechar" onClick={aoFechar} />}
          </header>
        )}
        <div className="modal__corpo rolagem">{children}</div>
        {rodape && <footer className="modal__rodape">{rodape}</footer>}
      </div>
    </dialog>
  )
}
