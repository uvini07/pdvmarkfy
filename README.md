# PDV Sua Coxinha

Sistema de ponto de venda da rede Sua Coxinha: **caixa**, **cozinha**, **painel de senhas** e
**retaguarda**, com as funções do PDV Legal e a identidade da marca (cores, Satoshi, logo, fotos dos
produtos e dos sabores, gota e mascote).

**Login no servidor**: usa o mesmo Firebase do app e do site (`suacoxinhaapp`). Usuários, perfis,
PINs e computadores liberados moram lá, e quem decide quem entra são as funções `pdv*` do
repositório **sua-coxinha-app** (`functions/pdv/`), com as regras em `firestore.rules` de lá.

Os **outros dados** (vendas, cardápio, estoque…) ainda ficam no próprio navegador (IndexedDB) até
as próximas fases. Toda leitura e gravação deles passa por `src/dados/banco.js`, então trocar pelo
banco de verdade muda só esse arquivo.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # regras de dinheiro, estoque e segurança
npm run build      # versão para publicar, em dist/
```

Para testar o login sem tocar no banco de verdade: no **sua-coxinha-app**, rode
`npx firebase emulators:start --only auth,firestore,functions`; aqui, crie um `.env.local` com
`VITE_EMULADORES=true` e rode `npm run dev`.

No primeiro acesso de um computador, alguém com acesso às configurações entra com o **Google** e o
PDV grava o cardápio inicial (com ou sem **dados de demonstração**: duas semanas de vendas nas 9
filiais). Na primeira vez da rede, o administrador é criado nesse login. Não há usuário de
demonstração com PIN conhecido: cada pessoa é cadastrada em **Retaguarda › Usuários**.

Para virar **caixa ou cozinha**, o computador precisa ser **liberado** uma vez por um gerente (aba
Caixa → *Liberar com o Google*). Depois, cada pessoa escolhe o nome e digita o PIN. Um computador
que sumir é desligado em **Retaguarda › Segurança e backup**.

## As quatro telas

| Tela | Endereço | Quem usa |
| --- | --- | --- |
| Caixa | `#/caixa` | atendente, com PIN, num computador liberado |
| Cozinha | `#/cozinha` | cozinha, com PIN; fica ligada o dia todo |
| Painel de senhas | `#/painel/<filial>` | TV do salão; sem login, mostra só número e primeiro nome |
| Retaguarda | `#/admin` | gerente e franqueadora, com a conta Google cadastrada |

Caixa, cozinha e painel abertos no **mesmo computador** (ou em abas/monitores dele) se atualizam
sozinhos. Computadores diferentes só vão compartilhar dados quando o banco de dados entrar — vale
também para as mesas: o celular do garçom só enxerga as contas do caixa quando houver servidor.

### Caixa

Inspirado nos PDVs de balcão mais usados (Toast, Square, Saipos):

- grupos em **gotas** com a foto do produto, à esquerda; produtos com foto no meio; a **comanda**
  (papel branco) à direita, com o botão **Cobrar** sempre à vista;
- busca por nome, código ou **leitor de código de barras** (F2);
- sabores e adicionais com mínimo e máximo (ex.: caixa de 50 com até 5 sabores); adicionais
  somam preço;
- promoções automáticas por dia, hora e filial;
- desconto por item ou no pedido, com motivo e limite; acima do limite, **PIN do gerente**;
- tirar item ou cancelar pedido sempre com motivo;
- comer aqui, viagem ou encomenda; nome para chamar; CPF na nota (validado);
- pagamento dividido em várias formas, troco com notas rápidas, senha do pedido grande na tela;
- cupom e comanda em impressora térmica de 80 mm;
- pedidos em espera (F4), pedidos do dia com reimpressão e cancelamento, produto esgotado;
- abertura com fundo de troco, sangria, suprimento e **fechamento cego**;
- atalhos: F2 busca, F8 desconto, F4 espera, F6 mesas, F9 cobrar (ou lançar na mesa);
- funciona em computador, tablet e celular.

### Mesas

Nas lojas com o salão montado na retaguarda, o caixa ganha o botão **Mesas** (F6), com o mapa ou
a lista das mesas ao vivo: livre, ocupada (amarelo), pediu a conta (azul), sem pedido há tempo
(contorno laranja) e prato pronto para servir (selo verde), com tempo, valor e pessoas.

- **Atribuir o pedido à mesa**: o atendente monta o pedido e toca em **Mesa** na comanda; o botão
  amarelo vira **Lançar na mesa** e os itens vão na hora para a cozinha. Ou abre a mesa pelo mapa
  (com quantas pessoas e um nome, se quiser) e lança dali.
- A conta da mesa junta as rodadas de pedido, cada uma com o andamento na cozinha (na fila,
  preparando, pronto, servido). A cozinha vê **Mesa 5** em destaque e o caixa recebe o aviso quando
  o prato fica pronto.
- **Pré-conta** impressa para o cliente conferir; **taxa de serviço** (10%, configurável e opcional
  para o cliente); **desconto** na conta; **dividir em partes iguais**; **pagamento parcial** de quem
  vai embora antes, guardado na conta; **fechar a conta**, que vira uma venda como as do balcão.
- **Trocar de mesa**, **juntar mesas**, **mover um item** lançado na mesa errada (sem a cozinha
  fazer de novo) e **cancelar item ou conta** com motivo e, se preciso, autorização de gerente.
- O caixa não fecha enquanto houver conta aberta com dinheiro recebido nele, e avisa das mesas
  ainda abertas.
- O celular ou tablet do garçom pode entrar **só para as mesas**, sem abrir caixa: abre mesas e
  manda os pedidos para a cozinha; receber fica para o caixa.

### Cozinha e painel

Pedidos em três colunas (na fila, preparando, pronto) com cronômetro que muda de cor, aviso
sonoro de pedido novo, e painel de senhas amarelo para a TV com a chamada do pedido pronto.

### Retaguarda

Mesma organização do PDV Legal, mais o salão:

- **Painel**: vendido, ticket médio, cancelamentos, estornos e descontos, com comparação ao
  período anterior; vendas por dia e por hora, mais vendidos, formas de recebimento, por filial,
  estoque acabando. Filtros de período, horário e filiais.
- **Cardápio**: produtos (ficha com principal, configurações, preço por filial, sabores e
  adicionais, composição e fiscal), grupos (ordem e foto das gotas), classes, sabores e adicionais.
- **Preços**: tabela por filial, copiar de outra filial, reajuste em lote, promoções.
- **Estoque**: saldo por filial, entrada, saída, perda, transferência, inventário, produção e
  **importação do XML da NF-e** do fornecedor. A venda baixa o estoque sozinha (pela composição e
  pelos sabores escolhidos).
- **Financeiro**: conferência dos caixas fechados; contas a pagar e receber com resultado do mês.
- **Salão e mesas**: **Montar o salão** é um editor de planta em que o cliente desenha a loja como
  ela é, separada por ambientes (salão, varanda, 2º andar…): mesas quadradas, retangulares,
  redondas e banquetas com as cadeiras, e referências como balcão, parede, porta, planta, área e
  texto. Arrastar, girar, mudar o tamanho, alinhar, duplicar, várias mesas de uma vez, grade,
  zoom, desfazer e atalhos de teclado; tudo salvo sozinho. Começa de um modelo pronto ou copiando o
  salão de outra filial. Para salões grandes (100, 200 mesas): criar até 200 mesas em fileiras
  com prévia, começo e prefixo da numeração (101…, V1…); renumerar uma seleção por fileiras,
  zigue-zague ou colunas; trocar o formato de várias de uma vez; e achar uma mesa pelo número em
  qualquer ambiente. **Mesas agora** mostra o salão ao vivo, os números do dia e o que pede
  atenção (prato pronto esperando, conta pedida, mesa sem pedido, mesa aberta há horas).
- **Análise das mesas** (no caixa e em Mesas agora): todas as mesas em cartões lado a lado, com
  número, valor e tempo; contadores que filtram (livres, ocupadas, pediram a conta, pedem
  atenção), ordem por número, mais tempo ou maior valor, e busca que filtra enquanto digita. Vira
  a visão padrão quando a loja tem mais de 40 mesas.
- **Relatórios**: por dia, produto, forma de pagamento, atendente, filial, mesa (contas, pessoas,
  tempo médio, gasto por pessoa), taxa de serviço por garçom, cancelamentos e descontos, venda a
  venda; exporta para Excel (CSV).
- **Pessoas**: clientes (CPF mascarado), fornecedores, usuários e perfis de acesso.
- **Administrativo**: filiais, pontos de venda, formas de pagamento, motivos de cancelamento,
  tipos de desconto e configurações.
- **Comunicados** da franqueadora para as lojas (o caixa mostra os não lidos).
- **Segurança e backup**: registro de tudo, verificação de integridade, backup e restauração.

## Segurança

Resumo em [`SEGURANCA.md`](SEGURANCA.md): PIN conferido no servidor (o hash nunca chega ao
navegador), bloqueio por tentativas no servidor, retaguarda com Google, computadores liberados,
perfis com permissões, autorização de gerente, bloqueio de tela por inatividade, registro de
auditoria encadeado por hash, backup com soma de verificação, CSV sem injeção de fórmula, CPF
mascarado e cabeçalhos de segurança na publicação. O mesmo arquivo lista o que precisa de servidor
para valer em produção.

## Estrutura

```
src/
  dados/        banco (IndexedDB), cardápio inicial, vendas, caixa, estoque, preços,
                permissões, auditoria, backup, relatórios, demonstração,
                salão (planta) e mesas (contas e rodadas)
  firebase/     conexão com o Firebase e o login (funções pdv* do sua-coxinha-app)
  estado/       sessão do usuário e quem está logado segundo o servidor
  lib/          dinheiro (centavos), datas, validação, segurança (hash), CSV, NF-e
  componentes/  botões, campos, janelas, tabela, gráficos, teclado de PIN, impressão,
                desenho do salão e conta da mesa
  telas/        Configuracao, Entrar, Bloqueio
    caixa/      Caixa, Catalogo, Comanda, EscolhaProduto, Pagamento, Desconto, Mesas…
    cozinha/    Cozinha, PainelSenhas
    admin/      Painel, Produtos, Grupos, Modificadores, Precos, Estoque, Financeiro,
                Salao (editor), MesasAgora…
  estilos/      tokens da marca, base, componentes e um arquivo por área
public/
  fontes/       Satoshi (licença livre para uso comercial)
  marca/        logo, gota, selo (do site)
  fotos/        produtos, sabores e molhos (do site, em .webp)
testes/         node --test
```

## Documentos

- [`ANOTACOES-PDV.md`](ANOTACOES-PDV.md) — levantamento do vídeo do PDV Legal.
- [`REFERENCIA-CADASTROS.md`](REFERENCIA-CADASTROS.md) — cadastros vistos no vídeo.
- [`SEGURANCA.md`](SEGURANCA.md) — proteções e o que falta para produção.
