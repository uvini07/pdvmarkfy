// Usuários do PDV. Moram no servidor (pdv_usuarios, no Firebase) e só as
// funções do login gravam: ver src/firebase/pdv.js. O PIN nunca chega a este
// navegador como hash — é conferido lá.
//
// Aqui fica só a conferência rápida do formulário, para a pessoa ver o erro
// sem esperar o servidor (que confere tudo de novo, inclusive quem pode dar
// qual perfil e quais filiais).

import { problemaNoPin } from '../lib/seguranca.js'
import { emailValido, textoLimpo } from '../lib/validacao.js'

export function validarUsuario(dados, { novo }) {
  const erros = {}
  if (!textoLimpo(dados.nome, 60)) erros.nome = 'Informe o nome.'
  if (dados.email && !emailValido(dados.email)) erros.email = 'E-mail inválido.'
  if (!dados.perfilId) erros.perfilId = 'Escolha o perfil.'
  if (!dados.todasFiliais && !dados.filiais?.length) erros.filiais = 'Escolha ao menos uma filial.'
  if (dados.pin) {
    const problema = problemaNoPin(dados.pin)
    if (problema) erros.pin = problema
  }
  if (novo && !dados.pin && !dados.email) erros.pin = 'Cadastre um PIN (caixa e cozinha) ou um e-mail (retaguarda).'
  return erros
}

export const estaBloqueado = (u) => Boolean(u?.bloqueado)
