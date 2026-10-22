// Testes das regras que mexem com dinheiro, estoque e segurança.
// Rodar: npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reais, paraCentavos, deDigitos, porcentagem } from '../src/lib/dinheiro.js'
import { cpfValido, cnpjValido, mascararCpf, textoLimpo, formatarCpf } from '../src/lib/validacao.js'
import { problemaNoPin, problemaNaSenha, tempoDeBloqueio, criarCredencial, conferirCredencial } from '../src/lib/seguranca.js'
import { gerarCsv } from '../src/lib/arquivos.js'
import { totaisPedido, totalItem } from '../src/dados/vendas.js'
import { consumoDaVenda } from '../src/dados/estoque.js'
import { promocaoValida, melhorPromocao } from '../src/dados/precos.js'
import { resumoCaixa } from '../src/dados/caixa.js'
import { resumo } from '../src/dados/relatorios.js'
import { criarSemente } from '../src/dados/semente.js'
import { pode, PERFIS_PADRAO } from '../src/dados/permissoes.js'

test('dinheiro em centavos, sem erro de arredondamento', () => {
  assert.equal(reais(1490), 'R$ 14,90')
  assert.equal(reais(123456), 'R$ 1.234,56')
  assert.equal(paraCentavos('1.234,56'), 123456)
  assert.equal(paraCentavos('9,90'), 990)
  assert.equal(paraCentavos('abc'), 0)
  assert.equal(deDigitos('R$ 12,90'), 1290)
  assert.equal(porcentagem(1990, 15), 299)
  // 0,1 + 0,2 em centavos dá certo
  assert.equal(10 + 20, 30)
})

test('totais do pedido com adicional, promoção e desconto', () => {
  const coxinha = { uid: 'a', produtoId: 'p-g-frango', nome: 'Frango G', qtd: 2, precoUnit: 1490, modificadores: [{ nome: 'Cheddar', preco: 500, qtd: 1 }], promocao: null, desconto: null }
  const churros = { uid: 'b', produtoId: 'p-churros-gourmet', nome: 'Churros', qtd: 1, precoUnit: 1290, modificadores: [], promocao: { nome: 'Terça', desconto: 194 }, desconto: null }
  assert.equal(totalItem(coxinha), 3980)
  assert.equal(totalItem(churros), 1096)
  const t = totaisPedido({ itens: [coxinha, churros], descontoPedido: { percentual: 10 } })
  assert.equal(t.bruto, 3980 + 1290)
  assert.equal(t.promocoes, 194)
  assert.equal(t.descontoPedido, Math.round((3980 + 1096) * 0.1))
  assert.equal(t.total, 3980 + 1096 - 508)
  assert.equal(t.quantidade, 3)
  // Desconto nunca deixa o total negativo
  const cortesia = totaisPedido({ itens: [coxinha], descontoPedido: { valor: 999999 } })
  assert.equal(cortesia.total, 0)
})

test('caixa de 50 com 2 sabores baixa 25 de cada insumo, mais a embalagem', () => {
  const s = criarSemente()
  const venda = {
    itens: [
      {
        produtoId: 'p-gostosuras-50',
        qtd: 1,
        modificadores: [
          { grupoId: 'm-festa-5-50', opcaoId: 'm-festa-5-50-frango', qtd: 1 },
          { grupoId: 'm-festa-5-50', opcaoId: 'm-festa-5-50-costela', qtd: 1 },
        ],
      },
      { produtoId: 'p-g-frango', qtd: 2, modificadores: [] },
    ],
  }
  const consumo = Object.fromEntries(consumoDaVenda(venda, s.produtos, s.gruposModificadores).map((c) => [c.produtoId, c.qtd]))
  assert.equal(consumo['i-pp-frango'], 25)
  assert.equal(consumo['i-pp-costela'], 25)
  assert.equal(consumo['i-caixa-sp57'], 1)
  assert.equal(consumo['p-g-frango'], 2)
})

test('promoção só vale no dia, hora e filial certos', () => {
  const promo = { ativo: true, tipo: 'percentual', valor: 15, grupos: ['g-churros'], produtos: [], dias: [2], horaInicio: '14:00', horaFim: '18:00', filiais: ['f-penha'] }
  const terca15h = new Date(2026, 9, 20, 15, 0)
  const terca19h = new Date(2026, 9, 20, 19, 0)
  const quarta15h = new Date(2026, 9, 21, 15, 0)
  assert.equal(promocaoValida(promo, 'f-penha', terca15h), true)
  assert.equal(promocaoValida(promo, 'f-penha', terca19h), false)
  assert.equal(promocaoValida(promo, 'f-penha', quarta15h), false)
  assert.equal(promocaoValida(promo, 'f-max-morumbi', terca15h), false)
  const churros = { id: 'x', grupoId: 'g-churros', config: { permiteDesconto: true } }
  assert.equal(melhorPromocao(churros, [promo], 'f-penha', 1290, terca15h).desconto, 194)
  assert.equal(melhorPromocao({ ...churros, config: { permiteDesconto: false } }, [promo], 'f-penha', 1290, terca15h), null)
})

test('fechamento de caixa: esperado em dinheiro = fundo + vendas + suprimentos − sangrias − troco', () => {
  const formas = [
    { id: 'din', tipo: 'dinheiro' },
    { id: 'pix', tipo: 'pix' },
  ]
  const caixa = { id: 'c1', fundo: 15000, movimentos: [{ tipo: 'sangria', valor: 5000 }, { tipo: 'suprimento', valor: 1000 }] }
  const vendas = [
    { caixaId: 'c1', status: 'concluida', total: 2090, pagamentos: [{ formaId: 'din', valor: 5000, troco: 2910 }] },
    { caixaId: 'c1', status: 'concluida', total: 1490, pagamentos: [{ formaId: 'pix', valor: 1490 }] },
    { caixaId: 'c1', status: 'cancelada', total: 990, pagamentos: [{ formaId: 'din', valor: 990 }] },
  ]
  const r = resumoCaixa(caixa, vendas, formas)
  assert.equal(r.esperado.din, 15000 + 2090 + 1000 - 5000)
  assert.equal(r.esperado.pix, 1490)
  assert.equal(r.vendido, 3580)
  assert.equal(r.canceladas, 1)
})

test('resumo do painel: ticket médio e cancelamentos', () => {
  const r = resumo([
    { status: 'concluida', total: 3000, itens: [{ qtd: 2 }], itensCancelados: [{ total: 500 }] },
    { status: 'concluida', total: 1000, itens: [{ qtd: 1 }] },
    { status: 'cancelada', total: 700, itens: [{ qtd: 1 }] },
    { status: 'estornada', total: 900, itens: [{ qtd: 1 }] },
  ])
  assert.equal(r.total, 4000)
  assert.equal(r.ticket, 2000)
  assert.equal(r.cancelado, 1200)
  assert.equal(r.vendasComCancelamento, 2)
  assert.equal(r.estornado, 900)
})

test('CPF e CNPJ: validação e máscara de privacidade', () => {
  assert.equal(cpfValido('529.982.247-25'), true)
  assert.equal(cpfValido('111.111.111-11'), false)
  assert.equal(cpfValido('529.982.247-24'), false)
  assert.equal(cnpjValido('11.222.333/0001-81'), true)
  assert.equal(cnpjValido('11.222.333/0001-80'), false)
  assert.equal(mascararCpf('52998224725'), '***.982.247-**')
  assert.equal(formatarCpf('52998224725'), '529.982.247-25')
  assert.equal(textoLimpo('  oi\u0000\n tudo  bem ', 50), 'oi tudo bem')
})

test('PIN e senha fracos são recusados', () => {
  assert.ok(problemaNoPin('1234'))
  assert.ok(problemaNoPin('0000'))
  assert.ok(problemaNoPin('987654'))
  assert.ok(problemaNoPin('12a4'))
  assert.equal(problemaNoPin('4821'), null)
  assert.ok(problemaNaSenha('curta1'))
  assert.ok(problemaNaSenha('semnumeros'))
  assert.ok(problemaNaSenha('coxinha1'))
  assert.ok(problemaNaSenha('jonatas2026', 'Jonatas Ramos'))
  assert.equal(problemaNaSenha('gerente2026', 'Bruno Lima'), null)
})

test('bloqueio progressivo depois de 5 erros', () => {
  assert.equal(tempoDeBloqueio(4), 0)
  assert.equal(tempoDeBloqueio(5), 60_000)
  assert.equal(tempoDeBloqueio(7), 4 * 60_000)
  assert.equal(tempoDeBloqueio(20), 30 * 60_000)
})

test('credencial: só o hash é guardado e confere em tempo constante', async () => {
  const c = await criarCredencial('4821')
  assert.ok(!JSON.stringify(c).includes('4821'))
  assert.equal(await conferirCredencial('4821', c), true)
  assert.equal(await conferirCredencial('4822', c), false)
  const outra = await criarCredencial('4821')
  assert.notEqual(outra.hash, c.hash, 'sal diferente para cada credencial')
})

test('CSV: célula que começa com = vira texto (sem fórmula no Excel)', () => {
  const csv = gerarCsv([{ titulo: 'Nome', valor: 'nome' }], [{ nome: '=HYPERLINK("http://x")' }, { nome: 'a;b' }])
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`))
  assert.ok(csv.includes('"a;b"'))
})

test('permissões: atendente não cancela venda nem vê CPF; gerente sim', () => {
  const atendente = { ativo: true, perfilId: 'perfil-atendente' }
  const gerente = { ativo: true, perfilId: 'perfil-gerente' }
  assert.equal(pode(atendente, PERFIS_PADRAO, 'caixa.vender'), true)
  assert.equal(pode(atendente, PERFIS_PADRAO, 'caixa.cancelarVenda'), false)
  assert.equal(pode(atendente, PERFIS_PADRAO, 'dados.cpfCompleto'), false)
  assert.equal(pode(gerente, PERFIS_PADRAO, 'caixa.cancelarVenda'), true)
  assert.equal(pode({ ...gerente, ativo: false }, PERFIS_PADRAO, 'caixa.vender'), false)
})

test('cardápio inicial: códigos únicos e todo sabor obrigatório tem opção', () => {
  const s = criarSemente()
  const codigos = s.produtos.map((p) => p.codigo)
  assert.equal(new Set(codigos).size, codigos.length)
  for (const g of s.gruposModificadores) assert.ok(g.opcoes.length >= g.min, g.nome)
  for (const p of s.produtos) for (const gid of p.gruposModificadores) assert.ok(s.gruposModificadores.some((g) => g.id === gid), `${p.nome}: ${gid}`)
})

// ---------------------------------------------------------------------------
// Salão e mesas

import { totaisConta, valorDaParte, itensAgrupados, situacaoMesa, resumoSalao, contasComPagamentoNoCaixa } from '../src/dados/mesas.js'
import { cadeirasDaMesa, proximoNumero, problemaNoNumero, nomeMesa, alinhar, distribuir, diferencaSalao, mesasDoSalao, aplicarModelo, MODELOS, caixaDosElementos, mesasSobrepostas } from '../src/dados/salao.js'
import { porMesa, resumoMesas } from '../src/dados/relatorios.js'

const coxinha = { id: 'i1', produtoId: 'p-g-frango', nome: 'Frango G', qtd: 2, precoUnit: 1490, modificadores: [], promocao: null, desconto: null, total: 2980 }
const guarana = { id: 'i2', produtoId: 'p-guarana', nome: 'Guaraná', qtd: 1, precoUnit: 600, modificadores: [], promocao: null, desconto: null, total: 600 }

test('conta da mesa: consumo, 10% de serviço, desconto e pagamento parcial', () => {
  const conta = { servico: { percentual: 10 }, descontoPedido: null, pagamentos: [] }
  const pedidos = [
    { id: 'r1', numero: 1, itens: [coxinha] },
    { id: 'r2', numero: 2, itens: [guarana, { ...coxinha, id: 'i3', qtd: 1, total: 1490, cancelado: { motivo: 'Desistiu' } }] },
  ]
  const t = totaisConta(conta, pedidos)
  assert.equal(t.consumo, 2980 + 600, 'item cancelado fica fora')
  assert.equal(t.servico, 358)
  assert.equal(t.total, 3580 + 358)
  assert.equal(t.falta, 3938)
  // Desconto de 10% na conta: o serviço é calculado depois do desconto
  const comDesconto = totaisConta({ ...conta, descontoPedido: { percentual: 10 } }, pedidos)
  assert.equal(comDesconto.consumo, 3580 - 358)
  assert.equal(comDesconto.servico, Math.round((3580 - 358) * 0.1))
  // Pagamento parcial com troco: conta só o que ficou
  const parcial = totaisConta({ ...conta, pagamentos: [{ valor: 5000, troco: 3000 }] }, pedidos)
  assert.equal(parcial.pago, 2000)
  assert.equal(parcial.falta, 3938 - 2000)
  // Sem taxa de serviço
  assert.equal(totaisConta({ ...conta, servico: null }, pedidos).total, 3580)
})

test('dividir a conta em partes iguais fecha no centavo', () => {
  let restante = 10000
  const partes = []
  for (let n = 3; n >= 1; n--) {
    const parte = valorDaParte(restante, n)
    partes.push(parte)
    restante -= parte
  }
  assert.deepEqual(partes, [3334, 3333, 3333])
  assert.equal(restante, 0)
})

test('pré-conta soma itens iguais de rodadas diferentes', () => {
  const lista = itensAgrupados([coxinha, { ...coxinha, id: 'x' }, guarana])
  assert.equal(lista.length, 2)
  assert.equal(lista[0].qtd, 4)
  assert.equal(lista[0].total, 5960)
})

test('mesa sem pedido há muito tempo pede atenção; pediu a conta não', () => {
  const agora = Date.parse('2026-10-22T20:00:00')
  const conta = { status: 'aberta', abertaEm: '2026-10-22T19:00:00', ultimoPedidoEm: '2026-10-22T19:30:00', pagamentos: [] }
  assert.equal(situacaoMesa({ id: 'm' }, conta, [], { agora, alertaMin: 20 }).atencao, true)
  assert.equal(situacaoMesa({ id: 'm' }, conta, [], { agora, alertaMin: 40 }).atencao, false)
  assert.equal(situacaoMesa({ id: 'm' }, { ...conta, status: 'fechando' }, [], { agora, alertaMin: 20 }).estado, 'fechando')
  assert.equal(situacaoMesa({ id: 'm', ativa: false }, null, []).estado, 'inativa')
  assert.equal(situacaoMesa({ id: 'm' }, null, []).estado, 'livre')
})

test('resumo do salão: conta de mesa apagada do mapa continua à vista', () => {
  const mesas = [{ id: 'm1', numero: '1' }, { id: 'm2', numero: '2' }]
  const contas = [
    { id: 'c1', mesaId: 'm1', mesaNome: 'Mesa 1', status: 'aberta', abertaEm: new Date().toISOString(), pessoas: 2, pagamentos: [] },
    { id: 'c9', mesaId: 'apagada', mesaNome: 'Mesa 9', status: 'fechando', abertaEm: new Date().toISOString(), pessoas: 3, pagamentos: [] },
    { id: 'c0', mesaId: 'm2', mesaNome: 'Mesa 2', status: 'fechada', abertaEm: new Date().toISOString(), pagamentos: [] },
  ]
  const pedidos = [{ id: 'r1', contaId: 'c1', numero: 1, itens: [coxinha], cozinha: { status: 'pronto' } }]
  const r = resumoSalao({ mesas, contas, pedidos })
  assert.equal(r.ocupadas, 2)
  assert.equal(r.livres, 1)
  assert.equal(r.foraDoMapa.length, 1)
  assert.equal(r.fechando, 1)
  assert.equal(r.prontos, 1)
  assert.equal(r.pessoas, 5)
})

test('caixa não fecha com conta de mesa aberta que já recebeu dinheiro nele', () => {
  const contas = [
    { id: 'a', status: 'aberta', pagamentos: [{ caixaId: 'cx1', valor: 1000 }] },
    { id: 'b', status: 'fechada', pagamentos: [{ caixaId: 'cx1', valor: 1000 }] },
    { id: 'c', status: 'aberta', pagamentos: [{ caixaId: 'cx2', valor: 1000 }] },
  ]
  assert.deepEqual(contasComPagamentoNoCaixa(contas, 'cx1').map((c) => c.id), ['a'])
})

test('fechamento de caixa: parte da mesa paga num caixa e fechada em outro', () => {
  const formas = [{ id: 'din', tipo: 'dinheiro' }, { id: 'pix', tipo: 'pix' }]
  const vendas = [
    {
      caixaId: 'cx2',
      status: 'concluida',
      total: 5000,
      servico: 500,
      pagamentos: [
        { formaId: 'pix', valor: 2000, caixaId: 'cx1' },
        { formaId: 'din', valor: 5000, troco: 1500, caixaId: 'cx2' },
      ],
    },
  ]
  const cx1 = resumoCaixa({ id: 'cx1', fundo: 0, movimentos: [] }, vendas, formas)
  const cx2 = resumoCaixa({ id: 'cx2', fundo: 0, movimentos: [] }, vendas, formas)
  assert.equal(cx1.esperado.pix, 2000)
  assert.equal(cx1.vendido, 0, 'a venda é do caixa que fechou a conta')
  assert.equal(cx2.esperado.din, 3500)
  assert.equal(cx2.vendido, 5000)
  assert.equal(cx2.servico, 500)
})

test('cadeiras: retangular de 6 lugares tem 2 em cima, 2 embaixo e 1 em cada ponta', () => {
  const cadeiras = cadeirasDaMesa({ forma: 'retangular', w: 160, h: 80, lugares: 6 })
  assert.equal(cadeiras.length, 6)
  assert.equal(cadeiras.filter((c) => c.cy < 0).length, 2)
  assert.equal(cadeiras.filter((c) => c.cy > 80).length, 2)
  assert.equal(cadeiras.filter((c) => c.cx < 0).length, 1)
  assert.equal(cadeirasDaMesa({ forma: 'redonda', w: 80, h: 80, lugares: 5 }).length, 5)
  assert.equal(cadeirasDaMesa({ forma: 'banqueta', w: 40, h: 40, lugares: 1 }).length, 0)
})

test('numeração das mesas: próximo número livre e número repetido recusado', () => {
  const ambientes = [{ elementos: [{ id: 'a', tipo: 'mesa', numero: '1' }, { id: 'b', tipo: 'mesa', numero: '3' }, { id: 'c', tipo: 'mesa', numero: 'VIP' }, { id: 'd', tipo: 'balcao' }] }]
  assert.deepEqual(proximoNumero(ambientes, 3), ['4', '5', '6'])
  assert.ok(problemaNoNumero(ambientes, '3', 'novo'))
  assert.ok(problemaNoNumero(ambientes, ' vip ', 'novo'), 'sem diferença de maiúscula e espaço')
  assert.equal(problemaNoNumero(ambientes, '3', 'b'), null, 'a própria mesa pode manter o número')
  assert.ok(problemaNoNumero(ambientes, '  ', 'novo'))
  assert.equal(nomeMesa({ numero: '12' }), 'Mesa 12')
  assert.equal(nomeMesa({ numero: 'Varanda 2' }), 'Varanda 2')
})

test('alinhar e distribuir mesas', () => {
  const els = [
    { id: 'a', x: 10, y: 0, w: 80, h: 80 },
    { id: 'b', x: 200, y: 40, w: 80, h: 80 },
    { id: 'c', x: 500, y: 20, w: 160, h: 80 },
  ]
  assert.deepEqual(alinhar(els, 'topo').map((e) => e.y), [0, 0, 0])
  assert.deepEqual(alinhar(els, 'esquerda').map((e) => e.x), [10, 10, 10])
  const d = distribuir(els, 'h')
  assert.equal(d[1].x - (d[0].x + d[0].w), d[2].x - (d[1].x + d[1].w), 'espaços iguais')
})

test('registro do salão anota só mesas criadas, apagadas e renomeadas', () => {
  const antes = [{ id: 'amb', nome: 'Salão', elementos: [{ id: 'a', tipo: 'mesa', numero: '1', x: 0 }, { id: 'b', tipo: 'mesa', numero: '2' }] }]
  const depois = [{ id: 'amb', nome: 'Salão', elementos: [{ id: 'a', tipo: 'mesa', numero: '1', x: 300 }, { id: 'c', tipo: 'mesa', numero: '3' }] }]
  const texto = diferencaSalao(antes, depois)
  assert.ok(texto.includes('mesas novas: Mesa 3'))
  assert.ok(texto.includes('mesas apagadas: Mesa 2'))
  assert.equal(diferencaSalao(antes, [{ ...antes[0], elementos: [{ ...antes[0].elementos[0], x: 999 }, antes[0].elementos[1]] }]), '', 'mover não registra')
})

test('modelos de salão: números únicos e tudo dentro do ambiente', () => {
  for (const modelo of MODELOS) {
    const ambientes = aplicarModelo(modelo.id, 'f1')
    const numeros = mesasDoSalao(ambientes, 'f1').map((m) => m.numero.toLowerCase())
    assert.equal(new Set(numeros).size, numeros.length, modelo.nome)
    for (const a of ambientes) {
      const c = caixaDosElementos(a.elementos)
      assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= a.largura && c.y + c.h <= a.altura, `${modelo.nome} › ${a.nome}`)
    }
  }
})

test('relatório por mesa: tempo médio e gasto por pessoa', () => {
  const vendas = [
    { status: 'concluida', criadoEm: '2026-10-22T20:00:00Z', total: 8000, servico: 800, mesa: { id: 'm1', nome: 'Mesa 1', pessoas: 4, abertaEm: '2026-10-22T19:00:00Z' } },
    { status: 'concluida', criadoEm: '2026-10-22T21:00:00Z', total: 4000, servico: 400, mesa: { id: 'm1', nome: 'Mesa 1', pessoas: 2, abertaEm: '2026-10-22T20:30:00Z' } },
    { status: 'cancelada', criadoEm: '2026-10-22T21:00:00Z', total: 999, mesa: { id: 'm1', nome: 'Mesa 1', pessoas: 2 } },
    { status: 'concluida', criadoEm: '2026-10-22T21:00:00Z', total: 1000 },
  ]
  const [m1] = porMesa(vendas)
  assert.equal(m1.contas, 2)
  assert.equal(m1.tempoMedio, 45)
  assert.equal(m1.porPessoa, 2000)
  assert.equal(m1.servico, 1200)
  const r = resumoMesas(vendas)
  assert.equal(r.pessoas, 6)
  assert.equal(r.total, 12000)
})

test('permissões: administrador ganha as permissões novas; gerente monta o salão', () => {
  const perfisAntigos = PERFIS_PADRAO.map((p) => (p.sistema ? { ...p, permissoes: p.permissoes.filter((x) => x !== 'admin.salao') } : p))
  assert.equal(pode({ ativo: true, perfilId: 'perfil-admin' }, perfisAntigos, 'admin.salao'), true)
  assert.equal(pode({ ativo: true, perfilId: 'perfil-gerente' }, PERFIS_PADRAO, 'admin.salao'), true)
  assert.equal(pode({ ativo: true, perfilId: 'perfil-atendente' }, PERFIS_PADRAO, 'admin.salao'), false)
})

test('editor avisa mesa em cima de outra, mas não mesa encostada', () => {
  const els = [
    { id: 'a', tipo: 'mesa', x: 0, y: 0, w: 80, h: 80 },
    { id: 'b', tipo: 'mesa', x: 60, y: 0, w: 80, h: 80 },
    { id: 'c', tipo: 'mesa', x: 300, y: 0, w: 80, h: 80 },
    { id: 'd', tipo: 'mesa', x: 380, y: 0, w: 80, h: 80 },
    { id: 'e', tipo: 'balcao', x: 0, y: 0, w: 400, h: 60 },
  ]
  assert.deepEqual([...mesasSobrepostas(els)].sort(), ['a', 'b'])
})
