# 💰 Minhas Finanças

> Controle financeiro pessoal — receitas, despesas, saldo acumulado e lançamentos futuros, em uma PWA instalável que funciona em qualquer dispositivo.

![Status](https://img.shields.io/badge/status-em%20desenvolvimento%20ativo-c9a86a)
![Stack](https://img.shields.io/badge/stack-React%2018%20%2B%20TypeScript%20%2B%20Supabase-1a1f2b)
![PWA](https://img.shields.io/badge/PWA-installable-5d8aa8)

App pessoal feito para resolver um problema real: substituir planilhas e mensagens soltas no WhatsApp por um lugar único e simples para acompanhar entradas, saídas e o que ainda está por vir.

---

## 🚀 Demonstração

Em produção: **[financias-app.vercel.app](https://financias-app.vercel.app)**

Pode ser usado direto pelo navegador ou instalado como app (veja [📱 PWA — Instalação](#-pwa--instalação) abaixo).

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
- Lista do mês ordenada por data, com a descrição e o valor formatado em BRL

### Categorias
**Saídas** — Alimentação, Transporte, Lazer, Educação, Assinaturas, Saúde, Tecnologia, Beleza, Casa, Cartão de Crédito / Contas, Vestuário, Outros.

**Entradas** — Salário, Mesada, Freelance / Bico, Presente, Empréstimo recebido, Rendimentos / Investimentos, Reembolso, Vendas, Bolsa / Auxílio, Outros.

Cada categoria tem cor própria, usada de forma consistente na lista, nos gráficos e nos badges.

### Lançamentos futuros
- Lançamentos com **data > hoje** aparecem na lista com ícone de relógio, opacidade reduzida e fundo distinto
- Só entram nos cálculos de **Renda**, **Gastos**, **Saldo Atual**, gráfico de pizza e gráfico de barras quando a data chega
- Tooltip com `Será contabilizado em DD/MM · R$ X,XX` (hover no desktop, long-press no mobile)
- O card **Saldo Atual** mostra, ao passar o mouse (ou ao tocar no mobile), quanto está **a receber** e **a pagar** no mês

### Dashboard
- **Card Renda** — soma de entradas do mês já contabilizadas
- **Card Gastos** — soma de saídas do mês já contabilizadas
- **Card Saldo Atual** — saldo acumulado desde o primeiro mês com lançamentos, com destaque visual e linhas de pendentes
- **Gráfico de pizza** por categoria com toggle Saídas / Entradas
- **Gráfico de barras** com o quanto sobrou em cada mês do ano
- **MonthPicker** — navegação por setas `‹ ›` e popover com grade dos 12 meses + seletor de ano
- **Swipe** horizontal entre meses em dispositivos touch (esquerda avança, direita recua, com virada automática de ano)

### Estados, feedback e resiliência
- **Skeleton** de loading enquanto os dados carregam
- **Empty state** ilustrado quando não há lançamentos
- **Toast** de feedback em todas as ações (sucesso e erro)
- **Tela de erro com retry** caso o carregamento falhe
- **Loading otimista** com rollback automático quando a API rejeita

### PWA
- Instalável em Android, iPhone e Desktop
- Service worker com `autoUpdate` — atualizações entram sem precisar reinstalar
- Funciona offline para os assets estáticos (HTML, CSS, JS, ícones, fontes)
- Manifesto em português com cores e ícones próprios

### Segurança
- **RLS (Row Level Security)** no Supabase — cada usuário só vê e escreve seus próprios lançamentos
- Defesa em profundidade: as queries em `src/lib/lancamentos.ts` também filtram por `user_id` do JWT
- Variáveis sensíveis vivem em `.env.local` (não versionado); apenas as chaves *publishable* (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) são embarcadas no build
- Service worker **não cacheia** chamadas à API do Supabase — só assets estáticos

---

## 🛠️ Stack tecnológica

### Front-end
- **React 18** + **TypeScript 5**
- **Vite 5** (build e dev server)
- **Recharts** (gráficos de pizza e barras)
- **lucide-react** (ícones)
- **CSS nativo** com variáveis (design tokens em `src/styles/global.css`) — sem framework de UI
- **vite-plugin-pwa** + Workbox para service worker e manifesto

### Back-end
- **Supabase** — PostgreSQL + Auth (GoTrue) + Row Level Security

### Testes
- **Vitest 4** com ambiente Node, focado nas funções puras de `src/lib/calculos.ts`

---

## 📂 Estrutura do projeto

```text
financias-app/
├── public/                     # Ícones do PWA (icon-192.png, icon-512.png, favicon)
├── src/
│   ├── components/
│   │   ├── Card.tsx            # Card de métrica (Renda, Gastos, Saldo)
│   │   ├── ConfirmModal.tsx    # Modal de confirmação (excluir lançamento)
│   │   ├── Dashboard.tsx       # Tela principal — cards, gráficos, lista, swipe
│   │   ├── EmptyState.tsx      # Estado vazio ilustrado
│   │   ├── Login.tsx           # Tela de login / cadastro / OAuth Google
│   │   ├── ModalNovo.tsx       # Modal de criar / editar lançamento
│   │   ├── MonthPicker.tsx     # Navegador de mês/ano com popover
│   │   ├── Skeleton.tsx        # Placeholder de loading
│   │   └── Toast.tsx           # Feedback de sucesso / erro
│   ├── hooks/
│   │   ├── useAuth.ts          # Sessão Supabase + listener de auth state
│   │   └── useSwipe.ts         # Detecção de swipe horizontal em touch
│   ├── lib/
│   │   ├── calculos.ts         # Funções puras: somas, agrupamentos, pendentes
│   │   ├── calculos.test.ts    # 30 testes unitários cobrindo calculos.ts
│   │   ├── format.ts           # Formatação BRL
│   │   ├── lancamentos.ts      # CRUD de lançamentos no Supabase
│   │   └── supabase.ts         # Cliente Supabase singleton
│   ├── styles/
│   │   └── global.css          # Reset + design tokens (cores, sombras, raios)
│   ├── types/
│   │   └── index.ts            # Lancamento, Categoria, MESES, listas de categorias
│   ├── App.tsx                 # Roteamento básico Login ↔ Dashboard
│   └── main.tsx                # Bootstrap
├── vite.config.ts              # Vite + PWA + Vitest
├── tsconfig.json
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
npm run test:run   # roda os testes uma vez
npm run test       # modo watch
```

A suíte cobre as funções puras de [`src/lib/calculos.ts`](src/lib/calculos.ts) — **30 testes** entre `filtrarPorMes`, `somarPorTipo`, `calcularSaldoAcumulado`, `calcularPendentes`, `agruparPorCategoria`, `calcularBalancoAnual` e `hojeLocal`, incluindo cenários de lançamento com data passada, hoje, futura e legado sem data.

Para checar tipos sem rodar build:

```bash
npx tsc --noEmit
```

---

## 📱 PWA — Instalação

O app é uma **Progressive Web App** e roda em janela própria, sem barra de endereço.

### Android (Chrome)
1. Abra o app no Chrome.
2. Toque no menu (⋮) no canto superior direito.
3. Toque em **"Instalar app"** ou **"Adicionar à tela inicial"**.
4. Confirme — o ícone aparece na tela inicial.

### iPhone / iPad (Safari)
1. Abra o app no **Safari** (não funciona no Chrome iOS).
2. Toque no botão de **Compartilhar** (quadrado com seta para cima).
3. Role e toque em **"Adicionar à Tela de Início"**.
4. Confirme — o ícone aparece na tela inicial.

### Desktop (Chrome / Edge)
1. Abra o app no navegador.
2. Procure o ícone de **instalação** (⊕) na barra de endereço, à direita.
3. Clique em **"Instalar"** — o app abre em janela própria.

> O service worker (registerType `autoUpdate`) busca novas versões em segundo plano. Basta recarregar uma vez para receber a atualização.

---

## 🗺️ Roadmap

Próximas frentes — em ordem aproximada de prioridade:

- 📋 **Contas a pagar** — substituir lista solta no WhatsApp / planilha por algo nativo no app
- 🔁 **Lançamento recorrente** (salário, assinaturas, contas fixas)
- 🔎 **Busca e filtro** na lista de lançamentos
- 🏷️ **Filtro por categoria** nos gráficos
- 📊 **Comparativo mês a mês** com variação percentual
- 🎯 **Meta de saldo** com indicador de progresso
- ⚡ **Lazy load do Recharts** (corte significativo no bundle inicial)
- 📑 **Paginação** da lista de lançamentos para históricos longos
- 🌐 **Domínio personalizado**

---

## 🔒 Segurança

- **Row Level Security (RLS)** ativo em todas as tabelas do Supabase: as policies garantem que `auth.uid() = user_id` em SELECT, INSERT, UPDATE e DELETE
- **Defesa em profundidade** — mesmo com RLS ativo, as queries em [`src/lib/lancamentos.ts`](src/lib/lancamentos.ts) filtram explicitamente por `user_id` para evitar vazamento em caso de policy mal configurada
- **Variáveis de ambiente** — apenas as chaves *publishable* (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) são embarcadas no build. A `service_role key` **nunca** entra no front-end
- **Service worker** cacheia apenas assets estáticos (`script`, `style`, `worker`, `font`, `image`) — chamadas à REST API do Supabase **não** são interceptadas nem persistidas
- **Sessão** gerenciada pelo SDK do Supabase (JWT em `localStorage`, refresh automático)
