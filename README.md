# 💰 Minhas Finanças

> Controle financeiro pessoal e contas compartilhadas — receitas, despesas, saldo acumulado, recorrências e a lista de contas do mês, tudo em uma PWA instalável.

![Status](https://img.shields.io/badge/status-em%20produção-3f9e6a)
![Stack](https://img.shields.io/badge/stack-React%2018%20%2B%20TypeScript%20%2B%20Supabase-1a1f2b)
![PWA](https://img.shields.io/badge/PWA-installable-5d8aa8)
![Testes](https://img.shields.io/badge/testes-194%20passando-c9a86a)

**Em produção: [financias-app.vercel.app](https://financias-app.vercel.app)**

---

## 🤔 Por que esse app existe

Cansado daquela planilha de Excel para planejar as contas do mês?

Da lista no Notes que você refaz toda virada de mês? Do print da conta de luz perdido no meio da conversa do WhatsApp, junto com o "alguém já pagou a internet?" que ninguém respondeu?

Era assim que eu controlava minhas finanças. E o problema não era nenhuma dessas ferramentas isoladamente — era que **a informação vivia em três lugares que não conversavam**. A planilha sabia quanto eu ganhava. A lista do WhatsApp sabia o que estava por pagar. E só a minha cabeça juntava as duas coisas para responder a única pergunta que importa: *sobra ou não sobra no fim do mês?*

Foi por isso que construí esse app. Um lugar só, onde:

- o que entra e o que sai fica registrado, com data e categoria
- as contas fixas se lançam sozinhas todo mês, sem eu lembrar
- a lista de contas a pagar é compartilhada com quem divide as despesas comigo, em tempo real
- e o **saldo projetado** puxa de tudo isso ao mesmo tempo — inclusive das contas que ainda ninguém pagou

Também é onde aplico o que faço como engenheiro de software: RLS no banco em vez de confiar no front-end, testes nas regras de cálculo, code splitting para o app abrir rápido no 4G, e PWA para instalar no celular sem passar por loja de aplicativo.

É um projeto pessoal de verdade — usado todo dia, por mim e pela minha família.

---

## ✨ Funcionalidades

### Autenticação
- Cadastro e login por **email + senha**
- Login com **Google OAuth** (um clique)
- Sessão persistente entre recarregamentos

### Lançamentos
- Criar lançamento com **data**, **categoria**, **descrição**, **valor** e **tipo** (entrada ou saída)
- **Editar** com loading otimista e rollback automático em caso de erro
- **Corrigir o valor na própria lista** — toque no número, ele vira campo com o
  texto já selecionado, digite e saia. Sem modal. Quem confirma é a saída do
  campo, e não o Enter: o teclado numérico do iPhone não tem tecla Enter. `Esc`
  cancela, e sair sem mudar nada não vai ao servidor.
  Como o update não envia `recorrencia_id`, o vínculo com a regra sobrevive à
  correção — e a geração seguinte, que é `ON CONFLICT DO NOTHING` em
  `(recorrencia_id, data)`, não sobrescreve o valor corrigido. É por isso que dá
  para deixar a fatura do cartão como recorrência de valor aproximado e ajustar
  o número quando ela chega
- **Excluir** com modal de confirmação
- **Validação de formulário** com feedback visual nos campos
- Lista do mês ordenada por data, com descrição e valor formatado em BRL

### ✍️ Adicionar escrevendo (ou colando)

O formulário de seis campos era o que dava preguiça de abrir para lançar um
almoço de R$ 25. O **Adicionar** troca isso por um campo de texto: uma linha
por lançamento, com a gramática

```text
[+|-]  [DD/MM]  descrição  valor
```

Só a descrição e o valor são obrigatórios, e o valor tanto vale no fim
(`almoço 25`) quanto no começo (`25 almoço`).

```text
Contas de outubro 05/10:
Cartão de crédito 1.900
Empréstimo 2.800
+ Mãe 6.000
12/10 internet 120
Total = 10.820
```

- **Uma linha ou uma lista** — não existe um botão separado de "colar lista":
  o número de linhas é que decide se aquilo é um lançamento ou uma leva. Colar
  o texto do WhatsApp já é usar
- **`+` é entrada**, sem sinal é saída. Sem sinal nenhum, uma descrição
  inequívoca ainda desempata: `salário 3000` vira entrada sozinho, mas
  `bolsa 200` continua saída, porque quase sempre é uma compra
- **Categoria adivinhada** por palavra reconhecida — `ifood` → Alimentação,
  `uber` → Transporte, `balada` → Lazer, `fatura do nubank` → Cartão de
  Crédito. Vence a palavra mais longa, para `plano de saúde` não cair em
  Assinaturas por causa de `plano`
- **Data em três níveis** — a da linha vence a do cabeçalho, que vence a do
  campo. E a competência sai da data, não do mês na tela: colar `12/10` olhando
  setembro grava em outubro
- **Nada é salvo às cegas** — cada linha aparece numa prévia com o tipo
  (um toque troca), a categoria e a data, e o que não deu para interpretar é
  listado em vez de sumir. A linha `Total = X` confere a soma e avisa da
  diferença, mas nunca vira lançamento
- **Aviso de duplicata** — linha com a mesma descrição, valor e data do que já
  está lançado ganha o selo `já existe`, e um toque tira todas as repetidas de
  uma vez. Não bloqueia (dois almoços de R$ 25 no mesmo dia existem), mas não
  deixa passar calado
- **Escape para o formulário completo**, levando junto o que já foi digitado
- **Desfazer** — o toast da leva recém-salva traz um botão que apaga tudo que
  acabou de entrar. É o arrependimento rápido: colou a lista errada, trouxe o
  mês que não era
- **Rascunho que sobrevive** — o Safari do iPhone descarrega a aba quando você
  troca de app, e trocar de app no meio é o caso normal aqui: você vai no
  WhatsApp copiar a lista e volta. O texto fica guardado no aparelho e é
  devolvido ao reabrir, com um `Limpar` do lado. Some sozinho quando a leva
  entra

### 📲 Atalho de compartilhamento (funciona no iPhone)

O app aceita a lista pela URL, em `?texto=`, e abre o **Adicionar** já
preenchido. O `share_target` de PWA só existe no Android, então o caminho que
serve nos dois é esse.

No iPhone, monte um atalho no app **Atalhos**:

1. Novo atalho → **Receber** `Texto` da **Folha de Compartilhamento**
2. Ação **URL** → `https://financias-app.vercel.app/?texto=`
3. Ação **Combinar texto** com a Entrada do Atalho (codificada para URL)
4. Ação **Abrir URLs**

Depois é selecionar a lista no WhatsApp → Compartilhar → o atalho. O app abre
com tudo colado e a prévia pronta para revisar.

### 🔁 Repetir o mês anterior

O mês novo começa quase igual ao passado — estacionamento, internet, academia,
muda só um valor ou outro. **Repetir** traz a lista do mês anterior com tudo
marcado e os valores editáveis, e sabe duas coisas que o copiar-e-colar da
lista do WhatsApp não sabia:

- **lançamento de recorrência não vem junto** — ele se materializa sozinho na
  virada, e trazer de novo criaria a conta em dobro
- **o que já existe no destino chega desmarcado** — abrir a tela uma segunda
  vez não duplica o que a primeira trouxe

As datas vão para o mesmo dia do mês de destino, encolhendo quando o dia não
existe lá: o aluguel do dia 31 cai no dia 30 em novembro, em vez de escorregar
para dezembro.

### 📱 Layout do celular

O app é aberto para lançar, não para analisar — mas os gráficos ficavam entre
os cards e a lista, empurrando o que mais se usa para três telas de rolagem
abaixo. No celular a ordem passou a ser **cards → lançamentos → gráficos →
recorrências**; no desktop nada muda, que lá cabe tudo lado a lado.

Renda e Gastos, que são dois números sem detalhamento, foram para uma faixa de
duas colunas. O Saldo atual continua inteiro, porque é ele que abre a conta do
projetado.

Somadas, as duas coisas trouxeram a lista de `y ≈ 1400px` para `y ≈ 330px` em
uma tela de 390×844 — de três rolagens para nenhuma. É `order` de flexbox e
`grid-column` dentro da media query de 640px: nenhuma lógica de cálculo foi
tocada, e o desktop renderiza exatamente o que renderizava antes.

### Categorias
**Saídas** — Alimentação, Transporte, Lazer, Educação, Assinaturas, Saúde, Tecnologia, Beleza, Casa, Cartão de Crédito / Contas, Vestuário, Outros.

**Entradas** — Salário, Mesada, Freelance / Bico, Presente, Empréstimo recebido, Rendimentos / Investimentos, Reembolso, Vendas, Bolsa / Auxílio, Outros.

Cada categoria tem cor própria, usada de forma consistente na lista, nos gráficos e nos badges.

### 🔁 Recorrências
Contas fixas — salário, aluguel, assinaturas — cadastradas uma vez e geradas automaticamente.

- Frequência **mensal** (dia do mês) ou **semanal** (dia da semana)
- Geração **idempotente**: o índice único `(recorrencia_id, data)` impede duplicata mesmo com várias abas abertas
- **Nunca gera para trás** — uma recorrência criada em agosto não contamina julho, mesmo se você navegar para lá
- **Exceções persistentes**: ao excluir um lançamento gerado, ele fica registrado em `recorrencia_excecoes` e não volta na próxima sincronização
- Pausar sem apagar (`ativo = false`), preservando o histórico já gerado
- **Aviso de conta já lançada** — criar uma recorrência para algo que você já
  lançou à mão naquele mês era o jeito mais fácil de ver valor dobrado: a
  geração casa por `(recorrencia_id, data)` e não enxerga o lançamento manual,
  então as duas cópias convivem e o saldo conta as duas. Agora a tela avisa e
  oferece **não gerar naquele mês**, gravando uma exceção em
  `recorrencia_excecoes`. O lançamento que você fez fica intacto, e a partir
  do mês seguinte a regra gera normal

### 📋 Contas a pagar (compartilhadas) — **desativada por enquanto**
A substituta da lista do WhatsApp. Está **fora do ar por decisão de produto**:
a tela ficou confusa de usar e o botão de adicionar conta não aparecia no
celular. O código continua no repositório e coberto pelos testes — para religar,
basta trocar `CONTAS_A_PAGAR_HABILITADO` para `true` em `src/lib/flags.ts`.

Com o interruptor desligado, a aba Contas some do celular e do desktop, o app
não consulta mais as tabelas de pilhas nem abre canal Realtime, links de convite
são ignorados, e o saldo projetado volta a considerar só os lançamentos.

- **Pilhas** — grupos com nome (`Casa`, `Apartamento`, `Viagem`) que várias pessoas dividem. Renomear, arquivar, excluir, passar a posse e sair
- **Convite por link de uso único** — você gera um link e manda por onde quiser. Sem busca por e-mail, justamente para não permitir que alguém descubra quem tem conta no app
- **Tempo real** — dois celulares na mesma pilha veem a mesma lista. Quem marcou como paga aparece para todo mundo
- **Colar lista do WhatsApp** — cole o texto e o app interpreta. O parser entende formato brasileiro (`1.900` é mil e novecentos, `10,50` é dez e cinquenta) e trata a linha `Total: X` como **conferência**, nunca como item
- **Contar no meu saldo** — um botão por pessoa. Ligado, as contas **em aberto** daquela pilha entram no seu saldo projetado; pagas não entram, para não contar duas vezes com o lançamento
- **Acúmulo entre meses** — conta de agosto que ninguém pagou continua devida em setembro

### Lançamentos futuros e saldo projetado
- Lançamentos com **data > hoje** aparecem com ícone de relógio, opacidade reduzida e fundo distinto
- Só entram em **Renda**, **Gastos**, **Saldo Atual** e nos gráficos quando a data chega
- Tooltip com `Será contabilizado em DD/MM · R$ X,XX` (hover no desktop, long-press no mobile)
- O card **Saldo atual** mostra abaixo a linha `≈ Saldo projetado`, e abre a conta por origem: quanto está **a receber**, quanto está **a pagar** e quanto vem das **contas em aberto** das pilhas — sempre dizendo de onde saiu cada número
- As quatro linhas **fecham como soma** (`projetado = atual + a receber − a pagar`) em qualquer mês visitado. Os pendentes são acumulados até a competência olhada, e não só os do mês: o saldo atual corta por data e os pendentes cortavam por mês, então o que sobrou de setembro sumia do card ao olhar outubro. Uma varredura de 72 combinações trava a igualdade

### Dashboard
- **Card Renda** — entradas do mês já contabilizadas
- **Card Gastos** — saídas do mês já contabilizadas
- **Card Saldo atual** — acumulado desde o primeiro mês com lançamentos, com as linhas de pendentes e o saldo projetado logo abaixo
- **Gráfico de pizza** por categoria, com toggle Saídas / Entradas
- **Gráfico de barras** com o quanto sobrou em cada mês do ano
- **MonthPicker** — setas `‹ ›` e popover com grade dos 12 meses + seletor de ano
- **Swipe** horizontal entre meses no touch (desativado com modal aberto, para não trocar de mês sem querer)

### Estados, feedback e resiliência
- **Skeleton** enquanto os dados carregam
- **Empty state** ilustrado quando não há lançamentos
- **Toast** de feedback em todas as ações
- **Tela de erro com retry** caso o carregamento falhe
- **Loading otimista** com rollback automático quando a API rejeita
- **Recarga ao voltar do background** — `visibilitychange` e `focus` refazem as buscas, porque o Realtime não reenvia o que se perdeu enquanto o WebSocket estava caído
- **Aviso de dado desatualizado** — se a recarga em segundo plano falhar, aparece uma faixa com "tentar de novo" em vez de deixar um valor velho na tela sem marca nenhuma

### PWA
- Instalável em Android, iPhone e Desktop
- Service worker com `autoUpdate`
- Funciona offline para os assets estáticos (HTML, CSS, JS, ícones, fontes)
- Manifesto em português, com ícones `any` e `maskable` separados

---

## 🛠️ Stack tecnológica

### Front-end
- **React 18** + **TypeScript 5**
- **Vite 5** (build e dev server)
- **Recharts** — carregado sob demanda via `React.lazy`, fora do bundle inicial
- **lucide-react** (ícones)
- **CSS nativo** com variáveis (design tokens em `src/styles/global.css`) — sem framework de UI
- **vite-plugin-pwa** + Workbox

### Back-end
- **Supabase** — PostgreSQL + Auth (GoTrue) + Row Level Security + **Realtime**

### Testes
- **Vitest 4**, ambiente Node, sobre as funções puras de cálculo, recorrência e parsing

### Deploy
- **Vercel**, integrado ao GitHub — merge na `main` publica em produção

---

## ⚡ Performance

O bundle inicial era de **890 kB** porque o Recharts vinha junto, mesmo para quem abrisse direto na aba de contas e nunca visse um gráfico.

Os dois gráficos foram isolados em `src/components/Graficos.tsx` e passaram a ser carregados com `React.lazy`:

| | Antes | Depois |
|---|---|---|
| Bundle inicial | 890 kB | **491 kB** |
| Gzip | 243 kB | **135 kB** |
| Recharts | sempre | só quando o Dashboard precisa (chunk de 400 kB) |

Além disso, índices em `itens_lista` e `listas_contas` cobrem o caminho percorrido pelas policies de RLS — incluindo um índice **parcial** só das contas em aberto, que é o recorte consultado pelo saldo projetado.

---

## 📂 Estrutura do projeto

```text
financias-app/
├── public/                          # Ícones do PWA (any, maskable, apple-touch, favicons)
├── src/
│   ├── components/
│   │   ├── AceitarConvite.tsx       # Tela de entrada via link de convite
│   │   ├── AvisoDesatualizado.tsx   # Faixa de "não consegui atualizar" com retry
│   │   ├── BottomNav.tsx            # Navegação Início ↔ Contas
│   │   ├── Card.tsx                 # Card de métrica (Renda, Gastos, Saldo)
│   │   ├── ConfirmModal.tsx         # Confirmação de ação destrutiva
│   │   ├── ContasAPagar.tsx         # Tela de contas compartilhadas
│   │   ├── Dashboard.tsx            # Tela principal — cards, gráficos, lista, swipe
│   │   ├── EmptyState.tsx           # Estado vazio ilustrado
│   │   ├── Graficos.tsx             # Pizza e barras (chunk sob demanda)
│   │   ├── Login.tsx                # Login / cadastro / OAuth Google
│   │   ├── MenuPilha.tsx            # Renomear, arquivar, passar posse, sair
│   │   ├── ModalAdicionar.tsx       # Escrever ou colar lançamentos (prévia editável)
│   │   ├── ModalColarLista.tsx      # Importar lista colada do WhatsApp
│   │   ├── ModalCompartilhar.tsx    # Gerar link de convite
│   │   ├── ModalItem.tsx            # Criar / editar conta a pagar
│   │   ├── ModalNomeGrupo.tsx       # Criar / renomear pilha
│   │   ├── ModalNovo.tsx            # Criar / editar lançamento
│   │   ├── ModalPassarPosse.tsx     # Transferir a posse da pilha
│   │   ├── ModalRecorrencia.tsx     # Criar / editar recorrência
│   │   ├── ModalRepetirMes.tsx      # Trazer o mês anterior para o mês atual
│   │   ├── MonthPicker.tsx          # Navegador de mês/ano
│   │   ├── Recorrencias.tsx         # Gerenciar recorrências
│   │   ├── Skeleton.tsx             # Placeholder de loading
│   │   └── Toast.tsx                # Feedback de sucesso / erro
│   ├── hooks/
│   │   ├── useAuth.ts               # Sessão Supabase + listener de auth state
│   │   └── useSwipe.ts              # Swipe horizontal (inerte com modal aberto)
│   ├── lib/
│   │   ├── calculos.ts              # Funções puras: somas, agrupamentos, projeção
│   │   ├── categorias.ts            # Adivinha categoria e tipo pela descrição
│   │   ├── flags.ts                 # Interruptores de feature (contas a pagar)
│   │   ├── format.ts                # Formatação BRL e leitura de valor pt-BR
│   │   ├── importarLancamentos.ts   # Parser de lançamentos escritos como texto
│   │   ├── importarLista.ts         # Parser de lista colada (pt-BR)
│   │   ├── lancamentos.ts           # CRUD de lançamentos
│   │   ├── listas.ts                # Pilhas, membros, itens, convites
│   │   ├── mensagens.ts             # Tradução de erros do Supabase para pt-BR
│   │   ├── rascunho.ts              # Texto do Adicionar guardado no aparelho
│   │   ├── recorrencias.ts          # CRUD + geração idempotente
│   │   └── supabase.ts              # Cliente singleton
│   ├── styles/global.css            # Reset + design tokens
│   ├── types/index.ts               # Tipos, MESES, listas de categorias
│   ├── App.tsx                      # Roteamento Login ↔ Dashboard ↔ Contas
│   └── main.tsx                     # Bootstrap
├── vite.config.ts                   # Vite + PWA + Vitest
└── package.json
```

---

## ⚙️ Como rodar localmente

```bash
git clone https://github.com/LoPedrozo/financias-app
cd financias-app
cp .env.example .env.local
# preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

O dev server sobe em `http://localhost:5173`.

Para rodar a build de produção localmente:

```bash
npm run build
npm run preview
```

---

## 🧪 Testes

```bash
npm run test:run
```

**194 testes**, todos sobre lógica pura — nenhum depende de rede ou de DOM:

| Arquivo | Testes | Cobre |
|---|---|---|
| `contas_batem.test.ts` | 82 | a invariante do card varrida em 72 combinações de conjunto × mês visitado, o mês real ponta a ponta, encolhimento de dia no Repetir |
| `calculos.test.ts` | 43 | somas, saldo acumulado, pendentes, agrupamento por categoria, balanço anual, saldo projetado, `hojeLocal` |
| `importarLancamentos.test.ts` | 21 | gramática da linha, sinal, valor no fim e no começo, datas em três níveis, total como conferência, competência pela data |
| `importarLista.test.ts` | 12 | parsing pt-BR, linha de total como conferência, linhas ignoradas, detecção de vencimento |
| `categorias.test.ts` | 8 | normalização, palavra inteira, palavra mais longa, ambiguidade que não desempata |
| `duplicatas.test.ts` | 9 | lista recolada, mesma conta em meses diferentes, valor ajustado |
| `rascunho.test.ts` | 5 | guardar, limpar, e nunca estourar quando o armazenamento está bloqueado |
| `recorrencias.test.ts` | 11 | frequências, idempotência, corte por `created_at`, exceções, datas geradas e encolhimento de dia |
| `fluxos_completos.test.ts` | 5 | cenários ponta a ponta de um mês real |

Para checar tipos sem rodar build:

```bash
npx tsc --noEmit
```

---

## 📱 PWA — Instalação

O app roda em janela própria, sem barra de endereço.

### Android (Chrome)
1. Abra o app no Chrome.
2. Toque no menu (⋮) no canto superior direito.
3. Toque em **"Instalar app"** ou **"Adicionar à tela inicial"**.

### iPhone / iPad (Safari)
1. Abra o app no **Safari** (não funciona no Chrome iOS).
2. Toque em **Compartilhar** (quadrado com seta para cima).
3. Role e toque em **"Adicionar à Tela de Início"**.

### Desktop (Chrome / Edge)
1. Abra o app no navegador.
2. Clique no ícone de **instalação** (⊕) na barra de endereço.

> O service worker (`autoUpdate`) busca novas versões em segundo plano. Se uma mudança recente não aparecer, recarregue uma vez — é cache do PWA, não bug.

---

## 🔒 Segurança

- **Row Level Security** em todas as tabelas. Nos lançamentos, as policies exigem `auth.uid() = user_id` em SELECT, INSERT, UPDATE e DELETE
- **Sem recursão entre policies** — o acesso às listas compartilhadas passa por funções `SECURITY DEFINER` com `SET search_path = ''` (`eh_membro_do_grupo`, `pode_acessar_lista`). Sem elas, a policy da lista consultaria a tabela de membros, cuja policy consultaria a lista de volta
- **GRANT explícito** — RLS sozinho não basta no PostgREST: o papel `authenticated` recebe só os privilégios que usa, e `anon` não recebe nenhum DML
- **Convite sem enumeração** — o convite é um token aleatório de 18 bytes (144 bits) de uso único, consumido sob `FOR UPDATE`. Buscar pessoas por e-mail deixaria qualquer um descobrir quem tem conta no app
- **Defesa em profundidade** — mesmo com RLS ativo, as queries em [`src/lib/lancamentos.ts`](src/lib/lancamentos.ts) filtram explicitamente por `user_id`
- **Variáveis de ambiente** — apenas as chaves *publishable* entram no build. A `service_role key` **nunca** toca o front-end
- **Service worker** cacheia só assets estáticos — chamadas à REST API do Supabase não são interceptadas nem persistidas

---

## 🗺️ Roadmap

Já entregue:

- ✅ **Contas a pagar compartilhadas** com pilhas, convite por link e tempo real (desativada por enquanto — ver `src/lib/flags.ts`)
- ✅ **Lançamentos recorrentes** com geração idempotente e exceções persistentes
- ✅ **Saldo projetado** puxando de lançamentos futuros e de contas em aberto — com as quatro linhas do card fechando como soma em qualquer mês visitado
- ✅ **Lazy load do Recharts** — 890 kB → 491 kB no carregamento inicial
- ✅ **Importar lista colada** do WhatsApp
- ✅ **Adicionar escrevendo** — uma linha ou a lista inteira, com tipo, data e categoria adivinhados
- ✅ **Repetir o mês anterior** pulando recorrências e o que já existe
- ✅ **Desfazer** a leva recém-lançada, direto no toast
- ✅ **Atalho de compartilhamento** por URL, com receita para o app Atalhos do iPhone
- ✅ **Aviso de conta já lançada** ao criar recorrência, com opção de pular o mês
- ✅ **Corrigir o valor direto na lista**, sem abrir formulário
- ✅ **Lista antes dos gráficos no celular**, com Renda e Gastos em faixa
- ✅ **Rascunho do Adicionar** sobrevivendo ao descarregamento da aba

Próximas frentes, em ordem aproximada de prioridade:

- 🔎 **Busca e filtro** na lista de lançamentos
- 🏷️ **Filtro por categoria** nos gráficos
- 📊 **Comparativo mês a mês** com variação percentual
- 🎯 **Meta de saldo** com indicador de progresso
- 📎 **Anexar comprovante** a uma conta paga
- 🔔 **Lembrete de vencimento** via push
- 📑 **Paginação** da lista para históricos longos
- 🌐 **Domínio personalizado**
