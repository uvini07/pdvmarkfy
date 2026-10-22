// Abertura, sangria/suprimento e fechamento do caixa.

import { useState } from 'react'
import { Modal } from '../../componentes/Modal.jsx'
import { Botao, CampoDinheiro, Campo, Entrada, Segmentos, Logo } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { avisar, pedirAutorizacao } from '../../componentes/dialogos.jsx'
import { imprimir } from '../../componentes/Impressao.jsx'
import { useColecao } from '../../dados/banco.js'
import { abrirCaixa, fecharCaixa, movimentarCaixa, resumoCaixa } from '../../dados/caixa.js'
import { useSessao, sessao } from '../../estado/sessao.js'
import { reais } from '../../lib/dinheiro.js'
import { hora } from '../../lib/datas.js'
import { textoLimpo } from '../../lib/validacao.js'

// aoSoMesas: na loja com salão, o aparelho do garçom pode entrar só para
// lançar nas mesas, sem abrir caixa (sem fundo de troco nem fechamento).
export function AberturaCaixa({ aoSoMesas }) {
  const { usuario, filial, pdv, pode } = useSessao()
  const caixas = useColecao('caixas')
  const [fundo, setFundo] = useState(15000)
  const [ocupado, setOcupado] = useState(false)
  const ultimo = caixas.filter((c) => c.pdvId === pdv.id && c.status !== 'aberto').sort((a, b) => (b.fechadoEm || '').localeCompare(a.fechadoEm || ''))[0]

  const abrir = async () => {
    let quem = usuario
    if (!pode('caixa.abrir')) {
      quem = await pedirAutorizacao({ permissao: 'caixa.abrir', acao: 'Abrir o caixa', filialId: filial.id })
      if (!quem) return
    }
    setOcupado(true)
    try {
      abrirCaixa({ pdvId: pdv.id, filialId: filial.id, usuario, fundo })
      avisar('Caixa aberto. Bom trabalho!')
    } catch (e) {
      avisar(e.message, 'erro')
    }
    setOcupado(false)
  }

  return (
    <div className="tema-escuro abertura">
      <div className="abertura__cartao">
        <Logo claro altura={28} />
        <h1>Abrir o caixa</h1>
        <p className="mudo">
          {filial.nome}, {pdv.nome}. Conte o dinheiro da gaveta e informe o fundo de troco.
        </p>
        <Campo rotulo="Fundo de troco">{(p) => <CampoDinheiro {...p} valor={fundo} aoMudar={setFundo} grande autoFocus onKeyDown={(e) => e.key === 'Enter' && abrir()} />}</Campo>
        {ultimo?.contado && <p className="mudo">No último fechamento ficaram {reais(Object.values(ultimo.contado).reduce((t, x) => t + x, 0))} contados no total.</p>}
        <Botao tamanho="g" bloco onClick={abrir} carregando={ocupado}>
          Abrir caixa com {reais(fundo)}
        </Botao>
        {aoSoMesas && (
          <div className="abertura__mesas">
            <Botao variante="secundario" bloco icone="mesa" onClick={aoSoMesas}>
              Só lançar nas mesas
            </Botao>
            <p className="mudo">Para o celular ou tablet do garçom: abre mesas e manda os pedidos para a cozinha, sem caixa. Receber fica para o caixa da loja.</p>
          </div>
        )}
        <Botao variante="fantasma" bloco onClick={() => sessao.sair()}>
          Sair
        </Botao>
      </div>
    </div>
  )
}

export function MovimentoCaixa({ caixa, aoFechar }) {
  const { usuario, filial, pode } = useSessao()
  const [tipo, setTipo] = useState('sangria')
  const [valor, setValor] = useState(0)
  const [motivo, setMotivo] = useState('')

  const salvar = async () => {
    if (valor <= 0) return
    let autorizador = null
    if (!pode('caixa.sangria')) {
      autorizador = await pedirAutorizacao({ permissao: 'caixa.sangria', acao: `${tipo === 'sangria' ? 'Sangria' : 'Suprimento'} de ${reais(valor)}`, filialId: filial.id })
      if (!autorizador) return
    }
    movimentarCaixa(caixa.id, { tipo, valor, motivo: textoLimpo(motivo, 120), usuario, autorizador })
    avisar(`${tipo === 'sangria' ? 'Sangria' : 'Suprimento'} de ${reais(valor)} registrado`)
    aoFechar()
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Sangria ou suprimento"
      subtitulo="Sangria tira dinheiro da gaveta (ex.: levar ao cofre). Suprimento coloca (ex.: mais troco)."
      largura="m"
      className="tema-escuro"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={salvar} disabled={valor <= 0}>
            Registrar {reais(valor)}
          </Botao>
        </>
      }
    >
      <div className="pilha">
        <Segmentos
          rotulo="Tipo"
          valor={tipo}
          aoMudar={setTipo}
          opcoes={[
            { valor: 'sangria', rotulo: 'Sangria (retirada)' },
            { valor: 'suprimento', rotulo: 'Suprimento (entrada)' },
          ]}
        />
        <Campo rotulo="Valor">{(p) => <CampoDinheiro {...p} valor={valor} aoMudar={setValor} grande autoFocus />}</Campo>
        <Campo rotulo="Motivo">{(p) => <Entrada {...p} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: depósito no cofre" maxLength={120} />}</Campo>
        {caixa.movimentos.length > 0 && (
          <div>
            <p className="campo__rotulo">Hoje neste caixa</p>
            <ul className="lista-simples">
              {caixa.movimentos.map((m) => (
                <li key={m.id}>
                  <span>
                    {hora(m.em)} {m.tipo === 'sangria' ? 'Sangria' : 'Suprimento'} {m.motivo && <small className="mudo">{m.motivo}</small>}
                  </span>
                  <span className={`numero ${m.tipo === 'sangria' ? 'negativo' : 'positivo'}`}>
                    {m.tipo === 'sangria' ? '−' : '+'}
                    {reais(m.valor)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

// Fechamento cego: o operador conta e digita sem ver o valor esperado. Só depois
// de confirmar o sistema mostra a diferença — é o que evita "ajustar" a contagem.
export function FechamentoCaixa({ caixa, aoFechar }) {
  const { usuario } = useSessao()
  const formas = useColecao('formasPagamento').filter((f) => f.ativo)
  const vendas = useColecao('vendas')
  const [contado, setContado] = useState(() => Object.fromEntries(formas.map((f) => [f.id, 0])))
  const [obs, setObs] = useState('')
  const [fechado, setFechado] = useState(null)

  const confirmar = () => {
    const f = fecharCaixa(caixa.id, { contado, obs: textoLimpo(obs, 200), usuario })
    setFechado(f)
  }

  if (fechado) {
    const r = resumoCaixa(fechado, vendas, formas)
    return (
      <Modal aberto aoFechar={aoFechar} titulo="Caixa fechado" subtitulo={`${r.vendas} vendas, ${reais(r.vendido)} vendido`} largura="m" className="tema-escuro" rodape={
        <>
          <Botao variante="secundario" icone="imprimir" onClick={() => imprimir('fechamento', fechado)}>
            Imprimir relatório
          </Botao>
          <Botao onClick={() => sessao.sair()} iconeDepois="sair">
            Sair do caixa
          </Botao>
        </>
      }>
        <table className="tabela tabela--densa fechamento">
          <thead>
            <tr>
              <th>Forma</th>
              <th className="alinhar-direita">Esperado</th>
              <th className="alinhar-direita">Contado</th>
              <th className="alinhar-direita">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {formas.map((f) => {
              const dif = (fechado.contado[f.id] || 0) - (fechado.esperado[f.id] || 0)
              return (
                <tr key={f.id}>
                  <td>{f.nome}</td>
                  <td className="alinhar-direita numero">{reais(fechado.esperado[f.id] || 0)}</td>
                  <td className="alinhar-direita numero">{reais(fechado.contado[f.id] || 0)}</td>
                  <td className={`alinhar-direita numero ${dif < 0 ? 'negativo' : dif > 0 ? 'positivo' : ''}`}>{reais(dif)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td />
              <td />
              <td className={`alinhar-direita numero ${fechado.diferenca < 0 ? 'negativo' : fechado.diferenca > 0 ? 'positivo' : ''}`}>{reais(fechado.diferenca)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mudo" style={{ marginTop: 12 }}>
          {fechado.diferenca === 0 ? 'Bateu certinho.' : 'A diferença fica registrada para a conferência do gerente na retaguarda.'}
          {r.servico > 0 && ` Neste caixa entraram ${reais(r.servico)} de taxa de serviço das mesas, para repassar.`}
        </p>
      </Modal>
    )
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo="Fechar o caixa"
      subtitulo="Conte o que tem na gaveta e os comprovantes de cada forma. O valor esperado só aparece depois."
      largura="m"
      className="tema-escuro"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao onClick={confirmar} icone="cadeado">
            Fechar caixa
          </Botao>
        </>
      }
    >
      <div className="pilha">
        {formas.map((f) => (
          <Campo key={f.id} rotulo={f.tipo === 'dinheiro' ? 'Dinheiro na gaveta (com o fundo de troco)' : `Total em ${f.nome}`}>
            {(p) => <CampoDinheiro {...p} valor={contado[f.id]} aoMudar={(v) => setContado((c) => ({ ...c, [f.id]: v }))} />}
          </Campo>
        ))}
        <Campo rotulo="Observação">{(p) => <Entrada {...p} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder="Opcional" />}</Campo>
        <p className="mudo">
          <Icone nome="info" tamanho={16} /> Aberto às {hora(caixa.abertoEm)} por {caixa.operadorNome}.
        </p>
      </div>
    </Modal>
  )
}
