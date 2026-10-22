// Mesas agora: o salão da filial em tempo real, para o gerente acompanhar sem
// sair da retaguarda — quantas mesas estão ocupadas, quanto está em aberto, o
// que pede atenção (prato pronto esperando, mesa sem pedido, conta pedida e
// mesa aberta há horas) e como foram as contas fechadas hoje.
//
// Só para ver: lançar, trocar de mesa e fechar a conta é no caixa.

import { useMemo, useState } from 'react'
import { useColecao } from '../../dados/banco.js'
import { resumoMesas } from '../../dados/relatorios.js'
import { useSessao } from '../../estado/sessao.js'
import { Pagina, Cartao } from '../../componentes/Pagina.jsx'
import { Tabela } from '../../componentes/Tabela.jsx'
import { Modal } from '../../componentes/Modal.jsx'
import { Segmentos, Vazio, useRelogio } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { ContaMesa } from '../../componentes/ContaMesa.jsx'
import { LegendaSalao, ListaMesas, MapaSalao, gruposDaLista, useSalao } from '../../componentes/Salao.jsx'
import { decorrido, ha, hoje, hora, minutosDesde } from '../../lib/datas.js'
import { reais } from '../../lib/dinheiro.js'

// Mesa aberta há mais que isso costuma ser conta esquecida
const MESA_LONGA_MIN = 120

const ALERTAS = {
  pronto: { icone: 'check-circulo', tom: 'verde' },
  conta: { icone: 'recibo', tom: 'azul' },
  atencao: { icone: 'relogio', tom: 'laranja' },
  longa: { icone: 'alerta', tom: 'vermelho' },
}

export function MesasAgora() {
  const { filial } = useSessao()
  const vendas = useColecao('vendas')
  const formas = useColecao('formasPagamento')
  const agora = useRelogio(15_000)
  const salao = useSalao(filial.id, agora)
  const [vista, setVista] = useState('mapa')
  const [ambienteId, setAmbienteId] = useState(null)
  const [aberta, setAberta] = useState(null)
  const ambiente = salao.ambientes.find((a) => a.id === ambienteId) || salao.ambientes[0]

  const ocupadas = [...salao.situacoes.values(), ...salao.foraDoMapa.map((f) => f.situacao)].filter((s) => s.conta)
  const tempoMedio = ocupadas.length ? Math.round(ocupadas.reduce((t, s) => t + s.minutos, 0) / ocupadas.length) : 0

  const fechadasHoje = useMemo(() => vendas.filter((v) => v.filialId === filial.id && v.dia === hoje() && v.mesa && v.status === 'concluida').sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)), [vendas, filial.id])
  const dia = resumoMesas(fechadasHoje)

  const alertas = useMemo(() => {
    const lista = []
    for (const s of ocupadas) {
      const c = s.conta
      for (const p of s.pedidos.filter((x) => x.cozinha?.status === 'pronto'))
        lista.push({ tipo: 'pronto', ordem: 0, conta: c, texto: `${p.numero}º pedido pronto ${ha(p.cozinha.prontoEm || p.criadoEm, agora)}, esperando servir` })
      if (s.estado === 'fechando') lista.push({ tipo: 'conta', ordem: 1, conta: c, texto: `pediu a conta ${ha(c.contaPedidaEm || c.abertaEm, agora)}` })
      if (s.atencao) lista.push({ tipo: 'atencao', ordem: 2, conta: c, texto: `sem pedido há ${decorrido(c.ultimoPedidoEm || c.abertaEm, agora)}` })
      if (minutosDesde(c.abertaEm, agora) >= MESA_LONGA_MIN) lista.push({ tipo: 'longa', ordem: 3, conta: c, texto: `aberta há ${decorrido(c.abertaEm, agora)}: confira se a conta não foi esquecida` })
    }
    return lista.sort((a, b) => a.ordem - b.ordem)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salao, agora])

  const situacaoAberta = aberta && ocupadas.find((s) => s.conta.id === aberta)
  const abrir = (mesa) => {
    const s = salao.situacoes.get(mesa.id) || salao.foraDoMapa.find((f) => f.mesa.id === mesa.id)?.situacao
    if (s?.conta) setAberta(s.conta.id)
  }

  if (!salao.mesas.length && !salao.foraDoMapa.length)
    return (
      <Pagina titulo="Mesas agora" descricao={`${filial.nome} ainda não tem o salão montado.`}>
        <Cartao>
          <Vazio mascote titulo="Monte o salão para acompanhar as mesas" texto="Desenhe as mesas em Montar o salão. Quando o caixa abrir as contas, elas aparecem aqui na hora." acao={<a className="botao botao--primario botao--m" href="#/admin/salao">Montar o salão</a>} />
        </Cartao>
      </Pagina>
    )

  return (
    <Pagina titulo="Mesas agora" descricao={`${filial.nome}, atualizado às ${hora(agora)}. Muda sozinho com o que acontece no caixa e na cozinha deste computador.`}>
      <div className="kpis">
        <div className="kpi kpi--principal">
          <span className="kpi__rotulo">Mesas ocupadas</span>
          <strong className="kpi__valor numero">
            {salao.ocupadas} <small className="kpi__de">de {salao.total}</small>
          </strong>
          <span className="kpi__detalhe">{salao.pessoas ? `${salao.pessoas} pessoa(s) no salão` : 'Ninguém informado nas mesas'}</span>
        </div>
        <div className="kpi">
          <span className="kpi__rotulo">Em aberto</span>
          <strong className="kpi__valor numero">{reais(salao.emAberto)}</strong>
          <span className="kpi__detalhe">{salao.fechando ? `${salao.fechando} mesa(s) pediram a conta` : 'Nenhuma mesa pediu a conta'}</span>
        </div>
        <div className="kpi">
          <span className="kpi__rotulo">Tempo médio das ocupadas</span>
          <strong className="kpi__valor numero">{ocupadas.length ? `${tempoMedio} min` : '—'}</strong>
          <span className="kpi__detalhe">{dia.contas ? `Hoje as mesas ficaram ${dia.tempoMedio} min em média` : 'Nenhuma conta fechada hoje'}</span>
        </div>
        <div className="kpi">
          <span className="kpi__rotulo">Contas fechadas hoje</span>
          <strong className="kpi__valor numero">{reais(dia.total)}</strong>
          <span className="kpi__detalhe">
            {dia.contas} conta(s){dia.porPessoa ? `, ${reais(dia.porPessoa)} por pessoa` : ''}
            {dia.servico ? `, ${reais(dia.servico)} de serviço` : ''}
          </span>
        </div>
      </div>

      <div className="mesas-agora">
        <Cartao
          titulo="Salão"
          className="mesas-agora__mapa"
          acao={
            <Segmentos
              rotulo="Ver como"
              tamanho="p"
              valor={vista}
              aoMudar={setVista}
              opcoes={[
                { valor: 'mapa', rotulo: 'Mapa', icone: 'mesa' },
                { valor: 'lista', rotulo: 'Lista', icone: 'lista' },
              ]}
            />
          }
        >
          {vista === 'mapa' && salao.ambientes.length > 1 && <Segmentos rotulo="Ambiente" tamanho="p" valor={ambiente?.id} aoMudar={setAmbienteId} opcoes={salao.ambientes.map((a) => ({ valor: a.id, rotulo: a.nome }))} />}
          {vista === 'mapa' && ambiente ? <MapaSalao ambiente={ambiente} situacoes={salao.situacoes} aoTocar={abrir} rotulo={`Mesas de ${ambiente.nome}`} /> : <ListaMesas grupos={gruposDaLista(salao)} aoTocar={abrir} />}
          <LegendaSalao salao={salao} />
          <p className="mudo mesas-agora__nota">Toque numa mesa ocupada para ver a conta. Lançar, trocar de mesa e fechar a conta é no caixa.</p>
        </Cartao>

        <Cartao titulo={`Pedem atenção${alertas.length ? ` (${alertas.length})` : ''}`} className="mesas-agora__alertas">
          {alertas.length ? (
            <ul className="alertas-mesa">
              {alertas.map((a, i) => (
                <li key={i}>
                  <button type="button" className={`alerta-mesa alerta-mesa--${ALERTAS[a.tipo].tom}`} onClick={() => setAberta(a.conta.id)}>
                    <Icone nome={ALERTAS[a.tipo].icone} tamanho={20} />
                    <span>
                      <strong>{a.conta.mesaNome}</strong> {a.texto}
                    </span>
                    <Icone nome="seta-dir" tamanho={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mudo">Tudo em dia: nenhum prato esperando, nenhuma mesa esquecida.</p>
          )}
        </Cartao>
      </div>

      <h2 className="titulo-secao">
        <Icone nome="recibo" tamanho={22} /> Contas fechadas hoje
      </h2>
      <Tabela
        linhas={fechadasHoje}
        densa
        vazio="Nenhuma conta de mesa fechada hoje ainda."
        colunas={[
          { id: 'mesa', titulo: 'Mesa', valor: (v) => v.mesa.nome },
          { id: 'abertaEm', titulo: 'Abriu', valor: (v) => (v.mesa.abertaEm ? hora(v.mesa.abertaEm) : '—') },
          { id: 'criadoEm', titulo: 'Fechou', valor: (v) => hora(v.criadoEm) },
          { id: 'tempo', titulo: 'Tempo', alinhar: 'direita', valor: (v) => (v.mesa.abertaEm ? decorrido(v.mesa.abertaEm, new Date(v.criadoEm)) : '—'), ordenar: (v) => (v.mesa.abertaEm ? minutosDesde(v.mesa.abertaEm, new Date(v.criadoEm)) : 0) },
          { id: 'pessoas', titulo: 'Pessoas', alinhar: 'direita', valor: (v) => v.mesa.pessoas || '—' },
          { id: 'garcom', titulo: 'Atendeu', valor: (v) => v.mesa.garcomNome || v.operadorNome },
          { id: 'servico', titulo: 'Serviço', alinhar: 'direita', render: (v) => (v.servico ? reais(v.servico) : <span className="mudo">—</span>), ordenar: (v) => v.servico || 0 },
          { id: 'total', titulo: 'Consumo', alinhar: 'direita', render: (v) => <strong className="numero">{reais(v.total)}</strong>, ordenar: (v) => v.total },
        ]}
      />
      <p className="mudo">
        Histórico por mesa e por garçom em <a href="#/admin/relatorios">Relatórios</a>.
      </p>

      {situacaoAberta && (
        <Modal aberto aoFechar={() => setAberta(null)} titulo="Conta da mesa" subtitulo="Só para consulta. Para mexer na conta, use o caixa." largura="m">
          <ContaMesa situacao={situacaoAberta} formas={formas} somenteLeitura />
        </Modal>
      )}
    </Pagina>
  )
}
