// Exportação de planilhas e arquivos. O CSV sai com ";" e BOM para abrir certo no
// Excel em português, e protege contra injeção de fórmula: célula que começa com
// = + - @ ganha um apóstrofo na frente, para o Excel não executar.

const celula = (v) => {
  let t = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
  if (/[";\n\r]/.test(t)) t = `"${t.replace(/"/g, '""')}"`
  return t
}

export function gerarCsv(colunas, linhas) {
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(';')
  const corpo = linhas.map((l) => colunas.map((c) => celula(typeof c.valor === 'function' ? c.valor(l) : l[c.valor])).join(';'))
  return '﻿' + [cabecalho, ...corpo].join('\r\n')
}

export function baixarArquivo(nome, conteudo, tipo = 'text/csv;charset=utf-8') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function lerArquivoTexto(arquivo, limiteBytes = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (arquivo.size > limiteBytes) return reject(new Error('Arquivo grande demais.'))
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    leitor.readAsText(arquivo)
  })
}
