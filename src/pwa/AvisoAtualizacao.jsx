import { useEffect, useState } from 'react'
import { aoTerVersaoNova, atualizarAgora } from './registrar.js'

export default function AvisoAtualizacao() {
  const [visivel, setVisivel] = useState(false)
  useEffect(() => aoTerVersaoNova(setVisivel), [])
  if (!visivel) return null
  return (
    <div className="aviso-versao" role="status">
      <span>
        <strong>Versão nova do PDV.</strong> Atualize quando não houver venda em andamento.
      </span>
      <button type="button" className="botao botao--primario botao--p" onClick={atualizarAgora}>
        Atualizar
      </button>
      <button type="button" className="botao botao--fantasma botao--p" onClick={() => setVisivel(false)}>
        Depois
      </button>
    </div>
  )
}
