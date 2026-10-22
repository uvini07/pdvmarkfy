// Retaguarda: o menu lateral segue a organização do PDV Legal (Pessoas,
// Produtos, Tabela de preços, Estoque, Financeiro, Administrativo, Relatórios,
// Atendimento), mas cada item só aparece para quem tem a permissão.

import { useEffect, useState } from 'react'
import { useColecao, useDoc } from '../../dados/banco.js'
import { useSessao, sessao } from '../../estado/sessao.js'
import { useRota, ir } from '../../rotas/useRota.js'
import { Icone } from '../../componentes/Icone.jsx'
import { Logo, Gota } from '../../componentes/ui.jsx'
import { Menu } from '../../componentes/Menu.jsx'
import { Painel } from './Painel.jsx'
import { lerDispositivo } from '../Entrar.jsx'
import { Produtos } from './Produtos.jsx'
import { Grupos, Classes } from './Grupos.jsx'
import { Modificadores } from './Modificadores.jsx'
import { TabelaPrecos, Promocoes } from './Precos.jsx'
import { Estoque, Movimentos } from './Estoque.jsx'
import { ConferenciaCaixa, Contas } from './Financeiro.jsx'
import { Relatorios } from './Relatorios.jsx'
import { Clientes, Fornecedores } from './Pessoas.jsx'
import { Usuarios, Perfis } from './Usuarios.jsx'
import { Filiais, PontosVenda, FormasPagamento, MotivosCancelamento, TiposDesconto, Configuracoes } from './Administrativo.jsx'
import { Comunicados } from './Comunicados.jsx'
import { Seguranca } from './Seguranca.jsx'

export const MENU = [
  { id: 'painel', nome: 'Painel', icone: 'grafico', permissao: 'admin.dashboard', tela: Painel },
  {
    nome: 'Cardápio',
    icone: 'livro',
    itens: [
      { id: 'produtos', nome: 'Produtos', permissao: 'admin.cardapio', tela: Produtos },
      { id: 'grupos', nome: 'Grupos', permissao: 'admin.cardapio', tela: Grupos },
      { id: 'classes', nome: 'Classes', permissao: 'admin.cardapio', tela: Classes },
      { id: 'modificadores', nome: 'Sabores e adicionais', permissao: 'admin.cardapio', tela: Modificadores },
    ],
  },
  {
    nome: 'Preços',
    icone: 'etiqueta',
    itens: [
      { id: 'precos', nome: 'Tabela de preços', permissao: 'admin.precos', tela: TabelaPrecos },
      { id: 'promocoes', nome: 'Promoções', permissao: 'admin.precos', tela: Promocoes },
    ],
  },
  {
    nome: 'Estoque',
    icone: 'estoque',
    itens: [
      { id: 'estoque', nome: 'Saldo', permissao: 'admin.estoque', tela: Estoque },
      { id: 'movimentos', nome: 'Movimentações', permissao: 'admin.estoque', tela: Movimentos },
    ],
  },
  {
    nome: 'Financeiro',
    icone: 'dinheiro',
    itens: [
      { id: 'caixas', nome: 'Conferência de caixa', permissao: 'admin.financeiro', tela: ConferenciaCaixa },
      { id: 'contas', nome: 'Contas a pagar e receber', permissao: 'admin.financeiro', tela: Contas },
    ],
  },
  { id: 'relatorios', nome: 'Relatórios', icone: 'nota', permissao: 'admin.relatorios', tela: Relatorios },
  {
    nome: 'Pessoas',
    icone: 'pessoas',
    itens: [
      { id: 'clientes', nome: 'Clientes', permissao: 'admin.pessoas', tela: Clientes },
      { id: 'fornecedores', nome: 'Fornecedores', permissao: 'admin.pessoas', tela: Fornecedores },
      { id: 'usuarios', nome: 'Usuários', permissao: 'admin.usuarios', tela: Usuarios },
      { id: 'perfis', nome: 'Perfis de acesso', permissao: 'admin.usuarios', tela: Perfis },
    ],
  },
  {
    nome: 'Administrativo',
    icone: 'engrenagem',
    itens: [
      { id: 'filiais', nome: 'Filiais', permissao: 'admin.config', tela: Filiais },
      { id: 'pdvs', nome: 'Pontos de venda', permissao: 'admin.config', tela: PontosVenda },
      { id: 'pagamentos', nome: 'Formas de pagamento', permissao: 'admin.config', tela: FormasPagamento },
      { id: 'motivos', nome: 'Motivos de cancelamento', permissao: 'admin.config', tela: MotivosCancelamento },
      { id: 'descontos', nome: 'Tipos de desconto', permissao: 'admin.config', tela: TiposDesconto },
      { id: 'configuracoes', nome: 'Configurações', permissao: 'admin.config', tela: Configuracoes },
    ],
  },
  { id: 'comunicados', nome: 'Comunicados', icone: 'megafone', permissao: 'admin.dashboard', tela: Comunicados },
  { id: 'seguranca', nome: 'Segurança e backup', icone: 'escudo', permissao: ['admin.auditoria', 'admin.backup'], tela: Seguranca },
]

const permitido = (item, pode) => (Array.isArray(item.permissao) ? item.permissao.some(pode) : pode(item.permissao))

function Lateral({ atual, pode, aberto, aoFechar, naoLidos }) {
  const secaoAtual = MENU.find((m) => m.itens?.some((i) => i.id === atual))?.nome
  const [abertas, setAbertas] = useState(() => new Set(secaoAtual ? [secaoAtual] : []))
  useEffect(() => {
    if (secaoAtual) setAbertas((a) => new Set([...a, secaoAtual]))
  }, [secaoAtual])

  const link = (item, filho) => (
    <a key={item.id} href={`#/admin/${item.id}`} className={`lateral__link ${filho ? 'lateral__link--filho' : ''}`} aria-current={atual === item.id ? 'page' : undefined} onClick={aoFechar}>
      {!filho && <Icone nome={item.icone} tamanho={20} />}
      {filho && <Gota tamanho={7} className="lateral__gota" />}
      <span>{item.nome}</span>
      {item.id === 'comunicados' && naoLidos > 0 && <span className="lateral__contador">{naoLidos}</span>}
    </a>
  )

  return (
    <nav className={`lateral ${aberto ? 'lateral--aberta' : ''}`} aria-label="Menu da retaguarda">
      <div className="lateral__marca">
        <Logo claro altura={24} />
        <span>Retaguarda</span>
      </div>
      <div className="lateral__itens rolagem">
        {MENU.map((m) => {
          if (!m.itens) return permitido(m, pode) ? link(m) : null
          const filhos = m.itens.filter((i) => permitido(i, pode))
          if (!filhos.length) return null
          const aberta = abertas.has(m.nome)
          return (
            <div key={m.nome} className="lateral__secao">
              <button
                type="button"
                className={`lateral__link ${secaoAtual === m.nome ? 'lateral__link--ativa' : ''}`}
                aria-expanded={aberta}
                onClick={() =>
                  setAbertas((a) => {
                    const n = new Set(a)
                    n.has(m.nome) ? n.delete(m.nome) : n.add(m.nome)
                    return n
                  })
                }
              >
                <Icone nome={m.icone} tamanho={20} />
                <span>{m.nome}</span>
                <Icone nome="seta-baixo" tamanho={16} className="lateral__seta" />
              </button>
              {aberta && <div className="lateral__filhos">{filhos.map((f) => link(f, true))}</div>}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

export function Admin() {
  const { partes } = useRota()
  const { usuario, filial, filiaisPermitidas, pode } = useSessao()
  const comunicados = useColecao('comunicados')
  const usuarios = useColecao('usuarios')
  const config = useDoc('config')
  const [menuAberto, setMenuAberto] = useState(false)

  const todas = MENU.flatMap((m) => m.itens || [m]).filter((i) => permitido(i, pode))
  const id = partes[1] || todas[0]?.id
  const item = todas.find((i) => i.id === id)
  const Tela = item?.tela

  useEffect(() => {
    if (!partes[1] && todas[0]) ir(`/admin/${todas[0].id}`, { substituir: true })
  }, [partes, todas])

  const naoLidos = comunicados.filter((c) => (!c.filiais?.length || c.filiais.includes(filial?.id)) && !c.lidos?.[usuario.id]).length
  const demosAtivos = usuarios.some((u) => u.demonstracao && u.ativo)
  const diasSemBackup = config.ultimoBackup ? Math.floor((Date.now() - new Date(config.ultimoBackup)) / 86400000) : null

  const pontos = useColecao('pontosVenda')
  const irParaCaixa = () => {
    const daFilial = pontos.filter((p) => p.ativo && p.filialId === filial?.id)
    const pdv = daFilial.find((p) => p.id === lerDispositivo().pdvId) || daFilial[0]
    if (!pdv) return ir('/admin/pdvs')
    sessao.trocarModo('caixa', { pdvId: pdv.id })
    ir('/caixa', { substituir: true })
  }

  const menuUsuario = [
    ...(pode('caixa.vender') ? [{ rotulo: 'Ir para o caixa', icone: 'recibo', acao: irParaCaixa }] : []),
    ...(pode('cozinha.ver') ? [{ rotulo: 'Tela da cozinha', icone: 'cozinha', acao: () => window.open('#/cozinha', 'cozinha', 'noopener') }] : []),
    { rotulo: 'Painel de senhas da loja', icone: 'monitor', acao: () => window.open(`#/painel/${filial?.id}`, 'painel-senhas', 'noopener') },
    { separador: true },
    { rotulo: 'Bloquear tela', icone: 'cadeado', acao: () => sessao.bloquear('manual') },
    { rotulo: 'Sair', icone: 'sair', acao: () => sessao.sair() },
  ]

  return (
    <div className="tema-claro admin">
      <Lateral atual={id} pode={pode} aberto={menuAberto} aoFechar={() => setMenuAberto(false)} naoLidos={naoLidos} />
      {menuAberto && <button type="button" className="admin__sombra" aria-label="Fechar menu" onClick={() => setMenuAberto(false)} />}
      <div className="admin__principal">
        <header className="admin__topo">
          <button type="button" className="botao-icone admin__abrir-menu" aria-label="Abrir menu" onClick={() => setMenuAberto(true)}>
            <Icone nome="menu" tamanho={22} />
          </button>
          <label className="admin__filial">
            <Icone nome="loja" tamanho={18} />
            <span className="so-leitor">Filial</span>
            <select value={filial?.id || ''} onChange={(e) => sessao.trocarFilial(e.target.value)}>
              {filiaisPermitidas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
            <Icone nome="seta-baixo" tamanho={14} />
          </label>
          <div className="admin__topo-direita">
            {naoLidos > 0 && (
              <a className="admin__alerta" href="#/admin/comunicados">
                <Icone nome="megafone" tamanho={18} /> {naoLidos}
              </a>
            )}
            <Menu
              rotulo="Conta"
              itens={menuUsuario}
              gatilho={
                <span className="admin__usuario">
                  <span className="cartao-usuario__inicial" aria-hidden="true">
                    {usuario.nome[0]}
                  </span>
                  <span className="admin__usuario-nome">{usuario.nome}</span>
                  <Icone nome="seta-baixo" tamanho={14} />
                </span>
              }
            />
          </div>
        </header>

        {(demosAtivos || (pode('admin.backup') && (diasSemBackup === null || diasSemBackup >= 1))) && (
          <div className="admin__avisos">
            {demosAtivos && pode('admin.usuarios') && (
              <p className="faixa faixa--alerta">
                <Icone nome="alerta" tamanho={18} />
                <span>
                  Os usuários de demonstração (Ana, Bruno e Cozinha Morumbi) têm PIN conhecido. <a href="#/admin/usuarios">Troque os PINs ou desative-os</a> antes de usar na loja.
                </span>
              </p>
            )}
            {pode('admin.backup') && (diasSemBackup === null || diasSemBackup >= 1) && (
              <p className="faixa">
                <Icone nome="nuvem" tamanho={18} />
                <span>
                  {diasSemBackup === null ? 'Nenhum backup feito ainda.' : `Último backup há ${diasSemBackup} dia(s).`} Os dados ficam só neste navegador até o banco de dados entrar. <a href="#/admin/seguranca">Fazer backup agora</a>
                </span>
              </p>
            )}
          </div>
        )}

        <main className="admin__conteudo" id="conteudo">
          {Tela ? <Tela parametro={partes[2]} /> : <p className="mudo">Escolha uma opção no menu.</p>}
        </main>
      </div>
    </div>
  )
}
