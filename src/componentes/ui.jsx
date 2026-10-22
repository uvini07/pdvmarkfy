// Peças básicas da interface. Funcionam nos dois temas (claro e escuro)
// porque só usam as variáveis semânticas (--superficie, --texto…).

import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import { Icone } from './Icone.jsx'
import { deDigitos, valor } from '../lib/dinheiro.js'

export function Botao({ variante = 'primario', tamanho = 'm', icone, iconeDepois, carregando, bloco, children, className = '', type = 'button', ...resto }) {
  return (
    <button
      type={type}
      className={`botao botao--${variante} botao--${tamanho}${bloco ? ' botao--bloco' : ''}${carregando ? ' botao--carregando' : ''} ${className}`}
      disabled={carregando || resto.disabled}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {icone && <Icone nome={icone} tamanho={tamanho === 'g' ? 22 : 18} />}
      {children && <span>{children}</span>}
      {iconeDepois && <Icone nome={iconeDepois} tamanho={18} />}
    </button>
  )
}

export function BotaoIcone({ icone, rotulo, variante = 'fantasma', tamanho = 'm', className = '', ...resto }) {
  return (
    <button type="button" className={`botao-icone botao-icone--${variante} botao-icone--${tamanho} ${className}`} aria-label={rotulo} title={rotulo} {...resto}>
      <Icone nome={icone} tamanho={tamanho === 'p' ? 16 : 20} />
    </button>
  )
}

export function Campo({ rotulo, erro, ajuda, children, className = '', obrigatorio, id: idExterno }) {
  const idGerado = useId()
  const id = idExterno || idGerado
  const filho = typeof children === 'function' ? children({ id, 'aria-invalid': Boolean(erro) || undefined, 'aria-describedby': erro || ajuda ? `${id}-desc` : undefined }) : children
  return (
    <div className={`campo ${erro ? 'campo--erro' : ''} ${className}`}>
      {rotulo && (
        <label className="campo__rotulo" htmlFor={id}>
          {rotulo}
          {obrigatorio && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {filho}
      {(erro || ajuda) && (
        <p className={erro ? 'campo__erro' : 'campo__ajuda'} id={`${id}-desc`} role={erro ? 'alert' : undefined}>
          {erro || ajuda}
        </p>
      )}
    </div>
  )
}

export const Entrada = forwardRef(function Entrada({ className = '', icone, ...resto }, ref) {
  if (!icone) return <input ref={ref} className={`entrada ${className}`} {...resto} />
  return (
    <div className="entrada-com-icone">
      <Icone nome={icone} tamanho={18} />
      <input ref={ref} className={`entrada ${className}`} {...resto} />
    </div>
  )
})

export function Selecao({ opcoes, vazio, className = '', ...resto }) {
  return (
    <div className="selecao-caixa">
      <select className={`entrada selecao ${className}`} {...resto}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor} disabled={o.desabilitado}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <Icone nome="seta-baixo" tamanho={16} />
    </div>
  )
}

export function AreaTexto({ className = '', ...resto }) {
  return <textarea className={`entrada area-texto ${className}`} rows={3} {...resto} />
}

export function Marcador({ marcado, aoMudar, rotulo, descricao, desabilitado, id: idExterno }) {
  const idGerado = useId()
  const id = idExterno || idGerado
  return (
    <label className={`marcador ${desabilitado ? 'marcador--desabilitado' : ''}`} htmlFor={id}>
      <input id={id} type="checkbox" checked={Boolean(marcado)} onChange={(e) => aoMudar(e.target.checked)} disabled={desabilitado} />
      <span className="marcador__caixa" aria-hidden="true">
        <Icone nome="check" tamanho={14} traco={2.4} />
      </span>
      <span className="marcador__texto">
        <span>{rotulo}</span>
        {descricao && <small>{descricao}</small>}
      </span>
    </label>
  )
}

export function Alternador({ ligado, aoMudar, rotulo, descricao, desabilitado }) {
  const id = useId()
  return (
    <div className="alternador">
      <span className="alternador__texto">
        <label htmlFor={id}>{rotulo}</label>
        {descricao && <small>{descricao}</small>}
      </span>
      <button id={id} type="button" role="switch" aria-checked={Boolean(ligado)} className="alternador__chave" onClick={() => aoMudar(!ligado)} disabled={desabilitado}>
        <span />
      </button>
    </div>
  )
}

// Valor em reais digitado como na maquininha: cada número entra pela direita.
export function CampoDinheiro({ valor: centavos, aoMudar, autoFocus, id, grande, ...resto }) {
  const ref = useRef(null)
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  return (
    <div className={`campo-dinheiro ${grande ? 'campo-dinheiro--grande' : ''}`}>
      <span aria-hidden="true">R$</span>
      <input
        ref={ref}
        id={id}
        className="entrada numero"
        inputMode="numeric"
        value={valor(centavos)}
        onChange={(e) => aoMudar(deDigitos(e.target.value))}
        onFocus={(e) => e.target.select()}
        {...resto}
      />
    </div>
  )
}

export function Selo({ tom = 'cinza', children, icone }) {
  return (
    <span className={`selo selo--${tom}`}>
      {icone && <Icone nome={icone} tamanho={13} traco={2} />}
      {children}
    </span>
  )
}

export function Abas({ abas, ativa, aoTrocar, rotulo = 'Seções' }) {
  return (
    <div className="abas" role="tablist" aria-label={rotulo}>
      {abas.map((a) => (
        <button key={a.id} type="button" role="tab" aria-selected={a.id === ativa} className="abas__aba" onClick={() => aoTrocar(a.id)}>
          {a.nome}
          {a.contador ? <span className="abas__contador">{a.contador}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Segmentos({ opcoes, valor: atual, aoMudar, rotulo, tamanho = 'm' }) {
  return (
    <div className={`segmentos segmentos--${tamanho}`} role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={o.valor === atual} onClick={() => aoMudar(o.valor)}>
          {o.icone && <Icone nome={o.icone} tamanho={17} />}
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

export function Vazio({ titulo, texto, acao, mascote = false, compacto }) {
  return (
    <div className={`vazio ${compacto ? 'vazio--compacto' : ''}`}>
      {mascote && <img src="/fotos/produtos/mascote.webp" alt="" width="120" height="145" />}
      <p className="vazio__titulo">{titulo}</p>
      {texto && <p className="vazio__texto">{texto}</p>}
      {acao}
    </div>
  )
}

export function Carregando({ texto = 'Carregando…' }) {
  return (
    <div className="carregando" role="status">
      <span className="carregando__gota" aria-hidden="true" />
      {texto}
    </div>
  )
}

// Logo oficial em SVG. "claro" é a versão para fundo escuro.
export function Logo({ claro, altura = 28, empilhado }) {
  const src = empilhado ? '/marca/logo-empilhado.svg' : claro ? '/marca/logo-claro.svg' : '/marca/logo-sua-coxinha.svg'
  return <img className="logo" src={src} alt="Sua Coxinha" style={{ height: altura, width: 'auto' }} />
}

// A gota do logo, usada como forma das capinhas de grupo e dos marcadores.
export function Gota({ tamanho = 20, className = '' }) {
  return (
    <svg className={className} width={tamanho} height={tamanho * 1.23} viewBox="0 0 640 789" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M639.979 478.386C638.941 446.407 635.143 414.415 628.674 383.309C613.165 308.64 582.92 239.085 538.8 176.57C495.452 115.143 441.115 63.87 377.308 24.1807L357.394 11.7992L357.014 12.141C356.305 11.7359 355.596 11.3434 354.887 10.951L349.633 8.02649L343.936 6.11481L341.657 5.36787C330.263 1.81039 318.375 0 306.31 0C276.217 0 247.504 11.2548 225.45 31.6881C203.485 52.0202 190.091 79.6192 187.723 109.408L187.521 111.966V112.738C187.432 114.093 187.382 115.472 187.344 116.903C185.027 152.427 166.999 184.672 137.83 205.422L137.463 205.688C136.881 206.106 136.412 206.435 135.918 206.764L134.741 207.587C94.0137 236.528 60.1733 275.129 36.8788 319.236C12.7487 364.876 0 416.453 0 468.359C0 553.523 33.9543 633.94 95.5962 694.797C125.17 724.004 159.416 746.982 197.383 763.086C236.655 779.746 277.964 788.19 320.16 788.19C403.021 788.19 481.602 756.692 541.446 699.494C601.113 642.473 636.092 565.778 639.941 483.501C640.017 481.792 640.03 480.095 639.979 478.386Z"
      />
    </svg>
  )
}

export function useAtraso(valorAtual, ms = 200) {
  const [atrasado, setAtrasado] = useState(valorAtual)
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valorAtual), ms)
    return () => clearTimeout(t)
  }, [valorAtual, ms])
  return atrasado
}

export function useRelogio(intervalo = 30_000) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervalo)
    return () => clearInterval(t)
  }, [intervalo])
  return agora
}
