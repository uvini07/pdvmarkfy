// Firebase do PDV: o mesmo projeto do app e do site (suacoxinhaapp).
//
// Esta configuração é pública por natureza (viaja no navegador em qualquer app
// do Firebase). Quem protege os dados são as regras do Firestore e as funções
// do login (no repositório sua-coxinha-app), não o segredo destas chaves.
// Para apontar para outro projeto, use as variáveis VITE_FIREBASE_* no .env.local.

const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyA1Be025Mhp9mcPOgCaJDml_dtIUP4hgwk',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'suacoxinhaapp.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'suacoxinhaapp',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'suacoxinhaapp.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '132936922966',
  appId: env.VITE_FIREBASE_APP_ID || '1:132936922966:web:c9e8685a094b8715a908f7',
}

// Tem de ser a mesma região das funções (REGIAO_FUNCOES no app).
export const REGIAO_FUNCOES = env.VITE_REGIAO_FUNCOES || 'southamerica-east1'
