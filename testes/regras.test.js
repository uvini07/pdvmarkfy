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
