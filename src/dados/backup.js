// Backup completo em JSON, com soma SHA-256 para detectar arquivo corrompido ou
// alterado. Sem banco de dados, este arquivo é a cópia de segurança da loja:
// a retaguarda lembra de exportar todo dia.

import { banco, COLECOES, DOCUMENTOS } from './banco.js'
import { registrar } from './auditoria.js'
import { sha256 } from '../lib/seguranca.js'

const FORMATO = 'pdv-sua-coxinha'
const VERSAO = 1

export async function gerarBackup(usuario) {
  await banco.aguardar()
  const dados = banco.exportarTudo()
  const corpo = JSON.stringify(dados)
  const arquivo = {
    formato: FORMATO,
    versao: VERSAO,
    geradoEm: new Date().toISOString(),
    geradoPor: usuario?.nome || '',
    soma: await sha256(corpo),
    dados,
  }
  await registrar('backup.exportado', `${(corpo.length / 1024).toFixed(0)} KB`, { usuario })
  banco.alterarDoc('config', { ultimoBackup: arquivo.geradoEm })
  return JSON.stringify(arquivo)
}

export async function validarBackup(texto) {
  let arquivo
  try {
    arquivo = JSON.parse(texto)
  } catch {
    return { ok: false, erro: 'O arquivo não é um backup do PDV (JSON inválido).' }
  }
  if (arquivo?.formato !== FORMATO) return { ok: false, erro: 'Este arquivo não é um backup do PDV Sua Coxinha.' }
  if (arquivo.versao > VERSAO) return { ok: false, erro: 'Backup de uma versão mais nova do PDV. Atualize o sistema antes.' }
  if (typeof arquivo.dados !== 'object' || !arquivo.dados) return { ok: false, erro: 'Backup sem dados.' }
  if ((await sha256(JSON.stringify(arquivo.dados))) !== arquivo.soma)
    return { ok: false, erro: 'O backup foi alterado ou está corrompido (a soma de verificação não confere).' }
  for (const nome of COLECOES) if (nome in arquivo.dados && !Array.isArray(arquivo.dados[nome])) return { ok: false, erro: `Coleção "${nome}" inválida no backup.` }
  for (const nome of DOCUMENTOS) if (nome in arquivo.dados && typeof arquivo.dados[nome] !== 'object') return { ok: false, erro: `Documento "${nome}" inválido no backup.` }
  if (!arquivo.dados.usuarios?.length || !arquivo.dados.config?.configuradoEm) return { ok: false, erro: 'Backup incompleto: faltam usuários ou configuração.' }
  return {
    ok: true,
    arquivo,
    resumo: {
      geradoEm: arquivo.geradoEm,
      geradoPor: arquivo.geradoPor,
      vendas: arquivo.dados.vendas?.length || 0,
      produtos: arquivo.dados.produtos?.length || 0,
      usuarios: arquivo.dados.usuarios?.length || 0,
    },
  }
}

export async function restaurarBackup(arquivo, usuario) {
  banco.importarTudo(arquivo.dados)
  await registrar('backup.restaurado', `Backup de ${arquivo.geradoEm} (${arquivo.geradoPor})`, { usuario })
}
