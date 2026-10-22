// Leitura do XML da NF-e de compra (o arquivo que o fornecedor manda), para dar
// entrada no estoque sem digitar item por item. Roda só no navegador, com o
// DOMParser em modo XML — que não executa nada do arquivo.
//
// A busca automática de notas na Sefaz (manifesto do destinatário) exige
// certificado digital A1 e servidor; fica para quando houver backend.

const texto = (no, tag) => no?.getElementsByTagName(tag)?.[0]?.textContent?.trim() || ''
const numero = (v) => {
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function lerNfe(xml) {
  if (xml.length > 5_000_000) throw new Error('Arquivo grande demais para uma NF-e.')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo não é um XML válido.')
  const inf = doc.getElementsByTagName('infNFe')[0]
  if (!inf) throw new Error('Este XML não é de uma NF-e (falta o grupo infNFe).')

  const ide = inf.getElementsByTagName('ide')[0]
  const emit = inf.getElementsByTagName('emit')[0]
  const total = inf.getElementsByTagName('ICMSTot')[0]
  const chave = (inf.getAttribute('Id') || '').replace(/^NFe/, '')
  if (!/^\d{44}$/.test(chave)) throw new Error('Chave de acesso inválida no XML.')

  const itens = [...inf.getElementsByTagName('det')].map((det) => {
    const prod = det.getElementsByTagName('prod')[0]
    const ean = texto(prod, 'cEAN')
    return {
      codigo: texto(prod, 'cProd').slice(0, 60),
      ean: /^\d{8,14}$/.test(ean) ? ean : '',
      descricao: texto(prod, 'xProd').slice(0, 120),
      unidade: texto(prod, 'uCom').slice(0, 6),
      quantidade: numero(texto(prod, 'qCom')),
      valorUnitario: Math.round(numero(texto(prod, 'vUnCom')) * 100),
      valorTotal: Math.round(numero(texto(prod, 'vProd')) * 100),
    }
  })
  if (!itens.length) throw new Error('A nota não tem itens.')

  return {
    chave,
    numero: texto(ide, 'nNF'),
    serie: texto(ide, 'serie'),
    emissao: texto(ide, 'dhEmi') || texto(ide, 'dEmi'),
    emitente: { cnpj: texto(emit, 'CNPJ'), nome: texto(emit, 'xNome').slice(0, 120) },
    valorTotal: Math.round(numero(texto(total, 'vNF')) * 100),
    itens,
  }
}
