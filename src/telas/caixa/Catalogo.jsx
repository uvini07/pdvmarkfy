// Catálogo do caixa: grupos em gotas (a forma do logo) com a foto do produto
// e a grade de produtos. A busca também serve de entrada do leitor de código
// de barras: código ou EAN + Enter adiciona direto.

import { useMemo, useState } from 'react'
import { useColecao } from '../../dados/banco.js'
import { estaPausado, melhorPromocao, precoNaFilial, promocaoValida } from '../../dados/precos.js'
import { Icone } from '../../componentes/Icone.jsx'
import { avisar } from '../../componentes/dialogos.jsx'
import { reais } from '../../lib/dinheiro.js'

const normalizar = (t) =>
  String(t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function GotaGrupo({ grupo, ativo, aoEscolher, icone, rotulo }) {
  return (
    <li>
      <button type="button" className={`grupo ${ativo ? 'grupo--ativo' : ''}`} onClick={aoEscolher} aria-pressed={ativo}>
        <span className="grupo__gota">
          {grupo?.imagem ? <img src={grupo.imagem} alt="" loading="lazy" /> : <Icone nome={icone || grupo?.icone || 'caixa'} tamanho={26} />}
        </span>
        <span className="grupo__nome">{rotulo || grupo.nome}</span>
      </button>
    </li>
  )
}

function CartaoProduto({ produto, filialId, promocoes, aoTocar }) {
  const preco = precoNaFilial(produto, filialId)
  const pausado = estaPausado(produto, filialId)
  const promo = melhorPromocao(produto, promocoes, filialId, preco)
  return (
    <li>
      <button type="button" className={`produto ${pausado ? 'produto--esgotado' : ''} ${produto.imagem ? '' : 'produto--sem-foto'}`} onClick={() => aoTocar(produto)} aria-label={`${produto.nome}, ${reais(preco)}${pausado ? ', esgotado' : ''}`}>
        <span className="produto__foto">
          {produto.imagem ? <img src={produto.imagem} alt="" loading="lazy" /> : <Icone nome={produto.grupoId === 'g-bebidas' ? 'lata' : 'caixa'} tamanho={34} traco={1.4} />}
        </span>
        <span className="produto__nome">{produto.nome}</span>
        <span className="produto__preco numero">
          {promo ? (
            <>
              <s>{reais(preco)}</s> {reais(preco - promo.desconto)}
            </>
          ) : (
            reais(preco)
          )}
        </span>
        <span className="produto__selos">
          {pausado && <span className="produto__selo produto__selo--esgotado">Esgotado</span>}
          {!pausado && promo && <span className="produto__selo">{promo.nome}</span>}
          {produto.config.maior18 && <span className="produto__selo produto__selo--18">+18</span>}
        </span>
      </button>
    </li>
  )
}

export function Catalogo({ buscaRef, aoTocar, porCodigo, filialId }) {
  const grupos = useColecao('grupos')
  const produtos = useColecao('produtos')
  const promocoes = useColecao('promocoes')
  const [grupoAtivo, setGrupoAtivo] = useState('favoritos')
  const [busca, setBusca] = useState('')

  const vendaveis = useMemo(() => produtos.filter((p) => p.ativo && p.tipo === 'venda'), [produtos])
  const gruposVisiveis = useMemo(() => grupos.filter((g) => g.ativo && g.noCaixa && vendaveis.some((p) => p.grupoId === g.id)).sort((a, b) => a.ordem - b.ordem), [grupos, vendaveis])
  const temOfertas = promocoes.some((p) => promocaoValida(p, filialId))

  const lista = useMemo(() => {
    if (busca.trim()) {
      const termos = normalizar(busca).split(/\s+/).filter(Boolean)
      return vendaveis.filter((p) => termos.every((t) => normalizar(`${p.nome} ${p.codigo} ${p.ean}`).includes(t)))
    }
    if (grupoAtivo === 'favoritos') return vendaveis.filter((p) => p.config.favorito || p.classes?.includes('c-mais-pedidos'))
    if (grupoAtivo === 'ofertas') return vendaveis.filter((p) => melhorPromocao(p, promocoes, filialId, precoNaFilial(p, filialId)))
    return vendaveis.filter((p) => p.grupoId === grupoAtivo)
  }, [busca, grupoAtivo, vendaveis, promocoes, filialId])

  const grupoAtual = grupos.find((g) => g.id === grupoAtivo)
  const titulo = busca.trim() ? `Resultados para “${busca.trim()}”` : grupoAtivo === 'favoritos' ? 'Mais pedidos' : grupoAtivo === 'ofertas' ? 'Ofertas de agora' : grupoAtual?.nome

  return (
    <>
      <nav className="caixa__grupos rolagem" aria-label="Grupos de produtos">
        <ul>
          <GotaGrupo ativo={grupoAtivo === 'favoritos' && !busca} aoEscolher={() => (setGrupoAtivo('favoritos'), setBusca(''))} icone="estrela" rotulo="Mais pedidos" />
          {temOfertas && <GotaGrupo ativo={grupoAtivo === 'ofertas' && !busca} aoEscolher={() => (setGrupoAtivo('ofertas'), setBusca(''))} icone="porcento" rotulo="Ofertas" />}
          {gruposVisiveis.map((g) => (
            <GotaGrupo key={g.id} grupo={g} ativo={grupoAtivo === g.id && !busca} aoEscolher={() => (setGrupoAtivo(g.id), setBusca(''))} />
          ))}
        </ul>
      </nav>

      <section className="caixa__produtos" aria-label="Produtos">
        <div className="caixa__busca">
          <div className="entrada-com-icone">
            <Icone nome="busca" tamanho={20} />
            <input
              ref={buscaRef}
              className="entrada"
              type="search"
              placeholder="Buscar produto, código ou ler o código de barras"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && busca.trim()) {
                  if (porCodigo(busca)) setBusca('')
                  else if (lista.length === 1) {
                    aoTocar(lista[0])
                    setBusca('')
                  } else if (!lista.length) avisar('Nenhum produto com esse nome ou código.', 'erro')
                }
                if (e.key === 'Escape') setBusca('')
              }}
              aria-label="Buscar produto"
            />
            <span className="atalho caixa__atalho">F2</span>
          </div>
        </div>
        <h2 className="caixa__titulo-grupo">{titulo}</h2>
        {lista.length ? (
          <ul className="caixa__grade rolagem">
            {lista.map((p) => (
              <CartaoProduto key={p.id} produto={p} filialId={filialId} promocoes={promocoes} aoTocar={aoTocar} />
            ))}
          </ul>
        ) : (
          <div className="caixa__vazio">
            <img src="/fotos/produtos/mascote.webp" alt="" width="110" />
            <p>{busca ? 'Nada encontrado. Confira o nome ou o código.' : 'Nenhum produto neste grupo.'}</p>
          </div>
        )}
      </section>
    </>
  )
}
