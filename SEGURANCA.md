# Segurança do PDV

## O que já está protegido

### Acesso

- **PIN e senha nunca são guardados.** Só o hash PBKDF2-SHA256 (210 mil iterações) com sal
  aleatório por usuário (`src/lib/seguranca.js`). Backup e tela de usuários não mostram nem o hash.
- **Conferência em tempo constante**, para o tempo de resposta não revelar parte do hash.
- **PIN fraco é recusado**: sequência (1234, 9876), repetição (0000) e menos de 4 números.
  **Senha fraca é recusada**: menos de 8 caracteres, sem letra e número, comum ou com o nome.
- **Bloqueio por tentativas**: 5 erros bloqueiam o usuário por 1 minuto, dobrando até 30 minutos.
  O gerente desbloqueia em Usuários.
- **Login inexistente responde igual a senha errada**: não dá para descobrir quais logins existem.
- **Bloqueio de tela por inatividade** (5 minutos, configurável): pede o PIN de novo sem perder o
  pedido em andamento. A cozinha e o painel não bloqueiam (ficam ligados sozinhos).
- **Sessão expira** em 12 horas (configurável) e acaba ao fechar a aba. Usuário desativado perde
  a sessão na hora.

### Permissões

- **Perfis de acesso** (Administrador, Gerente, Atendente, Cozinha e os que forem criados) com
  25 permissões separadas. As telas escondem o que o perfil não pode fazer.
- **Autorização de supervisor**: cancelar venda, estornar, desconto acima do limite, sangria,
  abrir/fechar caixa e marcar esgotado, quando o perfil não pode, pedem o PIN de um gerente da
  mesma filial na hora. Fica registrado quem pediu e quem autorizou.
- **Filiais**: cada usuário só vê e opera as filiais dele.
- **Permissões novas** entram sozinhas no perfil Gerente uma única vez (se o administrador tirar
  depois, não voltam). O perfil Administrador é fixo e sempre tem todas, inclusive as que vierem.
- **Montar o salão** tem permissão própria. Mesa com conta aberta não pode ser apagada nem tirada
  de uso no editor.

### Dinheiro

- Valores sempre em **centavos inteiros**: nada de erro de arredondamento.
- **Fechamento cego**: o operador conta o caixa sem ver o valor esperado; a diferença vai para a
  conferência do gerente.
- Todo cancelamento, item tirado e desconto exige **motivo** e aparece nos relatórios.
- **Senha do pedido** gerada dentro de transação do banco: dois caixas nunca repetem a senha.
- **Mesas**: item lançado não some — cancelado ou movido, fica na rodada marcado, com quem fez,
  o motivo e quem autorizou. Cancelar item ou conta pede a permissão de tirar item (ou o PIN de um
  gerente); desfazer um pagamento parcial pede a de cancelar venda. Tirar a taxa de serviço fica
  registrado.
- **Pagamento parcial** guarda o caixa que recebeu: o fechamento de cada caixa conta o que entrou
  nele, e o caixa não fecha enquanto uma conta aberta tiver dinheiro recebido ali.
- As **rodadas da mesa** ficam num registro separado da conta: a cozinha mudando o andamento e o
  caixa lançando mais na mesma hora nunca apagam a gravação um do outro.

### Registro de segurança (auditoria)

- Tudo o que muda dinheiro, preço, estoque, cadastro ou acesso vira um registro: quem, quando,
  o quê e em qual filial. Inclui tentativas de acesso erradas, autorizações e quem viu um CPF
  completo.
- Os registros são **encadeados por hash** (cada um carrega o hash do anterior). A verificação em
  Segurança e backup aponta exatamente onde alguém apagou ou alterou um registro.
- Uma **marca d'água** guarda o maior número de sequência já gravado. Apagar os *últimos*
  registros deixaria a corrente 1..k íntegra, mas a verificação percebe que o fim encolheu e
  acusa (detecção; sem servidor não há como *impedir*, só flagrar).
- Uma trava entre abas (Web Locks) impede que caixa e cozinha abertos juntos bifurquem a corrente.

### Dados

- **IndexedDB, registro por registro**: uma aba nunca sobrescreve a venda gravada por outra.
  Contadores (estoque, senhas) somam dentro da transação.
- **Armazenamento persistente** pedido ao navegador, para ele não apagar os dados com o disco cheio.
- **Backup com soma SHA-256**: arquivo alterado ou corrompido é recusado na restauração.
- **CPF do cliente mascarado** (`***.982.247-**`) em listas e no cupom. O CPF inteiro só para quem
  tem a permissão, e cada visualização fica no registro (LGPD).
- **Cliente com consentimento**: o cadastro marca se aceita receber ofertas.
- **CSV sem injeção de fórmula**: célula que começa com `= + - @` vira texto no Excel.
- **XML da NF-e** lido com o DOMParser em modo XML, que não executa nada; limite de tamanho,
  chave de acesso conferida e nota repetida recusada.
- **Entradas limpas**: texto livre sem caracteres de controle e com tamanho máximo; React escapa
  tudo o que vai para a tela (nenhum `innerHTML`).

### Publicação (`vercel.json`)

- **Content-Security-Policy** só com recursos do próprio domínio (sem script de terceiros, sem
  `eval`, sem iframe).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Strict-Transport-Security`, `Permissions-Policy` (sem câmera, microfone, localização).
- `noindex`: o PDV não aparece no Google.
- Nenhuma dependência além de React (menos código de terceiros, menos risco).

## Limites enquanto não há servidor

Sem banco de dados e sem servidor, **a proteção vale contra o uso normal da loja, não contra quem
tem acesso técnico ao computador**:

1. **Os dados ficam no computador.** Quem abrir as ferramentas de desenvolvedor do navegador
   consegue ler e alterar o IndexedDB. A auditoria encadeada **detecta** a alteração, mas não a
   impede. Use contas de Windows separadas e não deixe o caixa com acesso de administrador.
2. **Cada computador tem os próprios dados.** O painel da franqueadora só soma todas as lojas
   quando houver servidor.
3. **Backup manual.** Se o computador quebrar, só volta o que estiver no último backup. A
   retaguarda lembra todo dia.
4. **Sem nota fiscal.** O cupom sai como “não fiscal”.

## Para colocar em produção (com o banco de dados)

- [ ] Servidor com autenticação própria: conferir PIN e senha no servidor, sessão em cookie
      `HttpOnly; Secure; SameSite=Strict`, limite de tentativas por IP.
- [ ] Banco com permissões por perfil e por filial aplicadas **no servidor** (as telas só
      escondem; quem decide é o servidor).
- [ ] Auditoria gravada no servidor, só de inclusão (ninguém edita nem apaga).
- [ ] Backup automático diário do banco, com cópia fora da nuvem principal.
- [ ] HTTPS obrigatório (já configurado no `vercel.json`).
- [ ] **NFC-e**: certificado digital A1 de cada CNPJ guardado no servidor (nunca no navegador),
      CSC da Sefaz-SP e, na prática, uma API fiscal contratada (Focus NFe, PlugNotas, NFE.io…).
- [ ] **Manifesto do destinatário** (buscar notas na Sefaz): mesmo certificado, no servidor.
- [ ] Integração com maquininha (TEF/POS) para não digitar valor de cartão.
- [ ] LGPD: aviso de privacidade no cadastro de cliente, prazo para apagar dados de quem pedir.
- [ ] Fonte Brown Beige: comprar a licença comercial antes de usar no material da loja (o PDV usa
      só a Satoshi; o logo vem em SVG).
