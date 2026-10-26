# Auditoria de segurança — PDV Sua Coxinha

Revisão white-box (código-fonte) feita em 2026-10-26, no papel de atacante: testei o
sistema contra os vetores que de fato derrubam PDVs e PWAs no mundo real (OWASP Top 10,
extração de armazenamento local, adulteração de auditoria, XSS, XXE, injeção de fórmula,
enumeração de usuário). Não há servidor nem infraestrutura em produção a atacar ao vivo —
o valor está em achar e fechar as falhas no código, então esta auditoria é estática.

**Veredito curto:** para um PDV que roda 100% no navegador, o sistema está **bem
protegido**. Quase todas as brechas que sobraram são o limite conhecido de "não há
servidor" (já descrito no `SEGURANCA.md`). O único conserto de fundo para as mais graves
é o backend, que já está no roadmap.

---

## O que testei e passou (não são brechas)

| Vetor de ataque | Resultado |
|---|---|
| **XSS** (injeção de script na tela) | Sem `innerHTML`, `dangerouslySetInnerHTML`, `eval` ou `document.write`. O React escapa tudo, inclusive a impressão (via portal). Não achei vetor. |
| **XXE** no XML da NF-e | `DOMParser` do navegador não resolve entidades externas nem carrega DTD externo. Há limite de tamanho (5 MB), chave de acesso validada e nota repetida recusada. OK. |
| **Injeção de fórmula em CSV** | Célula que começa com `= + - @` ganha apóstrofo; aspas/quebras escapadas. OK. |
| **Enumeração de usuário no login da retaguarda** | Login inexistente responde igual a senha errada, com atraso fixo de 400 ms. OK. |
| **Open redirect / tabnabbing** | `window.open` só com rota interna (`#hash`) e `noopener`; download com `rel="noopener"`. OK. |
| **Segredos no repositório** | Nenhum. Só as credenciais de demonstração (ver achado #7), que têm aviso na tela. |
| **Proteção de rotas** | `App.jsx` barra não-autenticado e recheca permissão por área; filial isolada. OK. |
| **Cabeçalhos HTTP** (`vercel.json`) | CSP restritiva (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), HSTS com preload, `nosniff`, `X-Frame-Options: DENY`, `noindex`. OK. |
| **Hash de credencial** | PBKDF2-SHA256, 210k iterações, sal aleatório por usuário, comparação em tempo constante. OK. |
| **Superfície de dependências** | Mínima: só React + React-DOM (+ Vite em dev). Pouco código de terceiros = pouco risco de cadeia de suprimentos. |
| **Dinheiro** | Sempre em centavos inteiros; sem erro de ponto flutuante. |

> A falha atual de `npm test` é **ambiental** (o `node_modules` não está instalado, então
> o `react` importado por `banco.js` não resolve). Não é defeito de código: com as
> dependências instaladas os testes rodam.

---

## Achados acionáveis (por severidade)

### 1. [ALTO — já documentado] Toda a autorização é no cliente: bypass por devtools
A regra de acesso vive no navegador. Quem tem acesso técnico à máquina do caixa pode,
pelas ferramentas de desenvolvedor:

- Editar `sessionStorage['scpdv:sessao']` para `{ usuarioId: <id de um admin>, modo: 'admin' }`
  e recarregar → vira administrador **sem** PIN nem senha. A sessão é re-resolvida do banco,
  mas a *identidade* vem de um armazenamento não autenticado.
- Zerar `tentativas` / `bloqueadoAte` no IndexedDB → anula o bloqueio por tentativas.
- Alterar preço, estoque ou vendas direto no IndexedDB.

Este é exatamente o limite "sem servidor" que o `SEGURANCA.md` já reconhece. **O único
conserto real é o backend** (sessão em cookie `HttpOnly`, permissões decididas no servidor).
Mitigações operacionais enquanto isso:
- Conta do Windows separada e **sem** perfil de administrador para o caixa.
- Chrome em quiosque com devtools desligado por política (`DeveloperToolsAvailability`).
- Tratar o backend como prioridade de segurança, não só de funcionalidade.

*Mapeamento:* OWASP A01 (Broken Access Control) / A04 (Insecure Design) — "confiança no cliente".

### 2. [MÉDIO] PIN de 4–6 dígitos é quebrável offline em segundos
Com `hash` + `sal` + `iteracoes` lidos do IndexedDB, o espaço de 10⁴–10⁶ PINs é força-bruta
trivial — mesmo com 210k iterações, um PC comum testa tudo em segundos a minutos. O bloqueio
progressivo **não** protege ataque offline (ele só vale online, na tela).

Consequência mais séria: recuperar o PIN de um **gerente** permite forjar "autorizações de
supervisor" que entram na auditoria como **legítimas**, corrompendo a atribuição do log.

Conserto de fundo: rate-limit no servidor. Enquanto não há: preferir **senha forte** (não PIN)
para funções de gerência sempre que a tela permitir. Aumentar iterações ajuda pouco contra 4
dígitos. Honestamente, a correção é o backend.

### 3. [MÉDIO] Truncar o fim da auditoria é indetectável — ✅ CORRIGIDO (marca d'água)
`verificarCorrente()` valida o encadeamento de 1 a N, mas nada guarda, de forma independente,
qual era o maior `seq` conhecido. Apagar os **últimos** registros (p.ex. encobrir a ação mais
recente) deixa a corrente 1..k internamente válida → a verificação diz "OK".

Melhoria barata (não resolve 100% sem servidor, mas pega truncamento acidental e casual):
guardar em `config` (ou doc separado) o último `seq` + `hash` conhecido ("marca d'água") e
alertar quando o fim atual for menor que o registrado. Idealmente a marca vai para o servidor
quando ele existir.

> **Implementado.** `gravar()` em `src/dados/auditoria.js` agora grava
> `config.auditoriaSeq` / `config.auditoriaHash` (o maior `seq` já visto, com guarda de
> monotonicidade). `verificarCorrente()` compara o fim atual com a marca e devolve
> `{ ok:false, truncado:true, marca, atual }` quando o fim encolheu ou o registro na marca
> trocou de hash. A tela **Segurança › Integridade do registro** mostra "Faltam registros no
> fim". Ressalva honesta: a marca mora no mesmo IndexedDB, então um atacante que também
> edite `config` ainda escapa — isto eleva a barra e pega perda acidental/casual; a
> prova real continua dependendo do servidor.

### 4. [MÉDIO] A soma do backup detecta corrupção, não adulteração
O campo `soma` é o SHA-256 de `dados`, guardado **dentro do próprio arquivo**. Quem edita o
backup recalcula a soma e ela confere. Ou seja: a checagem pega arquivo **corrompido**, não um
arquivo **deliberadamente modificado**.

Impacto: um backup "envenenado" (recebido por e-mail/pendrive) pode injetar um usuário admin
com PIN conhecido do atacante e, ao restaurar, ainda **substitui toda a coleção `auditoria`**
(`importarTudo`), zerando o histórico. Restaurar exige permissão `admin.backup` (gerente), mas
o arquivo em si é controlável por terceiros.

Ações:
- Corrigir a redação do `SEGURANCA.md`: a soma protege contra *corrupção*, não contra
  *adulteração* (hoje o texto diz "arquivo alterado ou corrompido é recusado").
- Antes de substituir os dados, registrar na auditoria o `hash` da cabeça anterior, para que a
  restauração deixe rastro.
- Conserto de fundo: backup assinado no servidor (HMAC/assinatura).

### 5. [BAIXO — defesa em profundidade] `autorizar()` não revalida a filial
A UI já filtra supervisores por `acessaFilial`, e **todos** os chamadores de `pedirAutorizacao`
passam `filialId` (verificado). Mas a função `autorizar()` em si só checa `pode(permissao)`.
Quando migrar para servidor, a verificação de filial precisa estar **dentro** do `autorizar`
(servidor), não só na tela. Adicionar o check agora é barato e à prova de futuro.

### 6. [BAIXO] CSP permite `style-src 'unsafe-inline'`
Necessário pelos estilos inline do React. Risco baixo (exfiltração via CSS é limitada).
Opcional: mover estilos inline para classes e remover `unsafe-inline`, ou adotar Trusted Types
(`require-trusted-types-for 'script'`) como reforço. Não urgente.

### 7. [INFO] Credenciais de demonstração com PIN público
`ana/4821`, `bruno/7392` + senha `gerente2026`, `cozinha.morumbi/5170`. Já há aviso na
retaguarda e botão para apagar. Risco real só se a loja for para produção **sem** removê-las.
Sugestão: travar o "ir para produção" (ou exibir bloqueio, não só aviso) enquanto existir
usuário `demonstracao` ativo.

### 8. [INFO — qualidade] Viés de módulo em `novoId` (`b % 36`)
256 não é múltiplo de 36, então há leve viés estatístico nos IDs. IDs **não** são tokens de
segurança, então não é vulnerabilidade — só nota de qualidade. Se algum dia virar token, usar
amostragem por rejeição.

---

## Prioridade recomendada

1. **Backend** (resolve #1, #2 e a raiz de #3/#4) — é o item que muda o patamar de segurança.
2. #3 e #4 — melhorias baratas de detecção/registro que dá para fazer já, no cliente.
3. #5 e #7 — à prova de futuro e higiene de produção.
4. #6 e #8 — reforço opcional.
