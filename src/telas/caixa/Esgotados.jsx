// Marcar produto como esgotado nesta loja (o "Pausar" do PDV Legal). Some do
// pedido na hora, nas outras abas também.

import { useState } from 'react'
import { Modal } from '../../componentes/Modal.jsx'
import { Alternador, Entrada } from '../../componentes/ui.jsx'
import { avisar, pedirAutorizacao } from '../../componentes/dialogos.jsx'
import { banco, useColecao } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { estaPausado } from '../../dados/precos.js'
import { useSessao } from '../../estado/sessao.js'

export function Esgotados({ aoFechar }) {
  const { filial, usuario, pode } = useSessao()
  const produtos = useColecao('produtos').filter((p) => p.ativo && p.tipo === 'venda')
  const [busca, setBusca] = useState('')
  const [liberado, setLiberado] = useState(pode('caixa.pausarProduto'))

  const alternar = async (p) => {
    if (!liberado) {
      const ok = await pedirAutorizacao({ permissao: 'caixa.pausarProduto', acao: 'Marcar produtos como esgotados', filialId: filial.id })
      if (!ok) return
      setLiberado(true)
    }
    const pausar = !estaPausado(p, filial.id)
    banco.atualizar('produtos', p.id, { pausado: { ...p.pausado, [filial.id]: pausar } })
    registrar(pausar ? 'produto.pausado' : 'produto.liberado', p.nome, { usuario, filialId: filial.id })
    avisar(pausar ? `${p.nome} marcado como esgotado` : `${p.nome} voltou ao cardápio`, 'info')
  }

  const lista = produtos.filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))
  const esgotados = produtos.filter((p) => estaPausado(p, filial.id)).length

  return (
    <Modal aberto aoFechar={aoFechar} titulo="Produtos esgotados" subtitulo={`${filial.nome}: ${esgotados} esgotado(s) agora`} largura="m" className="tema-escuro">
      <div className="pilha">
        <Entrada icone="busca" placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar produto" />
        <div className="lista-alternadores">
          {lista.map((p) => (
            <Alternador key={p.id} rotulo={p.nome} descricao={estaPausado(p, filial.id) ? 'Esgotado nesta loja' : null} ligado={estaPausado(p, filial.id)} aoMudar={() => alternar(p)} />
          ))}
        </div>
      </div>
    </Modal>
  )
}
