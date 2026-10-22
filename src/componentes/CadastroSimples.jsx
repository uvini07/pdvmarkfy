// Tela de cadastro genérica: lista com busca + janela de edição. Serve para
// os cadastros pequenos (filiais, formas de pagamento, clientes…), que só
// mudam nos campos. Toda gravação passa pela auditoria.

import { useMemo, useState } from 'react'
import { banco, useColecao } from '../dados/banco.js'
import { registrar } from '../dados/auditoria.js'
import { useSessao } from '../estado/sessao.js'
import { Pagina, BarraFiltros } from './Pagina.jsx'
import { Tabela } from './Tabela.jsx'
import { Modal } from './Modal.jsx'
import { Botao, BotaoIcone, Campo, Entrada, Selecao, Alternador, Selo, CampoDinheiro, AreaTexto } from './ui.jsx'
import { avisar, confirmar } from './dialogos.jsx'
import { textoLimpo } from '../lib/validacao.js'

function CampoFormulario({ campo, valor, aoMudar, erro, dados }) {
  if (campo.tipo === 'alternador')
    return (
      <div className={campo.largo ? 'largo' : ''}>
        <Alternador rotulo={campo.rotulo} descricao={campo.ajuda} ligado={valor} aoMudar={aoMudar} />
      </div>
    )
  return (
    <Campo rotulo={campo.rotulo} erro={erro} ajuda={campo.ajuda} obrigatorio={campo.obrigatorio} className={campo.largo ? 'largo' : ''}>
      {(p) => {
        if (campo.tipo === 'selecao') return <Selecao {...p} value={valor ?? ''} onChange={(e) => aoMudar(e.target.value)} opcoes={typeof campo.opcoes === 'function' ? campo.opcoes(dados) : campo.opcoes} vazio={campo.vazio} />
        if (campo.tipo === 'dinheiro') return <CampoDinheiro {...p} valor={valor || 0} aoMudar={aoMudar} />
        if (campo.tipo === 'texto-longo') return <AreaTexto {...p} value={valor ?? ''} onChange={(e) => aoMudar(e.target.value)} maxLength={campo.max || 1000} />
        if (campo.tipo === 'numero') return <Entrada {...p} type="number" step={campo.passo || 1} min={campo.min} max={campo.maxNumero} value={valor ?? ''} onChange={(e) => aoMudar(e.target.value === '' ? '' : Number(e.target.value))} />
        return (
          <Entrada
            {...p}
            type={campo.tipo === 'email' ? 'email' : 'text'}
            inputMode={campo.inputMode}
            value={campo.mascara ? campo.mascara(valor ?? '') : (valor ?? '')}
            onChange={(e) => aoMudar(campo.limpar ? campo.limpar(e.target.value) : e.target.value)}
            maxLength={campo.max || 120}
            placeholder={campo.placeholder}
            autoComplete="off"
          />
        )
      }}
    </Campo>
  )
}

export function CadastroSimples({ colecao, titulo, descricao, singular, campos, colunas, padrao = {}, validar, permissao, buscarEm = ['nome'], podeRemover = () => true, ordenar, aoSalvar, acoesExtras }) {
  const { usuario, pode } = useSessao()
  const lista = useColecao(colecao)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null)
  const [erros, setErros] = useState({})
  const permitido = !permissao || pode(permissao)

  const filtrada = useMemo(() => {
    const t = busca.trim().toLowerCase()
    const base = t ? lista.filter((x) => buscarEm.some((c) => String(x[c] ?? '').toLowerCase().includes(t))) : lista
    return ordenar ? [...base].sort(ordenar) : base
  }, [lista, busca, buscarEm, ordenar])

  const abrir = (item) => {
    setErros({})
    setEditando(item ? { ...item } : { ...padrao, ativo: true })
  }

  const salvar = () => {
    const e = {}
    for (const c of campos) {
      const v = editando[c.id]
      if (c.obrigatorio && (v === undefined || v === null || String(v).trim() === '')) e[c.id] = `Preencha ${c.rotulo.toLowerCase()}.`
    }
    Object.assign(e, validar?.(editando, lista) || {})
    setErros(e)
    if (Object.keys(e).length) return
    const dados = { ...editando }
    for (const c of campos) if (typeof dados[c.id] === 'string' && c.tipo !== 'selecao') dados[c.id] = c.tipo === 'texto-longo' ? dados[c.id].trim().slice(0, c.max || 1000) : textoLimpo(dados[c.id], c.max || 120)
    const { id, criadoEm, atualizadoEm, ...resto } = dados
    let salvo
    if (id) {
      salvo = banco.atualizar(colecao, id, resto)
      registrar('cadastro.alterado', `${singular}: ${salvo.nome || salvo.razaoSocial || id}`, { usuario })
    } else {
      salvo = banco.inserir(colecao, { ...resto, ordem: lista.length })
      registrar('cadastro.criado', `${singular}: ${salvo.nome || salvo.razaoSocial || salvo.id}`, { usuario })
    }
    aoSalvar?.(salvo)
    avisar(`${singular} salvo`)
    setEditando(null)
  }

  const remover = async (item) => {
    const motivo = podeRemover(item)
    if (motivo !== true) return avisar(motivo || 'Este cadastro está em uso e não pode ser apagado. Desative-o.', 'erro')
    const ok = await confirmar({ titulo: `Apagar ${singular.toLowerCase()}?`, texto: `“${item.nome || item.razaoSocial}” sai da lista. Se só quer esconder, desative em vez de apagar.`, botao: 'Apagar', perigo: true })
    if (!ok) return
    banco.remover(colecao, item.id)
    registrar('cadastro.removido', `${singular}: ${item.nome || item.razaoSocial}`, { usuario })
    avisar(`${singular} apagado`, 'info')
  }

  const colunasComAcoes = [
    ...colunas,
    { id: 'ativo', titulo: 'Situação', largura: 110, render: (x) => (x.ativo === false ? <Selo tom="cinza">Inativo</Selo> : <Selo tom="verde">Ativo</Selo>), ordenar: (x) => (x.ativo === false ? 1 : 0) },
    ...(permitido
      ? [
          {
            id: 'acoes',
            titulo: '',
            largura: 96,
            alinhar: 'direita',
            ordenavel: false,
            render: (x) => (
              <span className="acoes-linha">
                <BotaoIcone icone="editar" rotulo={`Editar ${x.nome || ''}`} tamanho="p" onClick={() => abrir(x)} />
                <BotaoIcone icone="lixeira" rotulo={`Apagar ${x.nome || ''}`} tamanho="p" variante="perigo" onClick={() => remover(x)} />
              </span>
            ),
          },
        ]
      : []),
  ]

  return (
    <Pagina
      titulo={titulo}
      descricao={descricao}
      acoes={
        permitido && (
          <>
            {acoesExtras}
            <Botao icone="mais" onClick={() => abrir(null)}>
              Novo
            </Botao>
          </>
        )
      }
    >
      <BarraFiltros busca={busca} aoBuscar={setBusca} total={filtrada.length} />
      <Tabela colunas={colunasComAcoes} linhas={filtrada} aoClicar={permitido ? abrir : undefined} vazio={busca ? 'Nada encontrado com essa busca.' : `Nenhum(a) ${singular.toLowerCase()} cadastrado(a) ainda.`} />

      {editando && (
        <Modal
          aberto
          aoFechar={() => setEditando(null)}
          titulo={editando.id ? `Editar ${singular.toLowerCase()}` : `Novo(a) ${singular.toLowerCase()}`}
          largura="m"
          rodape={
            <>
              <Botao variante="secundario" onClick={() => setEditando(null)}>
                Cancelar
              </Botao>
              <Botao onClick={salvar}>Salvar</Botao>
            </>
          }
        >
          <form
            className="grade-campos"
            onSubmit={(e) => {
              e.preventDefault()
              salvar()
            }}
          >
            {campos
              .filter((c) => !c.mostrar || c.mostrar(editando))
              .map((c) => (
                <CampoFormulario key={c.id} campo={c} dados={editando} valor={editando[c.id]} erro={erros[c.id]} aoMudar={(v) => setEditando((d) => ({ ...d, [c.id]: v }))} />
              ))}
            <div className="largo">
              <Alternador rotulo="Ativo" descricao="Inativo some do caixa e das listas de escolha, mas o histórico fica." ligado={editando.ativo !== false} aoMudar={(v) => setEditando((d) => ({ ...d, ativo: v }))} />
            </div>
            <button type="submit" hidden />
          </form>
        </Modal>
      )}
    </Pagina>
  )
}
