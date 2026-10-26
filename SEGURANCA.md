# Segurança do PDV

## O que já está protegido

### Acesso (no servidor)

O login usa o Firebase do app e do site (`suacoxinhaapp`). Quem decide quem entra são as funções
`pdv*` do repositório **sua-coxinha-app** (`functions/pdv/`), não o navegador.

- **O PIN é conferido no servidor.** O hash (PBKDF2-SHA256, 210 mil iterações, sal por usuário)
  fica em `pdv_segredos`, que nenhum navegador lê — nem o admin do clube. Sem o hash, não há como
  testar PINs fora da tela. O navegador não guarda mais usuários nem hashes: a atualização apaga
  as coleções antigas do IndexedDB.
- **Bloqueio por tentativas no servidor**: 5 erros bloqueiam a pessoa por 1 minuto, dobrando até
  30. A conferência roda em transação, então tentativas em paralelo não furam o limite. O gerente
  desbloqueia em Usuários.
- **PIN fraco é recusado** (no formulário e de novo no servidor): sequência (1234, 9876),
  repetição (0000) e menos de 4 números.
- **Computadores liberados**: caixa e cozinha só abrem num computador que um gerente liberou com o
  Google dele. Só aparecem as pessoas daquela loja. Um computador que sumir é desligado em
  Segurança e para de funcionar na hora.
- **Retaguarda com Google**: o PDV não guarda senha. Entra quem tem o e-mail cadastrado em
  Usuários (verificado pelo Google); conta sem cadastro é recusada e fica registrada.
- **A identidade vem do servidor**: cada computador e cada pessoa entram com o login anônimo do
  Firebase (a retaguarda, com o Google); depois do PIN ou do Google, a função grava em
  `pdv_sessoes` quem aquele login é. O navegador não consegue gravar ali, então editar o
  sessionStorage (ou o banco local) não troca de pessoa — a sessão cai.
- **Pessoa de outra filial, inexistente ou desligada responde igual a PIN errado.**
- **Bloqueio de tela por inatividade** (5 minutos, configurável): pede o PIN de novo (conferido no
  servidor) sem perder o pedido em andamento. Se a internet cair, destrava com o PIN de quem
  entrou, até 5 tentativas; depois espera a conexão. A cozinha e o painel não bloqueiam.
- **Sessão vence em até 12 horas** (o servidor não aceita a sessão depois disso) e acaba ao fechar a
  aba. Usuário desativado perde a sessão na hora, em todos os computadores.
- **Não há usuário de demonstração com PIN conhecido.**

### Permissões

- **Perfis de acesso** (Administrador, Gerente, Atendente, Cozinha e os que forem criados) com
  25 permissões separadas. As telas escondem o que o perfil não pode fazer.
- **Autorização de supervisor**: cancelar venda, estornar, desconto acima do limite, sangria,
  abrir/fechar caixa e marcar esgotado, quando o perfil não pode, pedem o PIN de um gerente da
  mesma filial na hora. O servidor confere o PIN, a permissão e a filial, e grava a autorização
  (`pdv_autorizacoes`) com quem pediu e quem autorizou.
- **Filiais**: cada usuário só vê e opera as filiais dele.
- **Ninguém dá o que não tem** (conferido no servidor): quem cadastra usuários só dá perfis com
  permissões que ele mesmo tem e só nas filiais dele; não mexe em quem tem mais acesso nem em gente
  de outra loja. Perfis valem para a rede inteira, então só quem cuida de todas as filiais os
  altera. O dono da rede só é alterado por ele mesmo e continua administrador de tudo.
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

- **Acessos no servidor** (`pdv_auditoria`): entradas, PIN errado, bloqueios, autorizações,
  mudanças de usuário e de computador, de todos os computadores. Só as funções gravam; ninguém
  edita nem apaga. Aparece em Segurança › Acessos (servidor).
- Tudo o que muda dinheiro, preço, estoque, cadastro ou acesso vira também um registro local:
  quem, quando, o quê e em qual filial. Inclui quem viu um CPF completo.
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

- **Content-Security-Policy** só com recursos do próprio domínio, mais os endereços exatos do
  Firebase e do login do Google (sem `eval`, sem outros scripts de terceiros). O
  `Cross-Origin-Opener-Policy` é `same-origin-allow-popups`, que a janela do Google exige.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Strict-Transport-Security`, `Permissions-Policy` (sem câmera, microfone, localização).
- `noindex`: o PDV não aparece no Google.
- Dependências só do React e do Firebase (o mesmo SDK do app e do site).

## Limites enquanto os dados ainda são locais

O login já está no servidor. As **vendas, o cardápio, o estoque e o financeiro** ainda ficam no
navegador (fases 2 e 3), então, para esses dados, **a proteção vale contra o uso normal da loja,
não contra quem tem acesso técnico ao computador**:

1. **Os dados de venda ficam no computador.** Quem abrir as ferramentas de desenvolvedor do
   navegador consegue ler e alterar o IndexedDB. A auditoria encadeada **detecta** a alteração,
   mas não a impede. Use contas de Windows separadas e não deixe o caixa com acesso de
   administrador.
2. **Cada computador tem os próprios dados.** O painel da franqueadora só soma todas as lojas
   quando as vendas forem para o servidor.
3. **Backup manual.** Se o computador quebrar, só volta o que estiver no último backup. A
   retaguarda lembra todo dia. (Usuários e perfis não dependem do backup: estão no servidor.)
4. **Entrar precisa de internet** (PIN e Google são conferidos no servidor). Quem já entrou
   continua trabalhando se a conexão cair.
5. **Sem nota fiscal.** O cupom sai como “não fiscal”.

## Para publicar o login (uma vez)

1. Juntar o PR do **sua-coxinha-app** no `main`: o GitHub Actions publica as regras e as funções.
2. Firebase → Authentication → Método de login: ligar o provedor **Anônimo** (gratuito). É
   com ele que o computador e a pessoa do caixa entram. Não precisa de IAM nem de permissão
   extra no Google Cloud.
3. Firebase → Authentication → Configurações → **Domínios autorizados**: adicionar o domínio
   onde o PDV for publicado (para a janela do Google).
4. Domínio próprio do PDV (fora de `*.vercel.app`): variável `PDV_ORIGENS` no GitHub do app.
5. Publicar o PDV e entrar na retaguarda com `marcelinhojordao07@gmail.com`: o administrador da
   rede é criado nesse primeiro login.

## Para colocar em produção (próximas fases)

- [x] Conferir PIN no servidor, com limite de tentativas no servidor.
- [x] Sessão gravada pelo servidor (`pdv_sessoes`, com prazo), não pelo navegador; sair apaga na hora.
- [x] Usuários, perfis e permissões decididos **no servidor**, com filial e sem escalada de
      privilégio.
- [x] Registro de acessos gravado no servidor, só de inclusão.
- [ ] Vendas, caixa, estoque e cadastros no Firestore, com regras por perfil e por filial (as
      telas só escondem; quem decide é o servidor) — fases 2 e 3.
- [ ] Auditoria de vendas e caixa no servidor, só de inclusão, e autorizações de supervisor
      exigidas pelas regras (cada uma usada uma vez).
- [ ] Backup automático diário do banco, com cópia fora da nuvem principal.
- [ ] HTTPS obrigatório (já configurado no `vercel.json`).
- [ ] **NFC-e**: certificado digital A1 de cada CNPJ guardado no servidor (nunca no navegador),
      CSC da Sefaz-SP e, na prática, uma API fiscal contratada (Focus NFe, PlugNotas, NFE.io…).
- [ ] **Manifesto do destinatário** (buscar notas na Sefaz): mesmo certificado, no servidor.
- [ ] Integração com maquininha (TEF/POS) para não digitar valor de cartão.
- [ ] LGPD: aviso de privacidade no cadastro de cliente, prazo para apagar dados de quem pedir.
- [ ] Fonte Brown Beige: comprar a licença comercial antes de usar no material da loja (o PDV usa
      só a Satoshi; o logo vem em SVG).
