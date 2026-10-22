// Cabeçalho padrão das telas da retaguarda e a barra de busca/filtros.

import { Entrada } from './ui.jsx'

export function Pagina({ titulo, descricao, acoes, children, voltar }) {
  return (
    <section className="pagina">
      <header className="pagina__cabecalho">
        <div>
          {voltar && (
            <a className="link-voltar" href={voltar.href}>
              ← {voltar.rotulo}
            </a>
          )}
          <h1>{titulo}</h1>
          {descricao && <p className="pagina__descricao">{descricao}</p>}
        </div>
        {acoes && <div className="pagina__acoes">{acoes}</div>}
      </header>
      {children}
    </section>
  )
}

export function BarraFiltros({ busca, aoBuscar, placeholder = 'Buscar', children, total }) {
  return (
    <div className="barra-filtros">
      {aoBuscar && <Entrada icone="busca" type="search" placeholder={placeholder} value={busca} onChange={(e) => aoBuscar(e.target.value)} aria-label={placeholder} />}
      {children}
      {total !== undefined && <span className="barra-filtros__total">{total} registro(s)</span>}
    </div>
  )
}

export function Cartao({ titulo, acao, children, className = '' }) {
  return (
    <section className={`cartao ${className}`}>
      {(titulo || acao) && (
        <header className="cartao__cabecalho">
          {titulo && <h2>{titulo}</h2>}
          {acao}
        </header>
      )}
      {children}
    </section>
  )
}
