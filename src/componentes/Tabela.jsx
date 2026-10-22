// Tabela da retaguarda: ordena ao clicar no cabeçalho, mostra estado vazio e
// deixa a linha inteira clicável quando há ação.

import { useMemo, useState } from 'react'
import { Icone } from './Icone.jsx'
import { Vazio } from './ui.jsx'

export function Tabela({ colunas, linhas, chave = 'id', vazio = 'Nada por aqui ainda.', aoClicar, ordemInicial, rodape, densa, rotulo }) {
  const [ordem, setOrdem] = useState(ordemInicial || null)

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas
    const col = colunas.find((c) => c.id === ordem.id)
    if (!col) return linhas
    const valorDe = col.ordenar || ((l) => (typeof col.valor === 'function' ? col.valor(l) : l[col.id]))
    return [...linhas].sort((a, b) => {
      const va = valorDe(a)
      const vb = valorDe(b)
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { numeric: true })
      return ordem.dir === 'asc' ? r : -r
    })
  }, [linhas, ordem, colunas])

  if (!linhas.length) return <Vazio titulo={vazio} compacto />

  return (
    <div className="tabela-caixa rolagem">
      <table className={`tabela ${densa ? 'tabela--densa' : ''}`} aria-label={rotulo}>
        <thead>
          <tr>
            {colunas.map((c) => {
              const ativa = ordem?.id === c.id
              return (
                <th key={c.id} className={c.alinhar ? `alinhar-${c.alinhar}` : ''} style={c.largura ? { width: c.largura } : undefined} aria-sort={ativa ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.ordenavel === false || !c.titulo ? (
                    c.titulo
                  ) : (
                    <button type="button" className="tabela__ordenar" onClick={() => setOrdem((o) => ({ id: c.id, dir: o?.id === c.id && o.dir === 'asc' ? 'desc' : 'asc' }))}>
                      {c.titulo}
                      <Icone nome={ativa && ordem.dir === 'desc' ? 'seta-baixo' : 'seta-cima'} tamanho={12} className={ativa ? '' : 'invisivel'} />
                    </button>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((l) => (
            <tr
              key={l[chave]}
              className={aoClicar ? 'clicavel' : ''}
              onClick={aoClicar ? (e) => !e.target.closest('button, a, input, select, label') && aoClicar(l) : undefined}
              tabIndex={aoClicar ? 0 : undefined}
              onKeyDown={aoClicar ? (e) => e.key === 'Enter' && e.target === e.currentTarget && aoClicar(l) : undefined}
            >
              {colunas.map((c) => (
                <td key={c.id} className={c.alinhar ? `alinhar-${c.alinhar}` : ''}>
                  {c.render ? c.render(l) : typeof c.valor === 'function' ? c.valor(l) : l[c.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rodape && <tfoot>{rodape}</tfoot>}
      </table>
    </div>
  )
}
