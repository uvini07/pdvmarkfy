import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { iniciarBanco } from './dados/banco.js'
import { atualizarDados } from './dados/inicializar.js'
import './estilos/tokens.css'
import './estilos/base.css'
import './estilos/componentes.css'
import './estilos/acesso.css'
import './estilos/caixa.css'
import './estilos/cozinha.css'
import './estilos/admin.css'
import './estilos/salao.css'
import './estilos/impressao.css'

const raiz = createRoot(document.getElementById('raiz'))

iniciarBanco()
  .then(atualizarDados)
  .then(() =>
    raiz.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((erro) =>
    raiz.render(
      <div className="tema-escuro tela-cheia-centro">
        <img src="/marca/logo-claro.svg" alt="Sua Coxinha" height="28" />
        <p>Não foi possível abrir os dados do PDV neste navegador.</p>
        <p className="mudo">{String(erro?.message || erro)}</p>
      </div>,
    ),
  )
