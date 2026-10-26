// Primeiro acesso de um computador: grava o cardápio e os cadastros iniciais
// e, se pedido, os dados de demonstração.
//
// Usuários e perfis não nascem aqui: moram no servidor. O administrador da
// rede é criado lá no primeiro login dele com o Google, e os outros ele
// cadastra em Retaguarda › Usuários. Não há mais usuário de demonstração com
// PIN conhecido.

import { banco } from './banco.js'
import { registrar } from './auditoria.js'
import { criarSemente, CONFIG_INICIAL } from './semente.js'
import { gerarHistorico, saldosIniciais, contasDoMes } from './demonstracao.js'
import { aplicarModelo, mesasDoSalao } from './salao.js'

export const sistemaConfigurado = (config) => Boolean(config?.configuradoEm)

// Atendentes fictícios: só nomes nas vendas de exemplo, sem acesso a nada.
const NOMES_DEMO = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Hugo', 'Iara', 'João']

export async function configurarSistema({ empresa, demonstracao, usuario }) {
  banco.apagarTudo()
  const semente = criarSemente()
  for (const [nome, valor] of Object.entries(semente)) banco.substituir(nome, valor)

  if (demonstracao) {
    // A loja da demonstração já vem com o salão montado, para ver as mesas no caixa
    const salao = aplicarModelo('salao-varanda', 'f-max-morumbi')
    banco.substituir('ambientes', salao)
    const operadores = semente.filiais.map((f, i) => ({ id: `demo-op-${i}`, nome: NOMES_DEMO[i % NOMES_DEMO.length], filiais: [f.id] }))
    banco.substituir(
      'vendas',
      gerarHistorico({
        produtos: semente.produtos,
        gruposModificadores: semente.gruposModificadores,
        filiais: semente.filiais,
        formas: semente.formasPagamento,
        operadores,
        mesas: { 'f-max-morumbi': mesasDoSalao(salao, 'f-max-morumbi') },
      }),
    )
    banco.substituir('saldos', saldosIniciais(semente.produtos, semente.filiais))
    banco.substituir('contas', contasDoMes(semente.filiais))
    banco.substituir('comunicados', [
      {
        id: 'demo-comunicado',
        criadoEm: new Date().toISOString(),
        titulo: 'Novo sabor chegando',
        texto: 'A partir da semana que vem a Coxinha M de calabresa com queijo entra no cardápio de todas as lojas. Confiram o estoque com a fábrica.',
        autorNome: usuario?.nome || 'Sua Coxinha',
        filiais: [],
        lidos: {},
        demonstracao: true,
      },
    ])
  }

  // configuradoEm só é gravado quando a pessoa confirma na última tela
  // (concluirConfiguracao); até lá o PDV continua no primeiro acesso.
  banco.substituir('config', { ...CONFIG_INICIAL, empresa: empresa || CONFIG_INICIAL.empresa, demonstracao: Boolean(demonstracao) })
  await registrar('sistema.configurado', demonstracao ? 'Com dados de demonstração' : 'Sem dados de demonstração', { usuario })
}

export function concluirConfiguracao() {
  banco.alterarDoc('config', { configuradoEm: new Date().toISOString() })
}
