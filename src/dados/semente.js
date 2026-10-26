// Dados iniciais do PDV. A estrutura copia o PDV Legal (grupo = tamanho,
// produto = sabor, códigos iguais aos de lá quando apareceram no vídeo) e os
// preços e fotos vêm do site da Sua Coxinha (src/lojas/cajamar/produtos.js).
// Tudo isto pode ser alterado depois pela retaguarda. Usuários e perfis não
// estão aqui: moram no servidor (ver src/firebase/pdv.js).

const foto = (caminho) => `/fotos/${caminho}.webp`

export const FILIAIS = [
  ['f-imigrantes', 'Imigrantes (Matriz)', 'Jundiaí – SP'],
  ['f-jundiai-ipe', 'Jundiaí Ipê', 'Jundiaí – SP'],
  ['f-vila-arens', 'Vila Arens', 'Jundiaí – SP'],
  ['f-fabrica', 'Fábrica', 'Jundiaí – SP'],
  ['f-campinas-pague-menos', 'Campinas Pague Menos', 'Campinas – SP'],
  ['f-campinas-enxuto', 'Campinas Enxuto', 'Campinas – SP'],
  ['f-max-ipanema', 'Max Ipanema', 'Sorocaba – SP'],
  ['f-max-morumbi', 'Max Morumbi', 'São Paulo – SP'],
  ['f-penha', 'Penha', 'São Paulo – SP'],
].map(([id, nome, cidade], i) => ({ id, nome, cidade, cnpj: '', endereco: '', telefone: '', ativo: true, ordem: i }))

const SABORES = {
  frango: ['Frango', 'frango'],
  catupiry: ['Frango com Catupiry', 'catupiry'],
  costela: ['Costela com requeijão', 'costela'],
  mussarela: ['Queijo mussarela', 'mussarela'],
  pizza: ['Pizza', 'pizza'],
  'carne-seca': ['Carne seca com queijo', 'carne-seca'],
  'cheddar-bacon': ['Frango, cheddar e bacon', 'cheddar-bacon'],
  caipira: ['Caipira', 'caipira'],
  'carne-moida': ['Carne moída', 'carne-moida'],
  brocolis: ['Brócolis', 'brocolis'],
  calabresa: ['Calabresa com queijo', null],
}

const DESCRICAO_SABOR = {
  frango: 'Frango tradicional desfiado e temperado.',
  catupiry: 'Frango com Catupiry®.',
  costela: 'Costela bovina desfiada com requeijão.',
  mussarela: 'Queijo mussarela.',
  pizza: 'Presunto, queijo e orégano.',
  'carne-seca': 'Carne seca com queijo.',
  'cheddar-bacon': 'Frango com cheddar e bacon.',
  caipira: 'Frango, milho, bacon e requeijão.',
  'carne-moida': 'Carne moída temperada.',
  brocolis: 'Brócolis com queijo.',
  calabresa: 'Calabresa com queijo.',
}

const GRUPOS = [
  ['g-coxinha-g', 'Coxinha G', 'coxinha-g', 'produtos/coxinha-g', '#F9C115'],
  ['g-coxinha-m', 'Coxinha M', 'coxinha-m', 'produtos/coxinha-m', '#F9C115'],
  ['g-gourmet', 'Coxinha Gourmet', 'gourmet', 'produtos/coxinha-gourmet', '#E0A50C'],
  ['g-copo', 'Copo Mágico', 'copo', 'produtos/copo-magico-salgado', '#FFEB4A'],
  ['g-churros', 'Churros', 'churros', 'produtos/churros-gourmet', '#C98A0A'],
  ['g-festa', 'Para festa', 'festa', 'produtos/caixa-gostosuras', '#E0A50C'],
  ['g-combos', 'Combos', 'combos', 'produtos/coxinha-combo', '#F9C115'],
  ['g-bebidas', 'Bebidas', 'bebidas', null, '#3A3A3A'],
  ['g-molhos', 'Molhos', 'molhos', 'molhos/moderado', '#8A5A06'],
  ['g-casa', 'Para casa', 'casa', 'produtos/congelados', '#462302'],
  ['g-insumos', 'Insumos', 'insumos', null, '#5C5C5C'],
].map(([id, nome, , imagem, cor], i) => ({
  id,
  codigo: String(480100 + i * 7),
  nome,
  imagem: imagem ? foto(imagem) : '',
  icone: id === 'g-bebidas' ? 'lata' : id === 'g-insumos' ? 'caixa' : '',
  cor,
  ordem: i,
  noCaixa: id !== 'g-insumos',
  ativo: true,
}))

const CLASSES = [
  ['c-mais-pedidos', 'Mais pedidos'],
  ['c-salgados', 'Salgados'],
  ['c-doces', 'Doces'],
  ['c-bebidas', 'Bebidas'],
  ['c-festa', 'Festa e encomenda'],
].map(([id, nome], i) => ({ id, nome, ordem: i, ativo: true }))

// ---------------------------------------------------------------------------
// Produtos

const CONFIG_PADRAO = {
  permiteDesconto: true,
  chamaQuantidade: false,
  pedePreco: false,
  maior18: false,
  favorito: false,
  controlaEstoque: true,
  setor: 'cozinha',
  autoatendimento: true,
}

let proximoCodigo = 140
function produto({ id, codigo, nome, grupoId, preco, imagem = '', classes = [], descricao = '', modificadores = [], composicao = [], tipo = 'venda', unidade = 'UN', config = {}, custo = 0 }) {
  return {
    id,
    codigo: String(codigo ?? proximoCodigo++),
    nome,
    grupoId,
    classes,
    tipo,
    unidade,
    ean: '',
    preco,
    custo,
    imagem,
    descricao,
    modoPreparo: '',
    gruposModificadores: modificadores,
    composicao,
    config: { ...CONFIG_PADRAO, ...config },
    ncm: '',
    cest: '',
    precos: {},
    pausado: {},
    ativo: true,
  }
}

const CODIGOS_G = { frango: 73, catupiry: 76, costela: 72, caipira: 69, 'cheddar-bacon': 79 }
const CODIGOS_M = { frango: 74, catupiry: 77, costela: 94, caipira: 87, 'cheddar-bacon': 80, brocolis: 95, calabresa: 90, 'carne-seca': 93 }

const SABORES_G = ['frango', 'catupiry', 'costela', 'mussarela', 'pizza', 'carne-seca', 'cheddar-bacon', 'caipira']
const SABORES_M = [...SABORES_G, 'carne-moida', 'brocolis', 'calabresa']

const coxinhas = [
  ...SABORES_G.map((s) =>
    produto({
      id: `p-g-${s}`,
      codigo: CODIGOS_G[s],
      nome: `${SABORES[s][0]} G`,
      grupoId: 'g-coxinha-g',
      preco: 1490,
      custo: 520,
      imagem: SABORES[s][1] ? foto(`sabores/${SABORES[s][1]}`) : foto('produtos/coxinha-g'),
      classes: s === 'frango' || s === 'catupiry' ? ['c-mais-pedidos', 'c-salgados'] : ['c-salgados'],
      descricao: `Coxinha grande de 250g. ${DESCRICAO_SABOR[s]}`,
      modificadores: ['m-cobertura-coxinha'],
      config: { favorito: s === 'frango' },
    }),
  ),
  ...SABORES_M.map((s) =>
    produto({
      id: `p-m-${s}`,
      codigo: CODIGOS_M[s],
      nome: `${SABORES[s][0]} M`,
      grupoId: 'g-coxinha-m',
      preco: 990,
      custo: 330,
      imagem: SABORES[s][1] ? foto(`sabores/${SABORES[s][1]}`) : foto('produtos/coxinha-m'),
      classes: s === 'frango' ? ['c-mais-pedidos', 'c-salgados'] : ['c-salgados'],
      descricao: `Coxinha média de 130g. ${DESCRICAO_SABOR[s]}`,
      modificadores: ['m-cobertura-coxinha'],
    }),
  ),
  produto({ id: 'p-gourmet-frango', codigo: 131, nome: 'Gourmet Frango (3 un)', grupoId: 'g-gourmet', preco: 250, imagem: foto('produtos/coxinha-gourmet'), classes: ['c-salgados'], descricao: '3 coxinhas de 40g de frango.' }),
  produto({ id: 'p-gourmet-costela', codigo: 3, nome: 'Gourmet Costela (3 un)', grupoId: 'g-gourmet', preco: 250, imagem: foto('produtos/coxinha-gourmet'), classes: ['c-salgados'], descricao: '3 coxinhas de 40g de costela.' }),
]

const copos = [
  produto({ id: 'p-copo-salgado', codigo: 4, nome: 'Copo Mágico Salgado', grupoId: 'g-copo', preco: 1890, custo: 640, imagem: foto('produtos/copo-magico-salgado'), classes: ['c-mais-pedidos', 'c-salgados'], descricao: '20 mini coxinhas de frango.', modificadores: ['m-cobertura-copo-salgado'], composicao: [{ produtoId: 'i-copo-300', qtd: 1 }] }),
  produto({ id: 'p-copo-doce', codigo: 6, nome: 'Copo Mágico Doce', grupoId: 'g-copo', preco: 1890, custo: 610, imagem: foto('produtos/copo-magico-doce'), classes: ['c-doces'], descricao: '12 mini churros recheados.', modificadores: ['m-recheio-copo-doce', 'm-cobertura-copo-doce'], composicao: [{ produtoId: 'i-copo-300', qtd: 1 }] }),
]

const churros = [
  produto({ id: 'p-churros-gourmet', codigo: 5, nome: 'Churros Gourmet', grupoId: 'g-churros', preco: 1290, custo: 380, imagem: foto('produtos/churros-gourmet'), classes: ['c-mais-pedidos', 'c-doces'], descricao: 'Você escolhe o recheio e o topping.', modificadores: ['m-recheio-churros', 'm-topping-churros', 'm-cobertura-churros'], composicao: [{ produtoId: 'i-caixa-churros', qtd: 1 }] }),
  ...[
    [16, 10, 1290, 'm-recheio-mini-1'],
    [17, 20, 2290, 'm-recheio-mini-2-20'],
    [18, 50, 4990, 'm-recheio-mini-2-50'],
    [19, 100, 8990, 'm-recheio-mini-2-100'],
  ].map(([codigo, un, preco, mod]) =>
    produto({ id: `p-mini-churros-${un}`, codigo, nome: `Mini Churros ${un} un`, grupoId: 'g-churros', preco, imagem: foto(un >= 50 ? 'produtos/mini-churros-coracao' : 'produtos/mini-churros'), classes: ['c-doces', ...(un >= 50 ? ['c-festa'] : [])], descricao: `${un} mini churros recheados.`, modificadores: [mod], config: { controlaEstoque: false } }),
  ),
]

const festa = [
  ...[
    [11, 10, 1290, 'm-festa-1-10'],
    [12, 20, 2290, 'm-festa-2-20'],
    [67, 50, 4990, 'm-festa-5-50'],
    [66, 100, 8990, 'm-festa-5-100'],
  ].map(([codigo, un, preco, mod]) =>
    produto({ id: `p-gostosuras-${un}`, codigo, nome: `Mini Gostosuras ${un} un`, grupoId: 'g-festa', preco, imagem: foto('produtos/caixa-gostosuras'), classes: un >= 50 ? ['c-festa', 'c-mais-pedidos'] : ['c-festa'], descricao: `Mini salgados da linha festa, de 17g cada.`, modificadores: [mod], composicao: [{ produtoId: un >= 50 ? 'i-caixa-sp57' : 'i-caixa-sp12', qtd: 1 }], config: { controlaEstoque: false } }),
  ),
  produto({ id: 'p-degust-100', codigo: 15, nome: 'Linha Degust 100 un', grupoId: 'g-festa', preco: 4990, imagem: foto('produtos/linha-degust'), classes: ['c-festa'], descricao: '100 mini coxinhas de frango, de 9g cada.' }),
]

const combos = [
  produto({ id: 'p-combo-pra-voce', codigo: 7, nome: 'Combo Pra Você', grupoId: 'g-combos', preco: 2090, imagem: foto('produtos/coxinha-combo'), classes: ['c-mais-pedidos'], descricao: '1 coxinha G e 1 Coca-Cola lata 350ml.', modificadores: ['m-combo-sabor-1'], composicao: [{ produtoId: 'p-coca-lata', qtd: 1 }], config: { controlaEstoque: false } }),
  produto({ id: 'p-combo-dupla-fome', codigo: 8, nome: 'Combo Dupla Fome', grupoId: 'g-combos', preco: 3890, imagem: foto('produtos/combo-dupla-fome'), descricao: '2 coxinhas G e 1 Coca-Cola 600ml.', modificadores: ['m-combo-sabor-2'], composicao: [{ produtoId: 'p-coca-600', qtd: 1 }], config: { controlaEstoque: false } }),
  produto({ id: 'p-combo-casal', codigo: 10, nome: 'Combo Casal', grupoId: 'g-combos', preco: 4480, imagem: foto('produtos/combo-casal'), descricao: '30 salgados PP (3 sabores), 8 mini churros e 1 Coca-Cola 600ml.', modificadores: ['m-festa-3-30'], composicao: [{ produtoId: 'p-coca-600', qtd: 1 }], config: { controlaEstoque: false } }),
  produto({ id: 'p-combo-mata-fome', codigo: 9, nome: 'Combo Mata Fome', grupoId: 'g-combos', preco: 5990, imagem: foto('produtos/cesta-mini-coxinhas'), descricao: '50 salgados PP (até 5 sabores) e 2 refrigerantes lata.', modificadores: ['m-mata-fome', 'm-refri-combo'], config: { controlaEstoque: false } }),
]

const bebida = (id, codigo, nome, preco, extra = {}) =>
  produto({ id, codigo, nome, grupoId: 'g-bebidas', preco, classes: ['c-bebidas'], config: { setor: 'balcao', ...extra }, custo: Math.round(preco * 0.42) })

const bebidas = [
  bebida('p-coca-lata', 36, 'Coca-Cola lata', 790, { favorito: true }),
  bebida('p-coca-zero-lata', 35, 'Coca-Cola Zero lata', 790),
  bebida('p-fanta-laranja', 32, 'Fanta Laranja lata', 790),
  bebida('p-fanta-uva', 31, 'Fanta Uva lata', 790),
  bebida('p-coca-200', null, 'Coca-Cola 200ml', 490),
  bebida('p-coca-600', 40, 'Coca-Cola 600ml', 1190),
  bebida('p-coca-zero-600', 41, 'Coca-Cola Zero 600ml', 1190),
  bebida('p-coca-2l', 27, 'Coca-Cola 2L', 1750),
  bebida('p-del-valle-uva', 37, 'Del Valle Uva lata', 1000),
  bebida('p-del-valle-pessego', 39, 'Del Valle Pêssego lata', 1000),
  bebida('p-del-valle-laranja', 38, 'Del Valle Laranja lata', 1000),
  bebida('p-agua', 21, 'Água sem gás', 500),
  bebida('p-agua-gas', 22, 'Água com gás', 500),
  bebida('p-h2o', 42, 'H2O!', 1000),
  bebida('p-energetico', 114, 'Energético lata', 1190),
  bebida('p-cerveja', 28, 'Cerveja lata', 700, { maior18: true }),
  bebida('p-cafe', 47, 'Café coado', 300, { controlaEstoque: false }),
  bebida('p-cafe-leite', 48, 'Café com leite', 600, { controlaEstoque: false }),
]

const molhos = [
  ['p-molho-moderado', null, 'Molho Cremoso Moderado', 'moderado'],
  ['p-molho-suave', null, 'Molho Cremoso Suave', 'suave'],
  ['p-molho-goiabinha', null, 'Pimenta Agridoce Goiabinha', 'goiabinha'],
  ['p-molho-alho', 132, 'Molho de Alho Picante', 'alho'],
].map(([id, codigo, nome, f]) => produto({ id, codigo, nome, grupoId: 'g-molhos', preco: 1990, imagem: foto(`molhos/${f}`), descricao: 'Garrafa de 250g.', config: { setor: 'balcao' } }))

const casa = [
  produto({ id: 'p-congelados', nome: 'Mini Coxinhas Congeladas 500g', grupoId: 'g-casa', preco: 2990, imagem: foto('produtos/congelados'), classes: ['c-festa'], descricao: '500g de mini coxinhas de frango. É só aquecer no forno ou na airfryer.', config: { setor: 'balcao' } }),
]

const insumo = (id, codigo, nome, custo = 0) => produto({ id, codigo, nome, grupoId: 'g-insumos', preco: 0, tipo: 'insumo', custo, config: { autoatendimento: false, permiteDesconto: false } })

const insumos = [
  insumo('i-pp-frango', 75, 'Frango PP'),
  insumo('i-pp-calabresa', 91, 'Calabresa com queijo PP'),
  insumo('i-pp-costela', 122, 'Costela bovina PP'),
  insumo('i-pp-mussarela', null, 'Queijo mussarela PP'),
  insumo('i-pp-pizza', null, 'Pizza PP'),
  insumo('i-pp-carne-seca', 99, 'Carne seca com queijo PP'),
  insumo('i-pp-cheddar-bacon', 120, 'Frango, cheddar e bacon PP'),
  insumo('i-pp-carne-moida', 121, 'Carne moída PP'),
  insumo('i-pp-brocolis', 119, 'Brócolis PP'),
  insumo('i-pp-palmito', null, 'Palmito PP'),
  insumo('i-enroladinho', 98, 'Enroladinho de salsicha'),
  insumo('i-mini-kibe', null, 'Mini kibe'),
  insumo('i-mini-churros-dl', null, 'Mini churros doce de leite'),
  insumo('i-mini-churros-choc', null, 'Mini churros chocolate'),
  insumo('i-caixa-sp12', 56, 'Caixa SP12', 90),
  insumo('i-caixa-sp57', 58, 'Caixa SP57', 210),
  insumo('i-caixa-churros', 62, 'Caixa churros SPC01', 60),
  insumo('i-copo-300', 64, 'Copo personalizado 300ml', 75),
  insumo('i-embalagem-g202', 60, 'Embalagem G202', 40),
]

// ---------------------------------------------------------------------------
// Modificadores. "observacao" não muda o preço; "adicional" soma o preço da opção.
// rateio: quantas unidades do produto se dividem entre os sabores escolhidos, para
// a baixa de estoque (ex.: caixa de 50 com 2 sabores = 25 de cada).

const opcao = (id, nome, preco = 0, insumoId = null, qtd = 1) => ({ id, nome, preco, insumoId, qtd, ativo: true })

const SABORES_FESTA = [
  ['frango', 'Frango', 'i-pp-frango'],
  ['cheddar-bacon', 'Frango, cheddar e bacon', 'i-pp-cheddar-bacon'],
  ['costela', 'Costela bovina', 'i-pp-costela'],
  ['calabresa', 'Calabresa com queijo', 'i-pp-calabresa'],
  ['carne-moida', 'Carne moída', 'i-pp-carne-moida'],
  ['enroladinho', 'Enroladinho de salsicha', 'i-enroladinho'],
  ['kibe', 'Mini kibe', 'i-mini-kibe'],
  ['pizza', 'Pizza', 'i-pp-pizza'],
  ['mussarela', 'Queijo mussarela', 'i-pp-mussarela'],
  ['brocolis', 'Brócolis', 'i-pp-brocolis'],
]
const SABORES_MATA_FOME = [
  ['frango', 'Frango', 'i-pp-frango'],
  ['calabresa', 'Calabresa com queijo', 'i-pp-calabresa'],
  ['costela', 'Costela bovina', 'i-pp-costela'],
  ['mussarela', 'Queijo mussarela', 'i-pp-mussarela'],
  ['pizza', 'Pizza', 'i-pp-pizza'],
  ['carne-seca', 'Carne seca com queijo', 'i-pp-carne-seca'],
  ['cheddar-bacon', 'Frango, cheddar e bacon', 'i-pp-cheddar-bacon'],
  ['carne-moida', 'Carne moída', 'i-pp-carne-moida'],
  ['brocolis', 'Brócolis', 'i-pp-brocolis'],
  ['palmito', 'Palmito', 'i-pp-palmito'],
]
const SABORES_COMBO = ['frango', 'catupiry', 'costela', 'caipira', 'mussarela', 'pizza']

const festaGrupo = (id, nome, max, rateio, lista = SABORES_FESTA) => ({
  id,
  nome,
  tipo: 'observacao',
  min: 1,
  max,
  rateio,
  opcoes: lista.map(([s, n, ins]) => opcao(`${id}-${s}`, n, 0, ins)),
})

const RECHEIOS_MINI = [
  ['dl', 'Doce de leite', 'i-mini-churros-dl'],
  ['choc', 'Chocolate', 'i-mini-churros-choc'],
]

const GRUPOS_MODIFICADORES = [
  { id: 'm-cobertura-coxinha', nome: 'Cobertura extra', tipo: 'adicional', min: 0, max: 2, rateio: 0, opcoes: [opcao('cob-cheddar', 'Cheddar', 500), opcao('cob-requeijao', 'Requeijão', 500)] },
  { id: 'm-cobertura-copo-salgado', nome: 'Cobertura do copo', tipo: 'observacao', min: 0, max: 1, rateio: 0, opcoes: [opcao('cs-cheddar', 'Cheddar'), opcao('cs-requeijao', 'Requeijão')] },
  { id: 'm-recheio-copo-doce', nome: 'Recheio dos mini churros', tipo: 'observacao', min: 1, max: 1, rateio: 0, opcoes: [opcao('cd-dl', 'Doce de leite'), opcao('cd-choc', 'Chocolate')] },
  { id: 'm-cobertura-copo-doce', nome: 'Cobertura do copo', tipo: 'observacao', min: 0, max: 1, rateio: 0, opcoes: [opcao('cdc-dl', 'Doce de leite'), opcao('cdc-avela', 'Creme de avelã')] },
  { id: 'm-recheio-churros', nome: 'Recheio', tipo: 'observacao', min: 1, max: 1, rateio: 0, opcoes: [opcao('rc-dl', 'Doce de leite'), opcao('rc-choc', 'Chocolate')] },
  { id: 'm-topping-churros', nome: 'Topping', tipo: 'observacao', min: 1, max: 1, rateio: 0, opcoes: [opcao('tp-confete', 'Confete colorido'), opcao('tp-gran-choc', 'Granulado de chocolate'), opcao('tp-gran-color', 'Granulado colorido'), opcao('tp-amendoim', 'Amendoim')] },
  { id: 'm-cobertura-churros', nome: 'Cobertura extra', tipo: 'adicional', min: 0, max: 2, rateio: 0, opcoes: [opcao('cc-dl', 'Doce de leite', 500), opcao('cc-avela', 'Creme de avelã', 500)] },
  { id: 'm-recheio-mini-1', nome: 'Recheio', tipo: 'observacao', min: 1, max: 1, rateio: 10, opcoes: RECHEIOS_MINI.map(([s, n, ins]) => opcao(`rm1-${s}`, n, 0, ins)) },
  ...[20, 50, 100].map((un) => ({ id: `m-recheio-mini-2-${un}`, nome: 'Recheios (até 2)', tipo: 'observacao', min: 1, max: 2, rateio: un, opcoes: RECHEIOS_MINI.map(([s, n, ins]) => opcao(`rm${un}-${s}`, n, 0, ins)) })),
  festaGrupo('m-festa-1-10', 'Sabor (1)', 1, 10),
  festaGrupo('m-festa-2-20', 'Sabores (até 2)', 2, 20),
  festaGrupo('m-festa-5-50', 'Sabores (até 5)', 5, 50),
  festaGrupo('m-festa-5-100', 'Sabores (até 5)', 5, 100),
  festaGrupo('m-festa-3-30', 'Sabores dos salgados (até 3)', 3, 30),
  festaGrupo('m-mata-fome', 'Sabores dos salgados (até 5)', 5, 50, SABORES_MATA_FOME),
  { id: 'm-combo-sabor-1', nome: 'Sabor da coxinha', tipo: 'observacao', min: 1, max: 1, rateio: 1, opcoes: SABORES_COMBO.map((s) => opcao(`cs1-${s}`, SABORES[s][0], 0, `p-g-${s}`)) },
  { id: 'm-combo-sabor-2', nome: 'Sabores das coxinhas (até 2)', tipo: 'observacao', min: 1, max: 2, rateio: 2, opcoes: SABORES_COMBO.map((s) => opcao(`cs2-${s}`, SABORES[s][0], 0, `p-g-${s}`)) },
  { id: 'm-refri-combo', nome: 'Refrigerantes (2 latas)', tipo: 'observacao', min: 1, max: 2, rateio: 2, opcoes: [opcao('rf-coca', 'Coca-Cola', 0, 'p-coca-lata'), opcao('rf-coca-zero', 'Coca-Cola Zero', 0, 'p-coca-zero-lata'), opcao('rf-fanta-laranja', 'Fanta Laranja', 0, 'p-fanta-laranja'), opcao('rf-fanta-uva', 'Fanta Uva', 0, 'p-fanta-uva')] },
]

// ---------------------------------------------------------------------------

const FORMAS_PAGAMENTO = [
  ['fp-dinheiro', 'Dinheiro', 'dinheiro', true],
  ['fp-pix', 'Pix', 'pix', false],
  ['fp-debito', 'Débito', 'debito', false],
  ['fp-credito', 'Crédito', 'credito', false],
  ['fp-vale', 'Vale-refeição', 'voucher', false],
].map(([id, nome, tipo, troco], i) => ({ id, nome, tipo, troco, taxa: tipo === 'credito' ? 3.2 : tipo === 'debito' ? 1.4 : tipo === 'voucher' ? 5 : 0, ordem: i, ativo: true }))

const MOTIVOS = ['Cliente desistiu', 'Lançado errado', 'Produto em falta', 'Demora no preparo', 'Problema no pagamento'].map((nome, i) => ({ id: `mc-${i + 1}`, nome, ativo: true }))

const TIPOS_DESCONTO = [
  ['td-funcionario', 'Funcionário', 20, false],
  ['td-fiel', 'Cliente fiel', 10, false],
  ['td-livre', 'Desconto no balcão', 10, false],
  ['td-reclamacao', 'Reclamação do cliente', 100, true],
  ['td-cortesia', 'Cortesia', 100, true],
].map(([id, nome, maxPercentual, exigeAutorizacao]) => ({ id, nome, maxPercentual, exigeAutorizacao, ativo: true }))

export const PLANO_DE_CONTAS = {
  receber: ['Vendas no balcão', 'Vendas iFood e 99Food', 'Encomendas', 'Outras receitas'],
  pagar: ['Mercadoria (fábrica)', 'Bebidas', 'Embalagens', 'Aluguel', 'Energia e água', 'Folha de pagamento', 'Royalties e fundo de marketing', 'Taxas de cartão', 'Manutenção', 'Impostos', 'Outras despesas'],
}

export function criarSemente() {
  const pontosVenda = FILIAIS.flatMap((f) => {
    const lista = [{ id: `pdv-${f.id}-1`, nome: 'Caixa 1', filialId: f.id, ativo: true }]
    if (f.id === 'f-max-morumbi' || f.id === 'f-imigrantes') lista.push({ id: `pdv-${f.id}-2`, nome: 'Caixa 2', filialId: f.id, ativo: true })
    return lista
  })

  return {
    filiais: FILIAIS,
    pontosVenda,
    grupos: GRUPOS,
    classes: CLASSES,
    produtos: [...coxinhas, ...copos, ...churros, ...festa, ...combos, ...bebidas, ...molhos, ...casa, ...insumos],
    gruposModificadores: GRUPOS_MODIFICADORES,
    formasPagamento: FORMAS_PAGAMENTO,
    motivosCancelamento: MOTIVOS,
    tiposDesconto: TIPOS_DESCONTO,
    promocoes: [
      {
        id: 'promo-terca-churros',
        nome: 'Terça do churros',
        tipo: 'percentual',
        valor: 15,
        produtos: [],
        grupos: ['g-churros'],
        dias: [2],
        horaInicio: '14:00',
        horaFim: '18:00',
        inicio: '',
        fim: '',
        filiais: [],
        ativo: true,
      },
    ],
    fornecedores: [
      { id: 'forn-fabrica', razaoSocial: 'Fábrica Sua Coxinha', fantasia: 'Fábrica', cnpj: '', telefone: '', email: '', ativo: true },
      { id: 'forn-bebidas', razaoSocial: 'Distribuidora de bebidas (exemplo)', fantasia: 'Bebidas', cnpj: '', telefone: '', email: '', ativo: true },
    ],
    clientes: [],
    caixas: [],
    vendas: [],
    movimentosEstoque: [],
    contas: [],
    comunicados: [],
    auditoria: [],
    saldos: {},
    sequencias: {},
  }
}

export const CONFIG_INICIAL = {
  empresa: 'Sua Coxinha',
  mensagemCupom: 'Obrigado pela preferência! Siga @suacoxinhaoficial',
  bloqueioMinutos: 5,
  sessaoHoras: 12,
  pedirCpf: true,
  imprimirComandaAuto: true,
  tipoPedidoPadrao: 'balcao',
  alertaCozinhaMin: 8,
  // Mesas: taxa de serviço (0 = não cobra), aviso de mesa sem pedido e se o
  // caixa pergunta quantas pessoas sentaram
  servicoPercentual: 10,
  alertaMesaMin: 20,
  perguntarPessoas: true,
  planoContas: PLANO_DE_CONTAS,
}
