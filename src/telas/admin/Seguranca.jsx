// Registro de segurança (auditoria encadeada), backup e limpeza dos dados de
// demonstração.

import { useEffect, useMemo, useRef, useState } from 'react'
import { banco, useColecao, useDoc } from '../../dados/banco.js'
import { registrar, verificarCorrente, ROTULOS_ACAO } from '../../dados/auditoria.js'
import { gerarBackup, validarBackup, restaurarBackup } from '../../dados/backup.js'
import { useSessao } from '../../estado/sessao.js'
import { Pagina, BarraFiltros, Cartao } from '../../componentes/Pagina.jsx'
import { Tabela } from '../../componentes/Tabela.jsx'
import { Botao, Selecao, Selo } from '../../componentes/ui.jsx'
import { Icone } from '../../componentes/Icone.jsx'
import { avisar, confirmar } from '../../componentes/dialogos.jsx'
import { baixarArquivo, lerArquivoTexto, gerarCsv } from '../../lib/arquivos.js'
import { dataHora, hoje } from '../../lib/datas.js'

export function Seguranca() {
  const { usuario, pode } = useSessao()
  const auditoria = useColecao('auditoria')
  const filiais = useColecao('filiais')
  const config = useDoc('config')
  const vendas = useColecao('vendas')
  const [busca, setBusca] = useState('')
  const [acao, setAcao] = useState('')
  const [verificacao, setVerificacao] = useState(null)
  const arquivo = useRef(null)

  const lista = useMemo(
    () =>
      [...auditoria]
        .reverse()
        .filter((r) => (!acao || r.acao === acao) && (!busca || `${r.usuarioNome} ${r.detalhe}`.toLowerCase().includes(busca.toLowerCase())))
        .slice(0, 500),
    [auditoria, acao, busca],
  )

  const verificar = async () => {
    const r = await verificarCorrente()
    setVerificacao(r)
  }

  const exportar = async () => {
    const conteudo = await gerarBackup(usuario)
    baixarArquivo(`backup-pdv-sua-coxinha-${hoje()}.json`, conteudo, 'application/json')
    avisar('Backup baixado. Guarde em um lugar seguro (ele tem dados de clientes).')
  }

  const restaurar = async (f) => {
    try {
      const r = await validarBackup(await lerArquivoTexto(f, 50 * 1024 * 1024))
      if (!r.ok) return avisar(r.erro, 'erro')
      const ok = await confirmar({
        titulo: 'Restaurar este backup?',
        texto: `Backup de ${dataHora(r.resumo.geradoEm)} feito por ${r.resumo.geradoPor}: ${r.resumo.vendas} vendas, ${r.resumo.produtos} produtos, ${r.resumo.usuarios} usuários. TUDO o que está neste navegador agora será substituído.`,
        botao: 'Substituir pelos dados do backup',
        perigo: true,
      })
      if (!ok) return
      await restaurarBackup(r.arquivo, usuario)
      avisar('Backup restaurado')
    } catch (e) {
      avisar(e.message, 'erro')
    }
  }

  const apagarDemonstracao = async () => {
    const demos = vendas.filter((v) => v.demonstracao).length
    if (!(await confirmar({ titulo: 'Apagar os dados de demonstração?', texto: `Saem ${demos} vendas de exemplo, as contas e o comunicado de exemplo, o estoque inicial e os usuários Ana, Bruno e Cozinha Morumbi. O cardápio, as filiais e os seus usuários ficam.`, botao: 'Apagar demonstração', perigo: true }))) return
    banco.substituir('vendas', banco.lista('vendas').filter((v) => !v.demonstracao))
    banco.substituir('contas', banco.lista('contas').filter((c) => !c.demonstracao))
    banco.substituir('comunicados', banco.lista('comunicados').filter((c) => !c.demonstracao))
    banco.substituir('usuarios', banco.lista('usuarios').filter((u) => !u.demonstracao))
    banco.substituir('saldos', {})
    banco.alterarDoc('config', { demonstracao: false })
    await registrar('dados.apagados', `Dados de demonstração (${demos} vendas)`, { usuario })
    avisar('Dados de demonstração apagados')
  }

  const exportarAuditoria = () => {
    baixarArquivo(
      `registro-seguranca-${hoje()}.csv`,
      gerarCsv(
        [
          { titulo: 'Quando', valor: (r) => dataHora(r.em) },
          { titulo: 'Quem', valor: 'usuarioNome' },
          { titulo: 'Ação', valor: (r) => ROTULOS_ACAO[r.acao] || r.acao },
          { titulo: 'Detalhe', valor: 'detalhe' },
          { titulo: 'Filial', valor: (r) => filiais.find((f) => f.id === r.filialId)?.nome || '' },
          { titulo: 'Hash', valor: 'hash' },
        ],
        [...auditoria].reverse(),
      ),
    )
  }

  const tom = (a) => (a.startsWith('acesso.falhou') || a.startsWith('acesso.bloqueado') || a === 'autorizacao.negada' ? 'vermelho' : a.includes('cancel') || a.includes('estorn') || a === 'dados.apagados' || a === 'backup.restaurado' ? 'laranja' : a.startsWith('acesso') ? 'azul' : 'cinza')
  const [uso, setUso] = useState(null)
  useEffect(() => {
    banco.uso().then(setUso)
  }, [auditoria.length])
  const mb = (b) => (b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

  return (
    <Pagina titulo="Segurança e backup" descricao="Tudo o que muda dinheiro, preço, estoque ou acesso fica registrado aqui, com quem fez e quando.">
      <div className="grade-cartoes">
        {pode('admin.backup') && (
          <Cartao titulo="Backup">
            <div className="pilha">
              <p className="mudo">
                Enquanto não há banco de dados, os dados ficam só neste computador{uso?.cota ? ` (${mb(uso.usado)} MB usados de ${mb(uso.cota)} MB disponíveis)` : ''}. Faça o backup todo dia e guarde fora do computador.
                {config.ultimoBackup ? ` Último: ${dataHora(config.ultimoBackup)}.` : ' Nenhum backup ainda.'}
              </p>
              <div className="linha linha--quebra">
                <Botao icone="baixar" onClick={exportar}>
                  Baixar backup
                </Botao>
                <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files[0] && restaurar(e.target.files[0])} />
                <Botao variante="secundario" icone="enviar" onClick={() => arquivo.current?.click()}>
                  Restaurar
                </Botao>
              </div>
            </div>
          </Cartao>
        )}
        <Cartao titulo="Integridade do registro">
          <div className="pilha">
            <p className="mudo">Cada registro guarda um código (hash) do anterior. Se alguém apagar ou mudar um registro direto no navegador, a verificação mostra onde.</p>
            <div className="linha">
              <Botao variante="secundario" icone="escudo-check" onClick={verificar}>
                Verificar agora
              </Botao>
              {verificacao &&
                (verificacao.ok ? (
                  <Selo tom="verde" icone="check">
                    Íntegro, {verificacao.total} registros
                  </Selo>
                ) : (
                  <Selo tom="vermelho" icone="alerta">
                    Alterado no registro {verificacao.posicao + 1}
                  </Selo>
                ))}
            </div>
          </div>
        </Cartao>
        {config.demonstracao && pode('admin.backup') && (
          <Cartao titulo="Dados de demonstração">
            <div className="pilha">
              <p className="mudo">Antes de começar a usar na loja, apague as vendas, contas e usuários de exemplo.</p>
              <Botao variante="perigo" icone="lixeira" onClick={apagarDemonstracao}>
                Apagar demonstração
              </Botao>
            </div>
          </Cartao>
        )}
      </div>

      {pode('admin.auditoria') && (
        <>
          <h2 className="titulo-secao">
            <Icone nome="escudo" tamanho={22} /> Registro de segurança
          </h2>
          <BarraFiltros busca={busca} aoBuscar={setBusca} placeholder="Pessoa ou detalhe" total={lista.length}>
            <Selecao value={acao} onChange={(e) => setAcao(e.target.value)} aria-label="Ação" vazio="Todas as ações" opcoes={Object.entries(ROTULOS_ACAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            <Botao variante="secundario" tamanho="p" icone="baixar" onClick={exportarAuditoria}>
              CSV
            </Botao>
          </BarraFiltros>
          <Tabela
            linhas={lista}
            densa
            colunas={[
              { id: 'em', titulo: 'Quando', valor: (r) => dataHora(r.em), largura: 150 },
              { id: 'usuarioNome', titulo: 'Quem', largura: 160 },
              { id: 'acao', titulo: 'Ação', render: (r) => <Selo tom={tom(r.acao)}>{ROTULOS_ACAO[r.acao] || r.acao}</Selo> },
              { id: 'detalhe', titulo: 'Detalhe' },
              { id: 'filial', titulo: 'Filial', valor: (r) => filiais.find((f) => f.id === r.filialId)?.nome || '' },
            ]}
          />
        </>
      )}
    </Pagina>
  )
}
