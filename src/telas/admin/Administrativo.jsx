// Cadastros administrativos (o menu "Administrativo" do PDV Legal) e as
// configurações gerais do PDV.

import { useState } from 'react'
import { banco, useColecao, useDoc } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { useSessao } from '../../estado/sessao.js'
import { CadastroSimples } from '../../componentes/CadastroSimples.jsx'
import { Pagina, Cartao } from '../../componentes/Pagina.jsx'
import { Botao, Campo, Entrada, Alternador, Segmentos } from '../../componentes/ui.jsx'
import { avisar } from '../../componentes/dialogos.jsx'
import { cnpjValido, digitos, formatarCnpj, formatarTelefone, textoLimpo } from '../../lib/validacao.js'
import { TIPOS_PEDIDO } from '../../dados/vendas.js'

export function Filiais() {
  const vendas = useColecao('vendas')
  const pontos = useColecao('pontosVenda')
  return (
    <CadastroSimples
      colecao="filiais"
      titulo="Filiais"
      descricao="As lojas da rede. Preço, estoque, caixa e vendas são separados por filial."
      singular="Filial"
      permissao="admin.config"
      buscarEm={['nome', 'cidade', 'cnpj']}
      campos={[
        { id: 'nome', rotulo: 'Nome da loja', obrigatorio: true, max: 60 },
        { id: 'cidade', rotulo: 'Cidade – UF', obrigatorio: true, max: 60, placeholder: 'Jundiaí – SP' },
        { id: 'cnpj', rotulo: 'CNPJ', mascara: formatarCnpj, limpar: digitos, inputMode: 'numeric', ajuda: 'Sai no cupom.' },
        { id: 'telefone', rotulo: 'Telefone', mascara: formatarTelefone, limpar: digitos, inputMode: 'tel' },
        { id: 'endereco', rotulo: 'Endereço', max: 140, largo: true },
      ]}
      validar={(f) => (f.cnpj && !cnpjValido(f.cnpj) ? { cnpj: 'CNPJ inválido.' } : {})}
      podeRemover={(f) => (vendas.some((v) => v.filialId === f.id) || pontos.some((p) => p.filialId === f.id) ? 'Esta filial tem vendas ou caixas. Desative em vez de apagar.' : true)}
      aoSalvar={(f) => {
        // Filial nova já ganha um caixa
        if (!pontos.some((p) => p.filialId === f.id)) banco.inserir('pontosVenda', { nome: 'Caixa 1', filialId: f.id, ativo: true })
      }}
      ordenar={(a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)}
      colunas={[
        { id: 'nome', titulo: 'Loja' },
        { id: 'cidade', titulo: 'Cidade' },
        { id: 'cnpj', titulo: 'CNPJ', render: (f) => (f.cnpj ? formatarCnpj(f.cnpj) : <span className="mudo">não informado</span>) },
      ]}
    />
  )
}

export function PontosVenda() {
  const filiais = useColecao('filiais')
  const caixas = useColecao('caixas')
  return (
    <CadastroSimples
      colecao="pontosVenda"
      titulo="Pontos de venda"
      descricao="Cada computador ou tablet de caixa da loja. Cada um abre e fecha o próprio caixa."
      singular="Ponto de venda"
      permissao="admin.config"
      buscarEm={['nome']}
      padrao={{ nome: 'Caixa 2' }}
      campos={[
        { id: 'nome', rotulo: 'Nome', obrigatorio: true, max: 40 },
        { id: 'filialId', rotulo: 'Filial', obrigatorio: true, tipo: 'selecao', vazio: 'Escolha', opcoes: () => filiais.map((f) => ({ valor: f.id, rotulo: f.nome })) },
      ]}
      podeRemover={(p) => (caixas.some((c) => c.pdvId === p.id) ? 'Este caixa já foi usado. Desative em vez de apagar.' : true)}
      ordenar={(a, b) => (filiais.find((f) => f.id === a.filialId)?.nome || '').localeCompare(filiais.find((f) => f.id === b.filialId)?.nome || '') || a.nome.localeCompare(b.nome)}
      colunas={[
        { id: 'filialId', titulo: 'Filial', valor: (p) => filiais.find((f) => f.id === p.filialId)?.nome || '—' },
        { id: 'nome', titulo: 'Caixa' },
        { id: 'aberto', titulo: 'Agora', render: (p) => (caixas.some((c) => c.pdvId === p.id && c.status === 'aberto') ? 'Aberto' : <span className="mudo">Fechado</span>) },
      ]}
    />
  )
}

export function FormasPagamento() {
  const vendas = useColecao('vendas')
  return (
    <CadastroSimples
      colecao="formasPagamento"
      titulo="Formas de pagamento"
      descricao="Aparecem na tela de receber do caixa, nesta ordem. A taxa entra nos relatórios de recebimento líquido."
      singular="Forma de pagamento"
      permissao="admin.config"
      campos={[
        { id: 'nome', rotulo: 'Nome', obrigatorio: true, max: 30 },
        {
          id: 'tipo',
          rotulo: 'Tipo',
          tipo: 'selecao',
          obrigatorio: true,
          vazio: 'Escolha',
          opcoes: [
            { valor: 'dinheiro', rotulo: 'Dinheiro' },
            { valor: 'pix', rotulo: 'Pix' },
            { valor: 'debito', rotulo: 'Cartão de débito' },
            { valor: 'credito', rotulo: 'Cartão de crédito' },
            { valor: 'voucher', rotulo: 'Vale-refeição / alimentação' },
            { valor: 'outro', rotulo: 'Outro' },
          ],
        },
        { id: 'taxa', rotulo: 'Taxa (%)', tipo: 'numero', passo: 0.01, min: 0, maxNumero: 30 },
        { id: 'troco', rotulo: 'Dá troco', tipo: 'alternador', ajuda: 'Normalmente só o dinheiro.' },
      ]}
      podeRemover={(f) => (vendas.some((v) => v.pagamentos.some((p) => p.formaId === f.id)) ? 'Já há vendas com esta forma. Desative em vez de apagar.' : true)}
      ordenar={(a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)}
      colunas={[
        { id: 'nome', titulo: 'Forma' },
        { id: 'taxa', titulo: 'Taxa', alinhar: 'direita', render: (f) => `${(f.taxa || 0).toLocaleString('pt-BR')}%` },
        { id: 'troco', titulo: 'Troco', render: (f) => (f.troco ? 'Sim' : 'Não') },
      ]}
    />
  )
}

export function MotivosCancelamento() {
  return (
    <CadastroSimples
      colecao="motivosCancelamento"
      titulo="Motivos de cancelamento"
      descricao="O atendente escolhe um destes ao tirar um item ou cancelar um pedido. Aparecem nos relatórios."
      singular="Motivo"
      permissao="admin.config"
      campos={[{ id: 'nome', rotulo: 'Motivo', obrigatorio: true, max: 60, largo: true }]}
      colunas={[{ id: 'nome', titulo: 'Motivo' }]}
    />
  )
}

export function TiposDesconto() {
  return (
    <CadastroSimples
      colecao="tiposDesconto"
      titulo="Tipos de desconto"
      descricao="Cada desconto do caixa tem um motivo e um limite. Acima do limite, ou nos tipos que exigem, um gerente autoriza com o PIN."
      singular="Tipo de desconto"
      permissao="admin.config"
      padrao={{ maxPercentual: 10, exigeAutorizacao: false }}
      campos={[
        { id: 'nome', rotulo: 'Nome', obrigatorio: true, max: 40 },
        { id: 'maxPercentual', rotulo: 'Limite sem autorização (%)', tipo: 'numero', min: 0, maxNumero: 100, obrigatorio: true },
        { id: 'exigeAutorizacao', rotulo: 'Sempre exige autorização de gerente', tipo: 'alternador', largo: true },
      ]}
      validar={(t) => (t.maxPercentual < 0 || t.maxPercentual > 100 ? { maxPercentual: 'Use de 0 a 100.' } : {})}
      colunas={[
        { id: 'nome', titulo: 'Tipo' },
        { id: 'maxPercentual', titulo: 'Limite', alinhar: 'direita', render: (t) => `${t.maxPercentual}%` },
        { id: 'exigeAutorizacao', titulo: 'Autorização', render: (t) => (t.exigeAutorizacao ? 'Sempre' : 'Acima do limite') },
      ]}
    />
  )
}

export function Configuracoes() {
  const { usuario } = useSessao()
  const config = useDoc('config')
  const [dados, setDados] = useState(config)
  const mudar = (campo) => (v) => setDados((d) => ({ ...d, [campo]: v }))

  const salvar = () => {
    const limpo = {
      empresa: textoLimpo(dados.empresa, 40) || 'Sua Coxinha',
      mensagemCupom: textoLimpo(dados.mensagemCupom, 140),
      bloqueioMinutos: Math.min(60, Math.max(1, Number(dados.bloqueioMinutos) || 5)),
      sessaoHoras: Math.min(24, Math.max(1, Number(dados.sessaoHoras) || 12)),
      alertaCozinhaMin: Math.min(60, Math.max(1, Number(dados.alertaCozinhaMin) || 8)),
      // Instalação antiga não tem o campo: vale o padrão de 10%, não zero
      servicoPercentual: Math.min(20, Math.max(0, Math.round((Number(dados.servicoPercentual ?? 10) || 0) * 10) / 10)),
      alertaMesaMin: Math.min(180, Math.max(5, Number(dados.alertaMesaMin) || 20)),
      perguntarPessoas: dados.perguntarPessoas !== false,
      pedirCpf: Boolean(dados.pedirCpf),
      imprimirComandaAuto: Boolean(dados.imprimirComandaAuto),
      tipoPedidoPadrao: dados.tipoPedidoPadrao,
    }
    banco.alterarDoc('config', limpo)
    registrar('cadastro.alterado', 'Configurações gerais', { usuario })
    avisar('Configurações salvas')
  }

  return (
    <Pagina titulo="Configurações" descricao="Valem para todas as filiais." acoes={<Botao onClick={salvar}>Salvar</Botao>}>
      <div className="grade-cartoes">
        <Cartao titulo="Caixa">
          <div className="pilha">
            <Campo rotulo="Nome da empresa no cupom">{(p) => <Entrada {...p} value={dados.empresa} onChange={(e) => mudar('empresa')(e.target.value)} maxLength={40} />}</Campo>
            <Campo rotulo="Mensagem no fim do cupom">{(p) => <Entrada {...p} value={dados.mensagemCupom} onChange={(e) => mudar('mensagemCupom')(e.target.value)} maxLength={140} />}</Campo>
            <div>
              <p className="campo__rotulo">Tipo de pedido que já vem marcado</p>
              <Segmentos rotulo="Tipo de pedido padrão" valor={dados.tipoPedidoPadrao} aoMudar={mudar('tipoPedidoPadrao')} opcoes={TIPOS_PEDIDO.map((t) => ({ valor: t.id, rotulo: t.nome }))} />
            </div>
            <Alternador rotulo="Perguntar CPF na nota" ligado={dados.pedirCpf} aoMudar={mudar('pedirCpf')} />
            <Alternador rotulo="Imprimir a comanda da cozinha ao cobrar" ligado={dados.imprimirComandaAuto} aoMudar={mudar('imprimirComandaAuto')} descricao="Desligue se a loja usa só a tela da cozinha." />
          </div>
        </Cartao>
        <Cartao titulo="Segurança">
          <div className="pilha">
            <Campo rotulo="Bloquear a tela depois de (minutos sem uso)" ajuda="O caixa pede o PIN de novo. Recomendado: 5.">
              {(p) => <Entrada {...p} type="number" min={1} max={60} value={dados.bloqueioMinutos} onChange={(e) => mudar('bloqueioMinutos')(e.target.value)} />}
            </Campo>
            <Campo rotulo="Encerrar a sessão depois de (horas)" ajuda="Depois disso é preciso entrar de novo. Recomendado: 12 (um turno).">
              {(p) => <Entrada {...p} type="number" min={1} max={24} value={dados.sessaoHoras} onChange={(e) => mudar('sessaoHoras')(e.target.value)} />}
            </Campo>
          </div>
        </Cartao>
        <Cartao titulo="Mesas">
          <div className="pilha">
            <Campo rotulo="Taxa de serviço (%)" ajuda="Entra na conta das mesas, separada do consumo. É opcional para o cliente: o caixa pode tirar. Use 0 para não cobrar.">
              {(p) => <Entrada {...p} type="number" min={0} max={20} step={0.5} value={dados.servicoPercentual ?? 10} onChange={(e) => mudar('servicoPercentual')(e.target.value)} />}
            </Campo>
            <Campo rotulo="Avisar mesa sem pedido depois de (minutos)" ajuda="A mesa ganha contorno laranja no mapa: alguém precisa passar lá.">
              {(p) => <Entrada {...p} type="number" min={5} max={180} value={dados.alertaMesaMin ?? 20} onChange={(e) => mudar('alertaMesaMin')(e.target.value)} />}
            </Campo>
            <Alternador rotulo="Perguntar quantas pessoas ao abrir a mesa" ligado={dados.perguntarPessoas !== false} aoMudar={mudar('perguntarPessoas')} descricao="Serve para dividir a conta e para o gasto por pessoa nos relatórios." />
            <a className="link" href="#/admin/salao">
              Montar o salão desta filial
            </a>
          </div>
        </Cartao>
        <Cartao titulo="Cozinha">
          <Campo rotulo="Pedido fica vermelho depois de (minutos)" ajuda="Na tela da cozinha, o tempo muda de cor para chamar atenção.">
            {(p) => <Entrada {...p} type="number" min={1} max={60} value={dados.alertaCozinhaMin} onChange={(e) => mudar('alertaCozinhaMin')(e.target.value)} />}
          </Campo>
        </Cartao>
      </div>
    </Pagina>
  )
}
