// Pagamento: uma ou várias formas (dividir a conta), troco no dinheiro com
// notas rápidas, CPF na nota e a tela de pedido concluído com a senha.
//
// Também fecha a conta de uma mesa (contaId): soma a taxa de serviço, desconta
// o que já foi pago antes e, se só parte for paga agora (alguém foi embora
// antes), guarda o pagamento na conta para fechar depois.

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../componentes/Modal.jsx'
import { Botao, CampoDinheiro, Campo, Entrada } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { avisar, escolher } from '../../componentes/dialogos.jsx'
import { imprimir } from '../../componentes/Impressao.jsx'
import { useColecao, useDoc } from '../../dados/banco.js'
import { finalizarVenda } from '../../dados/vendas.js'
import { contaAtiva, fecharConta, pedidosDaConta, receberParte, totaisConta, valorDaParte } from '../../dados/mesas.js'
import { useSessao } from '../../estado/sessao.js'
import { hora } from '../../lib/datas.js'
import { reais } from '../../lib/dinheiro.js'
import { cpfValido, formatarCpf, digitos } from '../../lib/validacao.js'

const ICONE_FORMA = { dinheiro: 'dinheiro', pix: 'pix', debito: 'cartao', credito: 'cartao', voucher: 'vale', outro: 'recibo' }

function notasRapidas(restante) {
  const opcoes = new Set([restante])
  for (const nota of [500, 1000, 2000, 5000, 10000, 20000]) {
    const v = Math.ceil(restante / nota) * nota
    if (v > restante) opcoes.add(v)
  }
  return [...opcoes].sort((a, b) => a - b).slice(0, 5)
}

export function Pagamento({ pedido, totais, caixa, aoFechar, aoConcluir, aoMudarCpf, contaId, dividir, aoVoltarMesas }) {
  const { usuario, filial, pdv } = useSessao()
  const config = useDoc('config')
  const formas = useColecao('formasPagamento')
    .filter((f) => f.ativo)
    .sort((a, b) => a.ordem - b.ordem)
  const contas = useColecao('contasMesa')
  const pedidosMesa = useColecao('pedidosMesa')
  const conta = contaId ? contas.find((c) => c.id === contaId) : null
  const tConta = useMemo(() => (conta ? totaisConta(conta, pedidosDaConta(pedidosMesa, conta.id)) : null), [conta, pedidosMesa])
  const [pagamentos, setPagamentos] = useState([])
  const [forma, setForma] = useState(null)
  const [valorDigitado, setValorDigitado] = useState(0)
  const [cpf, setCpf] = useState(pedido?.cliente?.cpf || '')
  const [venda, setVenda] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [partes, setPartes] = useState(() => (dividir ? (conta?.pessoas > 1 ? conta.pessoas : 2) : null))

  const devido = conta ? tConta.falta : totais?.total || 0
  const pago = pagamentos.reduce((t, p) => t + p.valor - (p.troco || 0), 0)
  const restante = Math.max(0, devido - pago)
  // Com a conta dividida, cada pagamento cobre uma parte; sem dividir, o resto
  const alvo = partes ? Math.min(restante, valorDaParte(restante, partes)) : restante
  const cpfErro = cpf && !cpfValido(cpf) ? 'CPF inválido. Confira os números.' : null
  const nomeForma = (id) => formas.find((f) => f.id === id)?.nome || 'Pagamento'

  useEffect(() => setValorDigitado(alvo), [alvo])

  const escolherForma = (f) => {
    setForma(f)
    setValorDigitado(alvo)
  }

  const lancar = (valorRecebido = valorDigitado) => {
    if (!forma || valorRecebido <= 0) return
    if (!forma.troco && valorRecebido > restante) return avisar(`${forma.nome} não dá troco. O valor máximo é ${reais(restante)}.`, 'erro')
    const troco = forma.troco ? Math.max(0, valorRecebido - alvo) : 0
    setPagamentos((p) => [...p, { formaId: forma.id, nome: forma.nome, valor: valorRecebido, troco }])
    if (partes > 1) setPartes(partes - 1)
    setForma(null)
  }

  const concluir = async () => {
    if (restante > 0 || cpfErro || ocupado || venda) return
    setOcupado(true)
    try {
      if (conta) {
        const v = await fecharConta({ conta, pagamentos, cpf: digitos(cpf), usuario, pdvId: pdv.id, caixaId: caixa.id })
        setVenda(v)
      } else {
        const v = await finalizarVenda({
          pedido: { ...pedido, cliente: { ...pedido.cliente, cpf: digitos(cpf) } },
          pagamentos: pagamentos.map(({ nome, ...p }) => p),
          usuario,
          filialId: filial.id,
          pdvId: pdv.id,
          caixaId: caixa.id,
        })
        setVenda(v)
        if (config.imprimirComandaAuto && v.cozinha) imprimir('comanda', v)
      }
    } catch (e) {
      avisar(e.message, 'erro')
    }
    setOcupado(false)
  }

  // Tudo pago numa forma só: conclui sozinho, sem um clique a mais
  useEffect(() => {
    if (!venda && pagamentos.length && restante === 0 && !cpfErro && !ocupado) concluir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagamentos])

  // Parte da conta paga agora, o resto depois
  const guardarParcial = () => {
    try {
      receberParte({ conta, pagamentos: pagamentos.map(({ nome, ...p }) => p), usuario, caixaId: caixa.id, pdvId: pdv.id })
      avisar(`${reais(pago)} guardado na conta da ${conta.mesaNome}. Falta ${reais(restante)}.`)
      aoFechar()
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  // Fechar a janela com dinheiro já recebido não pode sumir com ele
  const fechar = async () => {
    if (conta && pagamentos.length && !venda) {
      const opcoes = ['Guardar na conta como pagamento parcial', 'Não guardar (devolver ao cliente)']
      const r = await escolher({ titulo: 'E o que já foi recebido?', subtitulo: `${reais(pago)} recebidos agora; ainda falta ${reais(restante)}.`, opcoes })
      if (r === opcoes[0]) return guardarParcial()
      if (r !== opcoes[1]) return
    }
    aoFechar()
  }

  const troco = useMemo(() => pagamentos.reduce((t, p) => t + (p.troco || 0), 0), [pagamentos])

  if (venda) {
    const terminar = () => (aoConcluir(), conta ? aoVoltarMesas() : aoFechar())
    return (
      <Modal aberto semCabecalho largura="m" className="tema-escuro pago" aoFechar={terminar}>
        <div className="pago__conteudo">
          <Icone nome="check-circulo" tamanho={52} className="positivo" />
          <p className="pago__rotulo">{venda.mesa ? 'Conta fechada' : 'Pedido concluído'}</p>
          {venda.mesa ? (
            <p className="pago__senha pago__senha--mesa">{venda.mesa.nome}</p>
          ) : (
            <p className="pago__senha numero" aria-label={`Senha ${venda.numero}`}>
              {String(venda.numero).padStart(3, '0')}
            </p>
          )}
          {venda.cliente?.nome && <p className="pago__nome">{venda.cliente.nome}</p>}
          {troco > 0 && (
            <div className="pago__troco">
              <span>Troco</span>
              <strong className="numero">{reais(troco)}</strong>
            </div>
          )}
          <div className="pago__acoes">
            <Botao variante="secundario" icone="imprimir" onClick={() => imprimir('cupom', venda)}>
              Cupom
            </Botao>
            {venda.cozinha && (
              <Botao variante="secundario" icone="cozinha" onClick={() => imprimir('comanda', venda)}>
                Comanda
              </Botao>
            )}
            <Botao tamanho="g" onClick={terminar} autoFocus iconeDepois="seta-dir">
              {venda.mesa ? 'Voltar às mesas' : 'Novo pedido'}
            </Botao>
          </div>
        </div>
      </Modal>
    )
  }

  if (contaId && !contaAtiva(conta)) {
    return (
      <Modal aberto aoFechar={aoFechar} titulo="Conta já fechada" largura="p" className="tema-escuro" rodape={<Botao onClick={aoFechar}>Voltar às mesas</Botao>}>
        <p className="texto-modal">Esta conta foi fechada ou cancelada em outro caixa enquanto esta janela estava aberta. Nada foi cobrado aqui.</p>
      </Modal>
    )
  }

  return (
    <Modal aberto aoFechar={fechar} titulo={conta ? `Receber · ${conta.mesaNome}` : 'Receber'} largura="g" className="tema-escuro pagamento">
      <div className="pagamento__layout">
        <section className="pagamento__resumo">
          <dl className="numero">
            <div>
              <dt>{conta ? 'Total da conta' : 'Total do pedido'}</dt>
              <dd className="pagamento__total">{reais(conta ? tConta.total : totais.total)}</dd>
            </div>
            {conta && (
              <>
                <div className="pagamento__detalhe">
                  <dt>Consumo</dt>
                  <dd>{reais(tConta.consumo)}</dd>
                </div>
                {tConta.servico > 0 && (
                  <div className="pagamento__detalhe">
                    <dt>Taxa de serviço ({conta.servico.percentual}%)</dt>
                    <dd>{reais(tConta.servico)}</dd>
                  </div>
                )}
                {(conta.pagamentos || []).map((p) => (
                  <div key={p.id} className="pagamento__detalhe">
                    <dt>
                      Pago antes: {nomeForma(p.formaId)} <small>{hora(p.em)}</small>
                    </dt>
                    <dd>−{reais(p.valor - (p.troco || 0))}</dd>
                  </div>
                ))}
              </>
            )}
            {pagamentos.map((p, i) => (
              <div key={i} className="pagamento__lancado">
                <dt>
                  {p.nome}
                  {p.troco > 0 && <small> troco {reais(p.troco)}</small>}
                </dt>
                <dd>
                  {reais(p.valor)}
                  <button type="button" onClick={() => setPagamentos((l) => l.filter((_, k) => k !== i))} aria-label={`Desfazer pagamento em ${p.nome}`}>
                    <Icone nome="fechar" tamanho={16} />
                  </button>
                </dd>
              </div>
            ))}
            <div className="pagamento__falta">
              <dt>{restante ? 'Falta receber' : 'Tudo recebido'}</dt>
              <dd>{reais(restante)}</dd>
            </div>
          </dl>

          {config.pedirCpf && (
            <Campo rotulo="CPF na nota (opcional)" erro={cpfErro}>
              {(p) => (
                <Entrada
                  {...p}
                  value={formatarCpf(cpf)}
                  onChange={(e) => {
                    setCpf(digitos(e.target.value))
                    aoMudarCpf?.(digitos(e.target.value))
                  }}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  autoComplete="off"
                />
              )}
            </Campo>
          )}

          {conta && pagamentos.length > 0 && restante > 0 && (
            <div className="pagamento__parcial">
              <p>Os outros pagam depois? Guarde o que já foi recebido; a mesa continua aberta com {reais(restante)} a receber.</p>
              <Botao variante="secundario" bloco icone="check" onClick={guardarParcial}>
                Guardar {reais(pago)} e fechar depois
              </Botao>
            </div>
          )}
        </section>

        <section className="pagamento__formas">
          {!forma ? (
            <>
              <p className="pagamento__instrucao">{pagamentos.length ? 'Receber o restante em' : 'Como o cliente vai pagar?'}</p>
              <ul className="formas">
                {formas.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="forma" onClick={() => escolherForma(f)} disabled={!restante}>
                      <Icone nome={ICONE_FORMA[f.tipo] || 'recibo'} tamanho={28} traco={1.5} />
                      {f.nome}
                    </button>
                  </li>
                ))}
              </ul>
              {restante > 0 &&
                (partes ? (
                  <div className="dividir" role="group" aria-label="Dividir em partes iguais">
                    <span>Dividir em</span>
                    <div className="contador">
                      <button type="button" onClick={() => setPartes((n) => Math.max(1, n - 1))} disabled={partes <= 1} aria-label="Menos partes">
                        <Icone nome="menos" tamanho={18} />
                      </button>
                      <span className="numero" aria-live="polite">
                        {partes}
                      </span>
                      <button type="button" onClick={() => setPartes((n) => Math.min(30, n + 1))} aria-label="Mais partes">
                        <Icone nome="mais" tamanho={18} />
                      </button>
                    </div>
                    <span>
                      de <strong className="numero">{reais(alvo)}</strong>
                    </span>
                    <button type="button" className="link" onClick={() => setPartes(null)}>
                      não dividir
                    </button>
                  </div>
                ) : (
                  <button type="button" className="dividir__abrir" onClick={() => setPartes(conta?.pessoas > 1 ? conta.pessoas : 2)}>
                    <Icone nome="dividir" tamanho={18} /> Dividir em partes iguais
                  </button>
                ))}
              {restante === 0 && (
                <Botao tamanho="g" bloco onClick={concluir} carregando={ocupado} disabled={Boolean(cpfErro)}>
                  {conta ? 'Fechar a conta' : 'Concluir pedido'}
                </Botao>
              )}
            </>
          ) : (
            <div className="pagamento__valor">
              <button type="button" className="link-voltar" onClick={() => setForma(null)}>
                <Icone nome="seta-esq" tamanho={16} /> {forma.nome}
              </button>
              {partes && alvo < restante && (
                <p className="pagamento__parte">
                  Parte de <strong className="numero">{reais(alvo)}</strong>. Depois desta, {partes - 1 === 1 ? 'falta 1 parte' : `faltam ${partes - 1} partes`}.
                </p>
              )}
              <Campo rotulo={forma.troco ? 'Valor recebido' : `Valor em ${forma.nome}`}>
                {(p) => <CampoDinheiro {...p} valor={valorDigitado} aoMudar={setValorDigitado} autoFocus grande onKeyDown={(e) => e.key === 'Enter' && lancar()} />}
              </Campo>
              {forma.troco && (
                <>
                  <div className="notas">
                    {notasRapidas(alvo).map((v) => (
                      <button key={v} type="button" onClick={() => lancar(v)} className="numero">
                        {v === alvo ? 'Valor exato' : reais(v)}
                      </button>
                    ))}
                  </div>
                  {valorDigitado > alvo && (
                    <p className="pagamento__troco numero">
                      Troco: <strong>{reais(valorDigitado - alvo)}</strong>
                    </p>
                  )}
                </>
              )}
              {!forma.troco && forma.tipo !== 'dinheiro' && <p className="mudo">Passe na maquininha e confirme aqui quando aprovar.</p>}
              <Botao tamanho="g" bloco onClick={() => lancar()} disabled={valorDigitado <= 0}>
                {valorDigitado < restante && !(forma.troco && valorDigitado >= alvo) ? `Receber ${reais(valorDigitado)}${partes ? '' : ' e dividir'}` : `Confirmar ${reais(valorDigitado)}`}
              </Botao>
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
