// Teclado de PIN para tela de toque, que também aceita o teclado físico.
// Os dígitos nunca aparecem: só as bolinhas preenchidas.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icone } from './Icone.jsx'

export function TecladoPin({ aoConfirmar, minimo = 4, maximo: maximoPadrao = 6, tamanho, erro, ocupado, rotulo = 'Digite seu PIN', limparAoErrar = true }) {
  const maximo = tamanho || maximoPadrao
  const [pin, setPin] = useState('')
  const [tremer, setTremer] = useState(0)

  useEffect(() => {
    if (erro) {
      setTremer((t) => t + 1)
      if (limparAoErrar) setPin('')
    }
  }, [erro, limparAoErrar])

  const enviar = useCallback(
    (valor) => {
      if (valor.length >= minimo && !ocupado) aoConfirmar(valor)
    },
    [aoConfirmar, minimo, ocupado],
  )

  const digitar = useCallback(
    (d) => {
      if (ocupado) return
      setPin((p) => (p.length >= maximo ? p : p + d))
    },
    [maximo, ocupado],
  )

  // Completou o PIN: envia uma vez só. (O envio fica fora do setPin: o React
  // pode chamar o atualizador duas vezes, e cada chamada viraria uma
  // tentativa de PIN no servidor.)
  const enviarAtual = useRef(enviar)
  enviarAtual.current = enviar
  useEffect(() => {
    if (pin.length !== maximo) return
    const t = setTimeout(() => enviarAtual.current(pin), 60)
    return () => clearTimeout(t)
  }, [pin, maximo])

  useEffect(() => {
    const tecla = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      if (/^\d$/.test(e.key)) {
        e.preventDefault()
        digitar(e.key)
      } else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
      else if (e.key === 'Enter') enviar(pin)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [digitar, enviar, pin])

  return (
    <div className="teclado-pin">
      <p className="teclado-pin__rotulo" id="rotulo-pin">
        {rotulo}
      </p>
      <div key={tremer} className={`teclado-pin__pontos ${tremer ? 'teclado-pin__pontos--erro' : ''}`} aria-live="polite" aria-label={`${pin.length} números digitados`}>
        {Array.from({ length: tamanho || Math.max(minimo, pin.length) }, (_, i) => (
          <span key={i} className={i < pin.length ? 'cheio' : ''} />
        ))}
      </div>
      <p className="teclado-pin__erro" role="alert">
        {erro || ' '}
      </p>
      <div className="teclado-pin__teclas" role="group" aria-labelledby="rotulo-pin">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => digitar(d)} disabled={ocupado}>
            {d}
          </button>
        ))}
        <button type="button" className="teclado-pin__apagar" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Apagar" disabled={ocupado}>
          <Icone nome="voltar" tamanho={24} />
        </button>
        <button type="button" onClick={() => digitar('0')} disabled={ocupado}>
          0
        </button>
        <button type="button" className="teclado-pin__ok" onClick={() => enviar(pin)} disabled={pin.length < minimo || ocupado} aria-label="Confirmar">
          {ocupado ? <span className="carregando__gota" aria-hidden="true" /> : <Icone nome="check" tamanho={26} traco={2.2} />}
        </button>
      </div>
    </div>
  )
}
