// Comunicados da franqueadora para as lojas (o "Atendimento › Comunicados"
// do PDV Legal). O caixa mostra quantos estão sem ler.

import { useState } from 'react'
import { banco, useColecao } from '../../dados/banco.js'
import { registrar } from '../../dados/auditoria.js'
import { useSessao } from '../../estado/sessao.js'
import { Pagina } from '../../componentes/Pagina.jsx'
import { Modal } from '../../componentes/Modal.jsx'
import { Botao, BotaoIcone, Campo, Entrada, Marcador, AreaTexto, Selo, Vazio } from '../../componentes/ui.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { dataHora } from '../../lib/datas.js'
import { textoLimpo } from '../../lib/validacao.js'

export function Comunicados() {
  const { usuario, filial, pode } = useSessao()
  const comunicados = useColecao('comunicados')
  const filiais = useColecao('filiais')
  const [novo, setNovo] = useState(null)
  const [erros, setErros] = useState({})
  const podePublicar = pode('admin.comunicados')

  const lista = comunicados.filter((c) => podePublicar || !c.filiais?.length || c.filiais.includes(filial.id)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))

  const marcarLido = (c) => banco.atualizar('comunicados', c.id, { lidos: { ...c.lidos, [usuario.id]: new Date().toISOString() } })

  const publicar = () => {
    const e = {}
    if (!textoLimpo(novo.titulo, 80)) e.titulo = 'Escreva o título.'
    if (!novo.texto.trim()) e.texto = 'Escreva o comunicado.'
    setErros(e)
    if (Object.keys(e).length) return
    banco.inserir('comunicados', { titulo: textoLimpo(novo.titulo, 80), texto: novo.texto.trim().slice(0, 2000), filiais: novo.filiais, autorNome: usuario.nome, lidos: { [usuario.id]: new Date().toISOString() } })
    registrar('cadastro.criado', `Comunicado: ${novo.titulo}`, { usuario })
    avisar('Comunicado publicado')
    setNovo(null)
  }

  const remover = async (c) => {
    if (!(await confirmar({ titulo: 'Apagar comunicado?', texto: c.titulo, botao: 'Apagar', perigo: true }))) return
    banco.remover('comunicados', c.id)
    registrar('cadastro.removido', `Comunicado: ${c.titulo}`, { usuario })
  }

  return (
    <Pagina titulo="Comunicados" descricao="Avisos da franqueadora para as lojas." acoes={podePublicar && <Botao icone="megafone" onClick={() => (setErros({}), setNovo({ titulo: '', texto: '', filiais: [] }))}>Novo comunicado</Botao>}>
      {!lista.length && <Vazio mascote titulo="Nenhum comunicado" texto="Quando a franqueadora publicar um aviso, ele aparece aqui e no caixa." />}
      <ul className="comunicados">
        {lista.map((c) => {
          const lido = c.lidos?.[usuario.id]
          const leitores = Object.keys(c.lidos || {}).length
          return (
            <li key={c.id} className={`comunicado ${lido ? '' : 'comunicado--novo'}`}>
              <header>
                <div>
                  <h2>{c.titulo}</h2>
                  <p className="mudo">
                    {c.autorNome}, {dataHora(c.criadoEm)}, para {c.filiais?.length ? c.filiais.map((f) => filiais.find((x) => x.id === f)?.nome).join(', ') : 'todas as lojas'}
                  </p>
                </div>
                {!lido ? <Selo tom="amarelo">Novo</Selo> : podePublicar && <span className="mudo">{leitores} leitura(s)</span>}
              </header>
              <p className="comunicado__texto">{c.texto}</p>
              <footer className="linha">
                {!lido && (
                  <Botao variante="contorno" tamanho="p" icone="check" onClick={() => marcarLido(c)}>
                    Marcar como lido
                  </Botao>
                )}
                {podePublicar && <BotaoIcone icone="lixeira" tamanho="p" variante="perigo" rotulo="Apagar comunicado" onClick={() => remover(c)} />}
              </footer>
            </li>
          )
        })}
      </ul>
      {novo && (
        <Modal aberto aoFechar={() => setNovo(null)} titulo="Novo comunicado" largura="m" rodape={<><Botao variante="secundario" onClick={() => setNovo(null)}>Cancelar</Botao><Botao onClick={publicar}>Publicar</Botao></>}>
          <div className="pilha">
            <Campo rotulo="Título" erro={erros.titulo}>{(x) => <Entrada {...x} value={novo.titulo} onChange={(e) => setNovo((d) => ({ ...d, titulo: e.target.value }))} maxLength={80} />}</Campo>
            <Campo rotulo="Texto" erro={erros.texto}>{(x) => <AreaTexto {...x} rows={6} value={novo.texto} onChange={(e) => setNovo((d) => ({ ...d, texto: e.target.value }))} maxLength={2000} />}</Campo>
            <div>
              <p className="campo__rotulo">Para quais lojas (nenhuma marcada = todas)</p>
              <div className="grade-marcadores">
                {filiais.map((f) => (
                  <Marcador key={f.id} rotulo={f.nome} marcado={novo.filiais.includes(f.id)} aoMudar={(m) => setNovo((d) => ({ ...d, filiais: m ? [...d.filiais, f.id] : d.filiais.filter((x) => x !== f.id) }))} />
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </Pagina>
  )
}
