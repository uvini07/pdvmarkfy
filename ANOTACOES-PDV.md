# Anotações para o PDV da Sua Coxinha

Levantamento feito a partir do vídeo de referência (sistema **PDV Legal**) e dos repositórios do
app (`sua-coxinha-app`) e do site (`sua-coxinha-cajamar`). Objetivo: ter as mesmas funcionalidades
do PDV Legal, com o visual todo da Sua Coxinha.

Os cadastros que aparecem no vídeo (filiais, grupos, classes, produtos, modificadores) estão
transcritos em [`REFERENCIA-CADASTROS.md`](REFERENCIA-CADASTROS.md) para servirem de dados de
exemplo enquanto não há banco.

---

## 0. O que chegou e o que falta

- **Chegou um vídeo só.** Os dois arquivos enviados são o mesmo arquivo (mesmo conteúdo, 4min09s).
  Ele mostra a **Retaguarda** (o painel web de administração, `admin.pdvlegal.com.br`), com narração.
- **Falta o vídeo da tela de registrar pedidos** (a frente de caixa do atendente). A própria
  narração cita esse vídeo: *"grupos de produtos, que é aquela parte que eu te mostrei no vídeo, que
  é para o atendente… que ele seleciona, tem as capinhas"*. A seção 3 lista o que dá para deduzir da
  frente de caixa pelas configurações da Retaguarda, mas precisa ser confirmada com esse vídeo.

Resumo da narração (transcrita do áudio):

> "Esse aqui é o site da PDV Legal, que eles chamam de **Retaguarda**, que é onde você faz todos os
> ajustes de cardápio, preço, de tudo." Dashboard por filial (vendas do dia, ticket médio,
> cancelamentos); Pessoas (clientes, fornecedores, perfis e usuários: atendente, franqueado);
> Produtos (grupos = as "capinhas" que o atendente toca; ficha do produto com preço, modificadores,
> estoque, composição, autoatendimento); **modificadores** = "você quer vender uma caixa e escolhe
> todos os sabores que vão dentro dela"; estoque com entrada e saída; **importação de XML**: "eles
> têm uma API que puxa as coisas da Sefaz… aparecem todas as notas do mês com o CNPJ da unidade, ele
> consegue importar e já dá entrada"; financeiro, administrativo, relatórios.
> No fim: *"acho que a viabilidade de fazer essa parada é muito trabalhosa"* — ver a seção 7
> (fases), que separa o que é rápido do que é difícil de verdade.

---

## 1. Estrutura geral do sistema de referência

O PDV Legal tem duas partes:

| Parte | Quem usa | O que faz |
| --- | --- | --- |
| **Frente de caixa** (PDV) | atendente / caixa da loja | registra pedidos, recebe pagamento, imprime na cozinha |
| **Retaguarda** (admin web) | franqueado, franqueadora | cardápio, preços por filial, estoque, financeiro, relatórios |

É **multi-filial**: tudo (vendas, preço, estoque) é por filial, e a Retaguarda filtra por uma, várias
ou todas.

### Layout da Retaguarda

- **Topo:** logo, botão de recolher o menu, ícones de alerta com contador (avisos e documentos
  pendentes), envelope de mensagens e menu do usuário logado (nome + avatar).
- **Menu lateral escuro**, com submenus que abrem no lugar (acordeão). A seta `›` indica submenu.
- **Botão flutuante de ajuda** `?` no canto inferior direito.
- **Padrão das listas:** título, botão `Novo +`, campo `Busca` + botão `Filtrar` (vira `Filtrado`
  quando há filtro, com uma lixeira para limpar), contador `N Registros`, tabela com colunas
  ordenáveis, selo de status (`Ativo` verde / `Desativado` vermelho) e ações por linha (editar,
  excluir e, em algumas, setas para reordenar).
- **Padrão das fichas:** barra com `← Voltar`, `Gravar`, `Opções ▾`; abas; botões `« Anterior` e
  `Próximo »` para andar entre as abas.
- **Mensagens:** modal "Aguarde" com barra de progresso; alerta "Opa" com ícone de exclamação e `OK`.

---

## 2. Retaguarda — tela por tela

### 2.1 Dashboard

Filtros no topo: **período** (intervalo de datas), **hora inicial**, **hora final**, **filiais**
(lista com busca, botões `Todas` / `Nenhuma`, seleção múltipla; mostra "Todas Filiais" ou o nome da
filial escolhida).

Abas: **Vendas PDV** (a única mostrada), Financeiro, Estoque, Pessoas, Painel de equipamentos.

Quatro cartões (ícone redondo colorido + valor + legenda):

| Cartão | Exemplo (todas as filiais, 21/10/2026) | Regra |
| --- | --- | --- |
| Total vendido | 5.025,16 — "229 vendas efetivadas" | soma das vendas concluídas |
| Ticket médio | 21,94 | total ÷ nº de vendas (5.025,16 ÷ 229 = 21,94, conferido) |
| Cancelamentos | 393,10 — "23 vendas com algum item cancelado" | soma dos itens cancelados |
| Estornos | 0,00 — "Nenhuma venda estornada" | vendas devolvidas depois de pagas |

Só a Max Morumbi no mesmo dia: 1.368,33 (69 vendas), ticket 19,83, cancelado 120,20 (7 vendas).

Painéis recolhíveis embaixo (seta para abrir, `+` para expandir): **Produtos mais vendidos**,
**Vendas por hora**, **Formas de recebimento**, **Faturamento por filial**.

### 2.2 Pessoas

Submenu: Clientes · Fornecedores · Perfil usuário PDV · Usuários PDV · Perfil usuário ADM ·
Usuários ADM.

Dois tipos de usuário, cada um com **perfis** (conjuntos de permissões):
- **PDV** — quem opera o caixa (atendente).
- **ADM** — quem entra na Retaguarda (franqueado, franqueadora).

(As telas internas não aparecem no vídeo.)

### 2.3 Produtos

Submenu: Produtos · Grupos · Classes · Modificadores.

#### Grupos ("Grupo de produtos & serviços")

São as **"capinhas"** que o atendente toca na frente de caixa. Colunas: Código, Descrição,
Nº itens, Status, **Cor** (hex, ex. `F1C40F`), **Imagem** (ícone branco sobre a cor), editar e
**setas para reordenar** (a ordem é a das capinhas no caixa).

Grupos da rede: G COXINHA, M COXINHA, P COXINHA, BEBIDAS, COPO MÁGICO, COMBOS, MAIS PEDIDOS,
KIT SNACKS, COBERTURA EXTRA, BOMBONIERE, ASSADOS, INSUMOS, Molhos.

Repare que **o grupo é o tamanho** (G COXINHA, M COXINHA) e **o produto é o sabor** (FRANGO G,
CAIPIRA G…): o atendente toca "G Coxinha" e depois o sabor. Um toque por item.

#### Classes ("Classe de produtos & serviços")

Mesmas colunas dos grupos (Código, Descrição, Nº produtos, Cor, Imagem, reordenar). Na ficha do
produto o campo **Classes** é de **seleção múltipla** (com "Todas"), ao contrário do Grupo, que é um
só. Ou seja: grupo = categoria principal; classe = etiqueta extra. Provavelmente as classes viram
atalhos/abas no caixa (ex.: "Mais pedidos") — **confirmar no vídeo do caixa**.

#### Produtos (lista)

114 registros. Colunas: Código, Nome (ordenável), Grupo, Status, editar, excluir. Produto desativado
não tem botão de excluir. Insumos (embalagens, recheios PP, caixas) também são produtos, no grupo
INSUMOS — servem para estoque e composição.

#### Ficha do produto

Cabeçalho: `NOME - UNIDADE - CÓDIGO` (ex.: `FRANGO G - UN - UNIDADE - 73`). Sete abas:

**1. Obrigatório**
- Descrição cupom · Status · Código de venda
- Classes (múltipla, com "Todas") · Grupo · Unidade estoque (ex. `UN - UNIDADE`) · Categoria financeiro
- **Unidades de compra**: Unidade, Fator de conversão compra → estoque, EAN/GTIN, `Adicionar unidade`;
  tabela abaixo (ex.: `PT - PACOTE`, fator 115 — um pacote entra como 115 unidades no estoque).

**2. Configurações** (quase tudo SIM/NÃO)

| Campo | Exemplo | Para que serve (dedução) |
| --- | --- | --- |
| Fornecedor / Fornecedor exclusivo | Nenhum / NÃO | |
| Baixa estoque | "Baixa ele mesmo" | o que sai do estoque ao vender (ele ou a composição) |
| Local do estoque | | |
| Campo fracionado | NÃO | permite quantidade quebrada (kg) |
| Chama quantidade | NÃO | caixa pergunta a quantidade ao tocar |
| Chama balança | NÃO | lê o peso da balança |
| Chama modificadores | NÃO | abre a escolha de modificadores ao tocar |
| Origem | Nacional | fiscal |
| Código EAN/GTIN | (alerta amarelo se vazio) | código de barras |
| Impressora – expedição/produção | COZINHA | onde o pedido imprime |
| Impressora 2 – KDS | Nenhum | tela da cozinha |
| Permite desconto | SIM | |
| Incide acréscimo | SIM | taxa de serviço/acréscimo |
| Autoatendimento | NÃO | aparece no totem |
| Favorito | NÃO | atalho no caixa |
| Permite edição do modificador na venda | NÃO | |
| Venda apenas para maiores de 18 anos | NÃO | cerveja |
| Pede preço na venda | NÃO | preço digitado na hora |
| Combo – tributado pelos modificadores | NÃO | fiscal |
| Balança etiquetadora / Dias de validade | NÃO / 0 | etiqueta de balança |
| Descrição detalhada | texto | |
| Descrição para produção / modo de preparo | texto | sai na comanda da cozinha |

**3. Preços, impostos e modificadores**
- Produto, Classificação (`Produto`), **Código NCM** (8 dígitos) e **Código CEST** (7 dígitos), com
  aviso "será validado no IBPT" e a descrição oficial embaixo (ex. NCM 19059090, CEST 1703101).
- **Uma linha por filial**: Último custo (só leitura) · Mark-up (%) · Estoque atual (só leitura) ·
  **Pausar** (tira o produto de venda naquela filial) · **Valor de venda** · botão Modificadores ·
  botão Tributos · botão Configurações · Grupo tributário (ex. ISENTO).
- O botão **Modificadores** abre um modal: escolher um *grupo de modificadores* e ver a tabela
  Grupo / Qtd mín / Qtd máx / Classificação.
- Exemplo: FRANGO G na Max Morumbi = **R$ 14,90** (igual ao Coxinha G do site).

**4. Estoque** — escolher filial, saldo atual, botão "Recarregar os dados de estoque", impressão.
Histórico limitado aos últimos 365 dias.

**5. Composição** (ficha técnica) — Rendimento, Unidade, Filial; adicionar linhas com Produto
estocável, Quantidade total, Baixa estoque (SIM/NÃO). Ao vender, baixa os componentes.

**6. Autoatendimento e imagens** — não aberta no vídeo (foto e textos para o totem).

**7. Histórico** — não aberta no vídeo.

#### Modificadores

Duas abas:

**Grupo** (o grupo de escolhas que aparece no caixa) — Descrição, **Classificação**
(`Observação` cinza ou `Adicional` amarelo), Impressora, **Qtd mín**, **Qtd máx**, Nº modificadores.

| Grupo | Classif. | Mín | Máx | Itens |
| --- | --- | --- | --- | --- |
| CINCO SABORES COXINHA | Observação | 1 | 5 | 11 |
| DOIS SABORES COXINHA | Observação | 1 | 2 | 11 |
| DOIS SABORES CHURROS | Observação | 1 | 2 | 2 |
| COXINHA GOURMET 3UND | Observação | 1 | 1 | 2 |
| COBERTURA COPO SALGADO | Observação | 0 | 1 | 2 |
| COBERTURA EXTRA COPO DOCE | Observação | 0 | 1 | 2 |
| COBERTURA EXTRA CHURROS | Adicional | 0 | 2 | 2 |
| COBERTURA EXTRA COXINHA | Adicional | 0 | 2 | 2 |

**Modificadores** (as opções) — Código, Descrição, **Baixa estoque** (SIM/NÃO), **Preço sugerido**
(ex.: Cheddar cobertura 5,00; Requeijão cobertura 5,00; sabores 0,00).

Como deve funcionar (dedução, bate com as regras do site): na **Caixa de Mini Gostosuras 50un** o
atendente escolhe de 1 a 5 sabores; cada sabor é um modificador ligado a um insumo (ex.
`FRANGO PP UN`) com "Baixa estoque = SIM", então a venda já tira do estoque o recheio certo. "Observação" = escolha sem custo; "Adicional" = soma o
preço ao item. Há também modificadores "– VIAGEM" (Caixa 100PP – Viagem, Combo Casal – Viagem),
que parecem marcar a embalagem para viagem.

### 2.4 Tabela de preços

Submenu: Tabela de preços · Copiar · Ajustes programados · Promoções. (Telas não abertas.)
Dedução: copiar preços de uma filial para outra, agendar reajuste para uma data, promoções por
período.

### 2.5 Estoque

Submenu: Movimentação · Consulta estoque.

**Movimentação de estoque** — botões `Imprimir` e `Opções ▾` com os tipos:
**Entrada · Saída · Transferência · Inventário · Ordem de produção · Pedido de compras**.
Lista: Código, Data, Doc/Obs, Filial, Valor, seta do tipo (↑ entrada), editar, excluir.

**Entrada** (aba "Entrada"):
- Lançamento (data) · Nº doc/observações · **Filial*** · Classificação movimento interno · Fornecedor
- Aviso: "Selecione a filial para incluir os itens".
- **Itens**: `Adicionar` (Adicionar produto | Adicionar grupo de produtos) · Leitor de código de
  barras · Produto (busca digitando o nome; mostra a unidade de estoque) · Quantidade · Total dos
  itens · `Adicionar produto`.

**Importar XML** (aba ao lado):
- Faixa amarela: "Você sabia que pode efetuar as movimentações de estoque com mais facilidade através
  do **Manifesto do Destinatário**? Também é possível pela DANFE/XML".
- `Buscar notas Sefaz` (abre um protocolo; enquanto processa mostra "Existe um protocolo em aberto,
  aguarde um minuto" e o alerta "Localizando notas. Tente novamente dentro de alguns instantes").
- "Último protocolo processado: 20/10/2026 11:00:20 – 18 notas localizadas".
- `Importar XML manual` e ajuda `?`.
- Tabela: Status (Autorizado), CPF/CNPJ, Nome do emissor, Número (botão que abre a nota), Série,
  Modelo (55), Valor, Emissão, Ciência, Confirm., Não realizado, Desconhecimento, Eventos (menu),
  **Importar** (dá entrada no estoque com os itens da nota).

### 2.6 Financeiro

Submenu: Acerto de caixa · Calendário financeiro · Contas a pagar · Contas a receber ·
Movimentação bancária · Contas bancárias · Plano de contas. (Telas não abertas.)

### 2.7 Administrativo

Submenu: **Filiais · Conferência de caixa · Formas de pagamento PDV · Pontos de vendas ·
Configurações · Motivos de cancelamento · Tipo de desconto**. (Telas não abertas, mas os nomes dizem
o que o caixa precisa: formas de pagamento, motivos para cancelar item, tipos de desconto, e os
pontos de venda = cada caixa/terminal da loja.)

### 2.8 Relatórios

Submenu: Financeiro · Vendas PDV · Listagens (cada um com sub-relatórios, não abertos).

### 2.9 Atendimento e Ajuda

Atendimento: **Comunicados** (com contador — avisos da franqueadora para as lojas) · Acerta EAN
produtos. Ajuda: central de ajuda.

---

## 3. Frente de caixa (registrar pedidos) — a confirmar com o 2º vídeo

O que as configurações da Retaguarda indicam que o caixa faz:

1. **Capinhas de grupos** com cor e ícone, na ordem definida em Grupos; ao tocar, mostra os
   produtos do grupo. Atalhos para **Favoritos** e provavelmente para **Classes**.
2. **Busca** por nome/código e **leitor de código de barras** (EAN).
3. Ao tocar no produto: se *Chama quantidade*, pergunta a quantidade; se *Pede preço*, pede o valor;
   se *Chama modificadores*, abre a escolha com mínimo/máximo (ex.: "escolha de 1 a 5 sabores").
   Adicionais somam preço; observações não.
4. **Carrinho** do pedido com itens, modificadores, quantidade, subtotal; cancelar item com
   **motivo de cancelamento** (aparece no dashboard como "vendas com algum item cancelado").
5. **Desconto** (só em produtos com "Permite desconto", pelos *tipos de desconto*) e **acréscimo**.
6. **Pagamento** com as *formas de pagamento PDV* (dinheiro com troco, débito, crédito, Pix…),
   possivelmente dividido em mais de uma forma.
7. **Envio para produção**: imprime na impressora do produto (COZINHA) ou manda para o KDS, com o
   "modo de preparo".
8. **Venda +18** pede confirmação (cerveja).
9. **Caixa**: abertura, sangria/suprimento, fechamento — base para *Acerto* e *Conferência de caixa*.
10. **Estorno** de venda já paga (cartão "Nenhuma venda estornada").
11. **Pausar** produto acabado na filial.
12. **Autoatendimento** (totem) com fotos e textos próprios.

Perguntas para o vídeo do caixa: é tela de toque? Tem mesa/comanda ou é só balcão? Tem nome/senha
do pedido para chamar o cliente? Pede CPF na nota? Como é o fechamento de caixa?

---

## 4. Identidade visual da Sua Coxinha (para o PDV)

Tudo abaixo já existe nos repositórios — nada inventado.

### Cores (guia de marca, `sua-coxinha-app/src/estilos/tokens.css` e `sua-coxinha-cajamar/src/styles/tokens.css`)

| Nome | Hex | Uso sugerido no PDV |
| --- | --- | --- |
| Amarelo Coxinha | `#F9C115` | cor principal: botões de ação, item selecionado, total |
| Amarelo Mágico | `#FFEB4A` | hover / destaque claro |
| Preto Gourmet | `#131313` | menu lateral, topo, texto |
| Preto clareado | `#262626` | fundos de segundo plano |
| Marrom Churros | `#462302` | texto sobre o amarelo |
| Branco | `#FFFFFF` | fundo das listas e fichas |

Sinais do app: sucesso `#3DD68C`, alerta `#FFB020`, erro `#FF5A5A`, info `#5AC8FA`.
Escala de ouro: `#FFFBEB` `#FFF4C2` `#FFEB4A` `#F9C115` `#E0A50C` `#C98A0A` `#8A5A06` `#462302`.

Contraste: o amarelo **não** serve para texto em fundo branco. Use amarelo como **fundo** com texto
preto gourmet ou marrom churros.

Os grupos do PDV Legal usam cores soltas (`95A5A6`, `F1C40F`, `2980B9`, `2C3E50`, `C0392B`, `F5821F`,
`8E44AD`, `D35400`). No nosso, as capinhas usam **foto do produto** sobre a paleta da marca.

### Fontes (`sua-coxinha-app/FONTES.md`)

- **Satoshi** — texto, números do caixa, tudo. Licença livre para uso comercial. Arquivos:
  `sua-coxinha-app/public/fontes/Satoshi-{Regular,Medium,Bold,Black}.woff2`.
- **Brown Beige** — a letra do logo, só para títulos curtos em CAIXA ALTA **sem acento** (ela não
  tem Á, Ã, Ç, É…). Arquivo: `sua-coxinha-app/public/fontes/BrownBeige.woff2`.
  **A licença comercial ainda não foi comprada** (a versão no repositório é só para uso pessoal).
  Antes de colocar o PDV em produção: comprar a licença ou trocar por Baloo 2 / Nunito ExtraBold.

### Logo e marca

- Logo horizontal: `sua-coxinha-cajamar/public/assets/marca/logo-sua-coxinha.svg`
- Logo empilhado (o da gota): `…/marca/logo-empilhado.svg` · Selo: `…/marca/selo.svg` ·
  Gota: `…/marca/gota.svg`
- Versão para fundo escuro: `sua-coxinha-app/public/marca/logo-claro.svg` e `gota-ouro.svg`
- Mascote (Coxinildo): `sua-coxinha-cajamar/public/assets/produtos/mascote.webp` — bom para telas
  vazias ("nenhum pedido ainda") e para o totem.

### Fotos (todas em `sua-coxinha-cajamar/public/assets/`)

| Pasta | Conteúdo | Uso no PDV |
| --- | --- | --- |
| `produtos/` | coxinha G/M/gourmet, copo mágico doce/salgado, churros gourmet, mini churros, caixa de gostosuras, linha degust, combos (Pra Você, Dupla Fome, Casal, Mata Fome), congelados | capinhas de produto e de grupo |
| `sabores/` | frango, catupiry, costela, mussarela, pizza, carne seca, cheddar-bacon, caipira, carne moída, brócolis | botões de sabor (FRANGO G, CAIPIRA M…) e escolha de sabores das caixas |
| `molhos/` | moderado, goiabinha, suave, alho | grupo Molhos |
| `galeria/`, `loja/` | fotos de clientes, salão, fachada | tela de login / descanso do totem |

Bebidas não têm foto: usar ícone + nome.

### Catálogo e preços de referência

`sua-coxinha-cajamar/src/lojas/cajamar/produtos.js` tem o cardápio oficial com preços em centavos,
sabores, variantes (10/20/50/100 un) e limites de sabores — é a mesma lógica dos modificadores
(mín/máx). Serve de base para os dados de exemplo.

---

## 5. Sem banco de dados por enquanto

Proposta, no mesmo padrão do site (`src/lojas/carregador.js` isola de onde vêm os dados):

- Dados de exemplo em arquivos JS (`src/dados/…`), montados a partir de `REFERENCIA-CADASTROS.md` e
  do `produtos.js` do site.
- O que o usuário cria ou muda (pedidos, caixa, cadastros editados) fica no **IndexedDB** do
  navegador (o localStorage, de ~5 MB, enchia em poucas semanas de vendas).
- Toda leitura e gravação passa por uma camada só (`src/dados/repositorio.js`, por exemplo). Quando o
  banco chegar, troca-se só essa camada; telas e regras ficam iguais.
- Limitação: sem banco, cada computador vê só os próprios dados (não há dashboard da rede real).

Stack sugerida, igual aos outros dois projetos: **React + Vite**, CSS com tokens, em português.

---

## 6. Modelo de dados (para quando o banco vier)

| Entidade | Campos principais |
| --- | --- |
| Filial | código, nome, CNPJ, endereço |
| Ponto de venda | filial, nome do terminal |
| Usuário / Perfil | tipo (PDV ou ADM), perfil, filiais com acesso, permissões |
| Cliente / Fornecedor | nome, CPF/CNPJ, contato |
| Grupo | código, descrição, cor, imagem, ordem, status |
| Classe | código, descrição, cor, imagem, ordem |
| Produto | código, descrição cupom, grupo, classes[], unidade, unidades de compra[], EAN, configurações (seção 2.3), NCM, CEST, status |
| Preço por filial | produto, filial, valor, custo, mark-up, pausado, grupo tributário |
| Grupo de modificadores | descrição, classificação (observação/adicional), impressora, mín, máx, modificadores[] |
| Modificador | código, descrição, preço sugerido, baixa estoque, insumo ligado |
| Composição | produto, rendimento, itens (insumo, quantidade, baixa estoque) |
| Movimento de estoque | tipo (entrada, saída, transferência, inventário, produção, compra), data, filial, fornecedor, doc, itens, valor |
| Caixa (sessão) | ponto de venda, operador, abertura, sangrias, suprimentos, fechamento |
| Venda | filial, caixa, operador, data/hora, itens, descontos, acréscimos, pagamentos, status (concluída, cancelada, estornada) |
| Item da venda | produto, quantidade, preço, modificadores escolhidos, cancelado + motivo |
| Forma de pagamento / Motivo de cancelamento / Tipo de desconto | cadastros simples |
| Comunicado | título, texto, filiais, lido por |

---

## 7. Fases sugeridas

O narrador achou "muito trabalhoso". É verdade para a parte fiscal; o resto é cadastro e tela.

**Situação:** as fases 1 a 5 estão feitas, sem banco de dados (ver `README.md`). A frente de caixa
seguiu os PDVs de balcão mais usados (Toast, Square, Saipos), já que o vídeo do caixa não chegou.
A importação do XML da NF-e também está pronta; a busca automática na Sefaz e a NFC-e (fase 6)
dependem de servidor e certificado digital (ver `SEGURANCA.md`).

| Fase | Entrega | Precisa de banco? |
| --- | --- | --- |
| **1. Caixa** | frente de caixa com capinhas, sabores/modificadores, carrinho, desconto, pagamento, comanda da cozinha, abertura e fechamento de caixa | não (localStorage) |
| **2. Cardápio** | Retaguarda: grupos, classes, produtos (ficha com as abas), modificadores, preço por filial, pausar | não |
| **3. Dashboard e relatórios** | cartões, mais vendidos, vendas por hora, formas de recebimento, por filial | para ver a rede inteira, sim |
| **4. Estoque** | movimentações, composição/ficha técnica, baixa automática pelos modificadores | sim |
| **5. Financeiro** | acerto e conferência de caixa, contas a pagar/receber, plano de contas | sim |
| **6. Fiscal** | NFC-e, NCM/CEST/tributos, importação de XML e manifesto do destinatário (Sefaz) | sim, mais servidor, certificado digital A1 e, na prática, uma API fiscal terceirizada |

---

## 8. Pendências

1. **Mandar o vídeo da tela de registrar pedidos** (frente de caixa) — o enviado foi o da Retaguarda,
   duas vezes.
2. Confirmar se o caixa roda em tela de toque, em que tamanho de tela, e se tem impressora térmica.
3. Decidir a licença da Brown Beige (comprar ou trocar a fonte) antes de produção.
4. Lista oficial de filiais do PDV (o vídeo mostra 9; o site tem 24 lojas).
5. Formas de pagamento, motivos de cancelamento e tipos de desconto usados hoje.
