// Primeiro acesso: grava o cardápio e os cadastros iniciais, cria o
// administrador e, se pedido, os dados de demonstração.

import { banco } from './banco.js'
import { registrar } from './auditoria.js'
import { criarSemente, CONFIG_INICIAL } from './semente.js'
import { gerarHistorico, saldosIniciais, contasDoMes } from './demonstracao.js'
import { salvarUsuario } from './usuarios.js'
import { PERMISSOES_NOVAS } from './permissoes.js'
import { aplicarModelo, mesasDoSalao } from './salao.js'

export const sistemaConfigurado = (config) => Boolean(config?.configuradoEm)

// Usuários de teste com PIN conhecido. A retaguarda mostra um aviso enquanto
// eles estiverem ativos.
export const USUARIOS_DEMO = [
  { nome: 'Ana Souza', login: 'ana', perfilId: 'perfil-atendente', filiais: ['f-max-morumbi'], pin: '4821' },
  { nome: 'Bruno Lima', login: 'bruno', perfilId: 'perfil-gerente', filiais: ['f-max-morumbi'], pin: '7392', senha: 'gerente2026' },
  { nome: 'Cozinha Morumbi', login: 'cozinha.morumbi', perfilId: 'perfil-cozinha', filiais: ['f-max-morumbi'], pin: '5170' },
]

export async function configurarSistema({ empresa, admin, demonstracao }) {
  banco.apagarTudo()
  const semente = criarSemente()
  for (const [nome, valor] of Object.entries(semente)) banco.substituir(nome, valor)

  const administrador = await salvarUsuario({ ...admin, perfilId: 'perfil-admin', todasFiliais: true, ativo: true })
  banco.atualizar('usuarios', administrador.id, { dono: true })

  if (demonstracao) {
    // A loja da demonstração já vem com o salão montado, para ver as mesas no caixa
    const salao = aplicarModelo('salao-varanda', 'f-max-morumbi')
    banco.substituir('ambientes', salao)
    const demos = []
    for (const d of USUARIOS_DEMO) {
      const u = await salvarUsuario({ ...d, todasFiliais: false, ativo: true })
      banco.atualizar('usuarios', u.id, { demonstracao: true })
      demos.push(u)
    }
    const operadores = [...demos.filter((u) => u.perfilId !== 'perfil-cozinha')]
    // Atendentes fictícios das outras lojas, só como nome nas vendas antigas
    const outros = semente.filiais
      .filter((f) => f.id !== 'f-max-morumbi')
      .map((f, i) => ({ id: `demo-op-${i}`, nome: ['Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Hugo', 'Iara', 'João'][i % 8], filiais: [f.id] }))
    banco.substituir(
      'vendas',
      gerarHistorico({
        produtos: semente.produtos,
        gruposModificadores: semente.gruposModificadores,
        filiais: semente.filiais,
        formas: semente.formasPagamento,
        operadores: [...operadores, ...outros],
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
        autorNome: administrador.nome,
        filiais: [],
        lidos: {},
        demonstracao: true,
      },
    ])
  }

  // configuradoEm só é gravado quando a pessoa confirma na última tela
  // (concluirConfiguracao); até lá o PDV continua no primeiro acesso.
  banco.substituir('config', { ...CONFIG_INICIAL, empresa: empresa || CONFIG_INICIAL.empresa, demonstracao: Boolean(demonstracao) })
  await registrar('sistema.configurado', demonstracao ? 'Com dados de demonstração' : 'Sem dados de demonstração', { usuario: administrador })
  return administrador
}

export function concluirConfiguracao() {
  banco.alterarDoc('config', { configuradoEm: new Date().toISOString() })
}

// Roda a cada abertura, antes da primeira tela: leva para os dados que já
// estavam no navegador o que as versões novas do PDV precisam. Cada passo
// roda uma vez só.
export function atualizarDados() {
  const config = banco.doc('config')
  if (!sistemaConfigurado(config)) return
  const feitas = config.permissoesAplicadas || []
  const pendentes = PERMISSOES_NOVAS.filter((n) => !feitas.includes(n.chave))
  if (!pendentes.length) return
  for (const n of pendentes)
    for (const id of n.perfis) {
      const perfil = banco.obter('perfis', id)
      if (perfil && !perfil.permissoes.includes(n.chave)) banco.atualizar('perfis', id, { permissoes: [...perfil.permissoes, n.chave] })
    }
  banco.alterarDoc('config', { permissoesAplicadas: [...feitas, ...pendentes.map((n) => n.chave)] })
}
