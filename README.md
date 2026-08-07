# 💰 Minhas Finanças

> Controle financeiro pessoal e contas compartilhadas — receitas, despesas, saldo acumulado, recorrências e a lista de contas do mês, tudo em uma PWA instalável.

![Status](https://img.shields.io/badge/status-em%20produção-3f9e6a)
![Stack](https://img.shields.io/badge/stack-React%2018%20%2B%20TypeScript%20%2B%20Supabase-1a1f2b)
![PWA](https://img.shields.io/badge/PWA-installable-5d8aa8)
![Testes](https://img.shields.io/badge/testes-65%20passando-c9a86a)

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
- **Excluir** com modal de confirmação
- **Validação de formulário** com feedback visual nos campos
- Lista do mês ordenada por data, com descrição e valor formatado em BRL

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

### 📋 Contas a pagar (compartilhadas)
A substituta da lista do WhatsApp — e a funcionalidade que mais mudou a rotina.

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
│   │   ├── ModalColarLista.tsx      # Importar lista colada do WhatsApp
│   │   ├── ModalCompartilhar.tsx    # Gerar link de convite
│   │   ├── ModalItem.tsx            # Criar / editar conta a pagar
│   │   ├── ModalNomeGrupo.tsx       # Criar / renomear pilha
│   │   ├── ModalNovo.tsx            # Criar / editar lançamento
│   │   ├── ModalPassarPosse.tsx     # Transferir a posse da pilha
│   │   ├── ModalRecorrencia.tsx     # Criar / editar recorrência
│   │   ├── MonthPicker.tsx          # Navegador de mês/ano
│   │   ├── Recorrencias.tsx         # Gerenciar recorrências
│   │   ├── Skeleton.tsx             # Placeholder de loading
│   │   └── Toast.tsx                # Feedback de sucesso / erro
│   ├── hooks/
│   │   ├── useAuth.ts               # Sessão Supabase + listener de auth state
│   │   └── useSwipe.ts              # Swipe horizontal (inerte com modal aberto)
│   ├── lib/
│   │   ├── calculos.ts              # Funções puras: somas, agrupamentos, projeção
│   │   ├── format.ts                # Formatação BRL
│   │   ├── importarLista.ts         # Parser de lista colada (pt-BR)
│   │   ├── lancamentos.ts           # CRUD de lançamentos
│   │   ├── listas.ts                # Pilhas, membros, itens, convites
│   │   ├── mensagens.ts             # Tradução de erros do Supabase para pt-BR
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

**65 testes**, todos sobre lógica pura — nenhum depende de rede ou de DOM:

| Arquivo | Testes | Cobre |
|---|---|---|
| `calculos.test.ts` | 42 | somas, saldo acumulado, pendentes, agrupamento por categoria, balanço anual, saldo projetado, `hojeLocal` |
| `importarLista.test.ts` | 12 | parsing pt-BR, linha de total como conferência, linhas ignoradas, detecção de vencimento |
| `recorrencias.test.ts` | 6 | frequências, idempotência, corte por `created_at`, exceções |
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

- ✅ **Contas a pagar compartilhadas** com pilhas, convite por link e tempo real
- ✅ **Lançamentos recorrentes** com geração idempotente e exceções persistentes
- ✅ **Saldo projetado** puxando de lançamentos futuros e de contas em aberto
- ✅ **Lazy load do Recharts** — 890 kB → 491 kB no carregamento inicial
- ✅ **Importar lista colada** do WhatsApp

Próximas frentes, em ordem aproximada de prioridade:

- 🔎 **Busca e filtro** na lista de lançamentos
- 🏷️ **Filtro por categoria** nos gráficos
- 📊 **Comparativo mês a mês** com variação percentual
- 🎯 **Meta de saldo** com indicador de progresso
- 📎 **Anexar comprovante** a uma conta paga
- 🔔 **Lembrete de vencimento** via push
- 📑 **Paginação** da lista para históricos longos
- 🌐 **Domínio personalizado**
