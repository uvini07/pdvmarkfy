// Registro de segurança: quem fez o quê, quando e em qual filial.
//
// É encadeado: cada registro tem um número em sequência e guarda o hash do
// anterior; o próprio hash cobre o conteúdo + o hash anterior. Se alguém apagar
// ou editar um registro direto no navegador, a verificação aponta onde a
// corrente quebrou.
//
// Caixa e cozinha abertos juntos gravam registros ao mesmo tempo. Uma trava
// entre abas (Web Locks) garante que um registro só é escrito depois do outro,
// lendo o último direto do banco — a corrente nunca bifurca.

import { banco } from './banco.js'
import { sha256 } from '../lib/seguranca.js'

const conteudo = (r) => JSON.stringify([r.seq, r.em, r.usuarioId, r.acao, r.detalhe, r.filialId, r.anterior])

async function gravar(acao, detalhe, usuario, filialId) {
  await banco.aguardar()
  const ultimo = await banco.ultimo('auditoria')
  const seq = (ultimo?.seq || 0) + 1
  const registro = {
    id: String(seq).padStart(10, '0'),
    seq,
    em: new Date().toISOString(),
    usuarioId: usuario?.id || null,
    usuarioNome: usuario?.nome || 'Sistema',
    acao,
    detalhe: String(detalhe).slice(0, 500),
    filialId: filialId || null,
    anterior: ultimo?.hash || 'inicio',
  }
  registro.hash = await sha256(conteudo(registro))
  registro.criadoEm = registro.em
  banco.inserir('auditoria', registro)
  // Marca d'água: o maior seq (e seu hash) que já foi gravado, num doc à parte.
  // Apagar os últimos registros deixa a corrente 1..k internamente válida — só
  // a marca permite perceber depois que o fim encolheu (ver verificarCorrente).
  banco.alterarDoc('config', (c) => (registro.seq > (c.auditoriaSeq || 0) ? { auditoriaSeq: registro.seq, auditoriaHash: registro.hash } : {}))
  await banco.aguardar()
}

let fila = Promise.resolve()

export function registrar(acao, detalhe = '', { usuario, filialId } = {}) {
  const trabalho = () => gravar(acao, detalhe, usuario, filialId)
  fila = fila.then(() => (navigator.locks ? navigator.locks.request('scpdv-auditoria', trabalho) : trabalho())).catch(() => {})
  return fila
}

export async function verificarCorrente() {
  const lista = [...banco.lista('auditoria')].sort((a, b) => a.seq - b.seq)
  for (let i = 0; i < lista.length; i++) {
    const r = lista[i]
    if (i > 0 && (r.anterior !== lista[i - 1].hash || r.seq !== lista[i - 1].seq + 1)) return { ok: false, posicao: i, registro: r }
    if (i === 0 && r.seq !== 1) return { ok: false, posicao: 0, registro: r }
    if ((await sha256(conteudo(r))) !== r.hash) return { ok: false, posicao: i, registro: r }
  }
  // Truncamento do fim: a corrente 1..k pode estar íntegra mas ter perdido os
  // últimos registros. A marca d'água guarda o maior seq que já existiu; se o
  // fim atual for menor (ou o registro na marca tiver outro hash), houve corte.
  const config = banco.doc('config')
  const marca = config.auditoriaSeq || 0
  if (marca) {
    const ultimo = lista[lista.length - 1]
    if (!ultimo || ultimo.seq < marca) return { ok: false, truncado: true, marca, atual: ultimo?.seq || 0 }
    const naMarca = lista.find((r) => r.seq === marca)
    if (naMarca && config.auditoriaHash && naMarca.hash !== config.auditoriaHash) return { ok: false, truncado: true, marca, atual: ultimo.seq }
  }
  return { ok: true, total: lista.length }
}

export const ROTULOS_ACAO = {
  'sistema.configurado': 'Sistema configurado',
  'acesso.entrou': 'Entrou',
  'acesso.saiu': 'Saiu',
  'acesso.falhou': 'Tentativa de acesso errada',
  'acesso.bloqueado': 'Usuário bloqueado por tentativas',
  'acesso.tela-bloqueada': 'Tela bloqueada por inatividade',
  'autorizacao.concedida': 'Autorização de supervisor',
  'autorizacao.negada': 'Autorização negada',
  'caixa.aberto': 'Caixa aberto',
  'caixa.fechado': 'Caixa fechado',
  'caixa.conferido': 'Caixa conferido',
  'caixa.sangria': 'Sangria',
  'caixa.suprimento': 'Suprimento',
  'venda.concluida': 'Venda',
  'venda.cancelada': 'Venda cancelada',
  'venda.estornada': 'Venda estornada',
  'venda.item-cancelado': 'Item cancelado',
  'venda.desconto': 'Desconto',
  'venda.reimpressao': 'Reimpressão',
  'mesa.aberta': 'Mesa aberta',
  'mesa.pedido': 'Pedido lançado na mesa',
  'mesa.transferida': 'Mesa transferida',
  'mesa.juntada': 'Mesas juntadas',
  'mesa.itens-movidos': 'Itens movidos de mesa',
  'mesa.conta-pedida': 'Pré-conta impressa',
  'mesa.pagamento-parcial': 'Pagamento parcial de mesa',
  'mesa.pagamento-desfeito': 'Pagamento parcial desfeito',
  'mesa.servico': 'Taxa de serviço alterada',
  'mesa.desconto': 'Desconto na conta da mesa',
  'mesa.liberada': 'Mesa liberada sem consumo',
  'salao.alterado': 'Salão alterado',
  'produto.pausado': 'Produto esgotado',
  'produto.liberado': 'Produto liberado',
  'cadastro.criado': 'Cadastro criado',
  'cadastro.alterado': 'Cadastro alterado',
  'cadastro.removido': 'Cadastro removido',
  'preco.alterado': 'Preço alterado',
  'estoque.movimento': 'Movimento de estoque',
  'usuario.criado': 'Usuário criado',
  'usuario.alterado': 'Usuário alterado',
  'usuario.credencial': 'PIN ou senha trocados',
  'dados.cpf-visto': 'CPF completo exibido',
  'relatorio.exportado': 'Relatório exportado',
  'backup.exportado': 'Backup exportado',
  'backup.restaurado': 'Backup restaurado',
  'dados.apagados': 'Dados apagados',
}
