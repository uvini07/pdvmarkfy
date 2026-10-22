// Clientes e fornecedores. CPF de cliente é dado pessoal: aparece mascarado na
// lista e só quem tem a permissão vê inteiro (fica registrado na auditoria).

import { useState } from 'react'
import { CadastroSimples } from '../../componentes/CadastroSimples.jsx'
import { BotaoIcone } from '../../componentes/ui.jsx'
import { useSessao } from '../../estado/sessao.js'
import { registrar } from '../../dados/auditoria.js'
import { cpfValido, cnpjValido, digitos, emailValido, formatarCnpj, formatarCpf, formatarTelefone, mascararCpf } from '../../lib/validacao.js'

function CpfProtegido({ cliente }) {
  const { pode, usuario } = useSessao()
  const [ver, setVer] = useState(false)
  if (!cliente.cpf) return <span className="mudo">—</span>
  if (ver) return <span className="numero">{formatarCpf(cliente.cpf)}</span>
  return (
    <span className="linha">
      <span className="numero">{mascararCpf(cliente.cpf)}</span>
      {pode('dados.cpfCompleto') && (
        <BotaoIcone
          icone="olho"
          tamanho="p"
          rotulo="Mostrar CPF completo"
          onClick={() => {
            registrar('dados.cpf-visto', cliente.nome, { usuario })
            setVer(true)
          }}
        />
      )}
    </span>
  )
}

export function Clientes() {
  return (
    <CadastroSimples
      colecao="clientes"
      titulo="Clientes"
      descricao="Clientes de encomenda e de fidelidade. Guarde só o que a loja precisa usar (LGPD)."
      singular="Cliente"
      permissao="admin.pessoas"
      buscarEm={['nome', 'telefone', 'email']}
      campos={[
        { id: 'nome', rotulo: 'Nome', obrigatorio: true, max: 80, largo: true },
        { id: 'telefone', rotulo: 'Celular', mascara: formatarTelefone, limpar: digitos, inputMode: 'tel' },
        { id: 'cpf', rotulo: 'CPF', mascara: formatarCpf, limpar: digitos, inputMode: 'numeric', ajuda: 'Opcional' },
        { id: 'email', rotulo: 'E-mail', tipo: 'email', max: 120 },
        { id: 'nascimento', rotulo: 'Aniversário (dd/mm)', max: 5, placeholder: '25/12' },
        { id: 'obs', rotulo: 'Observações', tipo: 'texto-longo', largo: true, max: 400 },
        { id: 'consentimento', rotulo: 'Aceita receber ofertas', tipo: 'alternador', ajuda: 'Só mande promoções para quem marcou esta opção.', largo: true },
      ]}
      validar={(c) => {
        const e = {}
        if (c.cpf && !cpfValido(c.cpf)) e.cpf = 'CPF inválido.'
        if (c.email && !emailValido(c.email)) e.email = 'E-mail inválido.'
        if (c.telefone && digitos(c.telefone).length < 10) e.telefone = 'Celular incompleto.'
        return e
      }}
      colunas={[
        { id: 'nome', titulo: 'Nome' },
        { id: 'telefone', titulo: 'Celular', render: (c) => (c.telefone ? formatarTelefone(c.telefone) : '—') },
        { id: 'cpf', titulo: 'CPF', ordenavel: false, render: (c) => <CpfProtegido cliente={c} /> },
      ]}
    />
  )
}

export function Fornecedores() {
  return (
    <CadastroSimples
      colecao="fornecedores"
      titulo="Fornecedores"
      descricao="Fábrica, distribuidoras de bebida e embalagens. Usados nas entradas de estoque e nas contas a pagar."
      singular="Fornecedor"
      permissao="admin.pessoas"
      buscarEm={['razaoSocial', 'fantasia', 'cnpj']}
      campos={[
        { id: 'razaoSocial', rotulo: 'Razão social', obrigatorio: true, max: 120, largo: true },
        { id: 'fantasia', rotulo: 'Nome fantasia', max: 80 },
        { id: 'cnpj', rotulo: 'CNPJ', mascara: formatarCnpj, limpar: digitos, inputMode: 'numeric' },
        { id: 'telefone', rotulo: 'Telefone', mascara: formatarTelefone, limpar: digitos, inputMode: 'tel' },
        { id: 'email', rotulo: 'E-mail', tipo: 'email' },
        { id: 'obs', rotulo: 'Observações', tipo: 'texto-longo', largo: true, max: 400 },
      ]}
      validar={(f) => {
        const e = {}
        if (f.cnpj && !cnpjValido(f.cnpj)) e.cnpj = 'CNPJ inválido.'
        if (f.email && !emailValido(f.email)) e.email = 'E-mail inválido.'
        return e
      }}
      colunas={[
        { id: 'razaoSocial', titulo: 'Razão social' },
        { id: 'fantasia', titulo: 'Fantasia' },
        { id: 'cnpj', titulo: 'CNPJ', render: (f) => (f.cnpj ? formatarCnpj(f.cnpj) : '—') },
      ]}
    />
  )
}
