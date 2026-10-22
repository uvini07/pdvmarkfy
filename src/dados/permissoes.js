// Permissões do PDV. Cada perfil (Administrador, Gerente, Atendente, Cozinha…)
// é uma lista destas chaves. As telas escondem o que o usuário não pode fazer, e
// as ações sensíveis conferem de novo na hora — ou pedem a autorização de um
// supervisor (PIN de quem tem a permissão).

export const PERMISSOES = [
  {
    grupo: 'Caixa',
    itens: [
      ['caixa.vender', 'Registrar pedidos'],
      ['caixa.abrir', 'Abrir o caixa'],
      ['caixa.fechar', 'Fechar o caixa'],
      ['caixa.sangria', 'Fazer sangria e suprimento'],
      ['caixa.desconto', 'Dar desconto dentro do limite do tipo'],
      ['caixa.descontoLivre', 'Dar desconto acima do limite e autorizar descontos'],
      ['caixa.cancelarItem', 'Tirar item de um pedido em andamento'],
      ['caixa.cancelarVenda', 'Cancelar venda já cobrada'],
      ['caixa.estornar', 'Estornar venda de caixa já fechado'],
      ['caixa.reimprimir', 'Reimprimir cupom e comanda'],
      ['caixa.pausarProduto', 'Marcar produto como esgotado'],
    ],
  },
  {
    grupo: 'Cozinha',
    itens: [['cozinha.ver', 'Ver e atualizar a tela da cozinha']],
  },
  {
    grupo: 'Retaguarda',
    itens: [
      ['admin.dashboard', 'Ver o painel de vendas'],
      ['admin.cardapio', 'Editar produtos, grupos e modificadores'],
      ['admin.precos', 'Alterar preços e promoções'],
      ['admin.estoque', 'Movimentar o estoque'],
      ['admin.financeiro', 'Financeiro e conferência de caixa'],
      ['admin.relatorios', 'Ver e exportar relatórios'],
      ['admin.pessoas', 'Clientes e fornecedores'],
      ['admin.usuarios', 'Usuários e perfis de acesso'],
      ['admin.config', 'Filiais, formas de pagamento e configurações'],
      ['admin.comunicados', 'Publicar comunicados para as lojas'],
      ['admin.auditoria', 'Ver o registro de segurança'],
      ['admin.backup', 'Exportar e restaurar os dados'],
    ],
  },
  {
    grupo: 'Dados pessoais',
    itens: [['dados.cpfCompleto', 'Ver o CPF completo dos clientes']],
  },
]

export const TODAS = PERMISSOES.flatMap((g) => g.itens.map(([chave]) => chave))

export const rotuloPermissao = (chave) => PERMISSOES.flatMap((g) => g.itens).find(([c]) => c === chave)?.[1] || chave

const CAIXA_BASICO = ['caixa.vender', 'caixa.abrir', 'caixa.fechar', 'caixa.cancelarItem', 'caixa.reimprimir', 'caixa.pausarProduto', 'caixa.desconto', 'cozinha.ver']

export const PERFIS_PADRAO = [
  { id: 'perfil-admin', nome: 'Administrador', descricao: 'Franqueadora. Acesso total, em todas as filiais.', permissoes: TODAS, sistema: true },
  {
    id: 'perfil-gerente',
    nome: 'Gerente',
    descricao: 'Franqueado ou gerente de loja. Caixa, cardápio, estoque e financeiro da própria filial.',
    permissoes: [
      ...CAIXA_BASICO,
      'caixa.sangria',
      'caixa.descontoLivre',
      'caixa.cancelarVenda',
      'caixa.estornar',
      'admin.dashboard',
      'admin.cardapio',
      'admin.precos',
      'admin.estoque',
      'admin.financeiro',
      'admin.relatorios',
      'admin.pessoas',
      'dados.cpfCompleto',
    ],
  },
  { id: 'perfil-atendente', nome: 'Atendente', descricao: 'Opera o caixa da loja.', permissoes: CAIXA_BASICO },
  { id: 'perfil-cozinha', nome: 'Cozinha', descricao: 'Só a tela da cozinha.', permissoes: ['cozinha.ver'] },
]

export function permissoesDe(usuario, perfis) {
  if (!usuario) return []
  const perfil = perfis.find((p) => p.id === usuario.perfilId)
  return perfil?.permissoes || []
}

export function pode(usuario, perfis, permissao) {
  if (!usuario || !usuario.ativo) return false
  return permissoesDe(usuario, perfis).includes(permissao)
}

export function acessaFilial(usuario, filialId) {
  if (!usuario) return false
  return usuario.todasFiliais || (usuario.filiais || []).includes(filialId)
}
