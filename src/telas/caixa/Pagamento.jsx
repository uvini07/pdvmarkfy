// Pagamento: uma ou várias formas (dividir a conta), troco no dinheiro com
// notas rápidas, CPF na nota e a tela de pedido concluído com a senha.

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../componentes/Modal.jsx'
import { Botao, CampoDinheiro, Campo, Entrada } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { avisar } from '../../componentes/dialogos.jsx'
import { imprimir } from '../../componentes/Impressao.jsx'
import { useColecao, useDoc } from '../../dados/banco.js'
import { finalizarVenda } from '../../dados/vendas.js'
import { useSessao } from '../../estado/sessao.js'
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

export function Pagamento({ pedido, totais, caixa, aoFechar, aoConcluir, aoMudarCpf }) {
  const { usuario, filial, pdv } = useSessao()
  const config = useDoc('config')
  const formas = useColecao('formasPagamento')
    .filter((f) => f.ativo)
    .sort((a, b) => a.ordem - b.ordem)
  const [pagamentos, setPagamentos] = useState([])
  const [forma, setForma] = useState(null)
  const [valorDigitado, setValorDigitado] = useState(0)
  const [cpf, setCpf] = useState(pedido.cliente?.cpf || '')
  const [venda, setVenda] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const pago = pagamentos.reduce((t, p) => t + p.valor - (p.troco || 0), 0)
  const restante = Math.max(0, totais.total - pago)
  const cpfErro = cpf && !cpfValido(cpf) ? 'CPF inválido. Confira os números.' : null

  useEffect(() => setValorDigitado(restante), [restante])

  const escolherForma = (f) => {
    setForma(f)
    setValorDigitado(restante)
  }

  const lancar = (valorRecebido = valorDigitado) => {
    if (!forma || valorRecebido <= 0) return
    if (!forma.troco && valorRecebido > restante) return avisar(`${forma.nome} não dá troco. O valor máximo é ${reais(restante)}.`, 'erro')
    const troco = forma.troco ? Math.max(0, valorRecebido - restante) : 0
    setPagamentos((p) => [...p, { formaId: forma.id, nome: forma.nome, valor: valorRecebido, troco }])
    setForma(null)
  }

  const concluir = async () => {
    if (restante > 0 || cpfErro || ocupado || venda) return
    setOcupado(true)
    try {
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

  const troco = useMemo(() => pagamentos.reduce((t, p) => t + (p.troco || 0), 0), [pagamentos])

  if (venda) {
    return (
      <Modal aberto semCabecalho largura="m" className="tema-escuro pago" aoFechar={() => (aoConcluir(), aoFechar())}>
        <div className="pago__conteudo">
          <Icone nome="check-circulo" tamanho={52} className="positivo" />
          <p className="pago__rotulo">Pedido concluído</p>
          <p className="pago__senha numero" aria-label={`Senha ${venda.numero}`}>
            {String(venda.numero).padStart(3, '0')}
          </p>
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
            <Botao tamanho="g" onClick={() => (aoConcluir(), aoFechar())} autoFocus iconeDepois="seta-dir">
              Novo pedido
            </Botao>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Receber" largura="g" className="tema-escuro pagamento">
      <div className="pagamento__layout">
        <section className="pagamento__resumo">
          <dl className="numero">
            <div>
              <dt>Total do pedido</dt>
              <dd className="pagamento__total">{reais(totais.total)}</dd>
            </div>
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
                    aoMudarCpf(digitos(e.target.value))
                  }}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  autoComplete="off"
                />
              )}
            </Campo>
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
              {restante === 0 && (
                <Botao tamanho="g" bloco onClick={concluir} carregando={ocupado} disabled={Boolean(cpfErro)}>
                  Concluir pedido
                </Botao>
              )}
            </>
          ) : (
            <div className="pagamento__valor">
              <button type="button" className="link-voltar" onClick={() => setForma(null)}>
                <Icone nome="seta-esq" tamanho={16} /> {forma.nome}
              </button>
              <Campo rotulo={forma.troco ? 'Valor recebido' : `Valor em ${forma.nome}`}>
                {(p) => <CampoDinheiro {...p} valor={valorDigitado} aoMudar={setValorDigitado} autoFocus grande onKeyDown={(e) => e.key === 'Enter' && lancar()} />}
              </Campo>
              {forma.troco && (
                <>
                  <div className="notas">
                    {notasRapidas(restante).map((v) => (
                      <button key={v} type="button" onClick={() => lancar(v)} className="numero">
                        {v === restante ? 'Valor exato' : reais(v)}
                      </button>
                    ))}
                  </div>
                  {valorDigitado > restante && (
                    <p className="pagamento__troco numero">
                      Troco: <strong>{reais(valorDigitado - restante)}</strong>
                    </p>
                  )}
                </>
              )}
              {!forma.troco && forma.tipo !== 'dinheiro' && <p className="mudo">Passe na maquininha e confirme aqui quando aprovar.</p>}
              <Botao tamanho="g" bloco onClick={() => lancar()} disabled={valorDigitado <= 0}>
                {valorDigitado < restante ? `Receber ${reais(valorDigitado)} e dividir` : `Confirmar ${reais(valorDigitado)}`}
              </Botao>
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
