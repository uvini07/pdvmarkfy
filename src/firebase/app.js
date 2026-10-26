// Duas conexões com o mesmo projeto, cada uma com a sua identidade:
//
//   · pessoa     — quem está atendendo. Fica só na aba (fechou, saiu), como a
//                  sessão do PDV sempre foi.
//   · computador — o caixa liberado por um gerente. Fica guardado no
//                  navegador: o computador continua liberado entre um dia e
//                  outro, e é ele que lista quem atende ali e confere o PIN.
//
// Separadas, a pessoa sai e entra sem o computador perder a liberação.

import { getApp, getApps, initializeApp } from 'firebase/app'
import { browserLocalPersistence, browserPopupRedirectResolver, browserSessionPersistence, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { firebaseConfig, REGIAO_FUNCOES } from './config.js'

const iniciar = (nome) => getApps().find((a) => a.name === nome) || initializeApp(firebaseConfig, nome)

const appPessoa = getApps().some((a) => a.name === '[DEFAULT]') ? getApp() : initializeApp(firebaseConfig)
const appComputador = iniciar('computador')

// initializeAuth só pode rodar uma vez por app (o hot-reload do Vite rodaria de novo).
const auths = (globalThis.__pdvAuths ??= {})

export const authPessoa = (auths.pessoa ??= initializeAuth(appPessoa, {
  persistence: browserSessionPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
}))
export const authComputador = (auths.computador ??= initializeAuth(appComputador, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
}))

authPessoa.languageCode = 'pt-BR'

// Cache no computador: a ficha da pessoa e os perfis continuam aparecendo se a
// internet cair e a página recarregar. Sem suporte (modo privado), modo normal.
function iniciarFirestore() {
  try {
    return initializeFirestore(appPessoa, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  } catch {
    return getFirestore(appPessoa)
  }
}

export const db = iniciarFirestore()
export const funcoesPessoa = getFunctions(appPessoa, REGIAO_FUNCOES)
export const funcoesComputador = getFunctions(appComputador, REGIAO_FUNCOES)

// Para testar sem tocar no banco de verdade: VITE_EMULADORES=true no
// .env.local e, no sua-coxinha-app, `npx firebase emulators:start --only auth,firestore,functions`.
if (import.meta.env.VITE_EMULADORES === 'true' && !globalThis.__pdvEmuladores) {
  globalThis.__pdvEmuladores = true
  for (const auth of [authPessoa, authComputador]) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8085)
  for (const f of [funcoesPessoa, funcoesComputador]) connectFunctionsEmulator(f, '127.0.0.1', 5001)
}
