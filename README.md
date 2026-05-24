# 💰 Minhas Finanças

> Aplicação de controle financeiro pessoal moderna, responsiva e segura, desenvolvida para permitir que usuários gerenciem suas receitas, despesas e balanços mensais em tempo real de qualquer dispositivo.

O projeto utiliza uma arquitetura moderna baseada em **React** com **TypeScript** no front-end, impulsionada pelo **Vite** para máxima performance de build, e **Supabase** (PostgreSQL + instâncias de autenticação) como infraestrutura de back-end (BaaS).

---

## 🚀 Demonstração e Funcionalidades

### Funcionalidades Core
* **Autenticação Segura**: Fluxo completo de cadastro e login por e-mail/senha ou de forma integrada via **Google OAuth**.
* **Gestão Dinâmica de Lançamentos**: Criação, categorização (Alimentação, Transporte, Saúde, Lazer, etc.) e exclusão de receitas ou despesas com persistência de dados.
* **Filtros por Período**: Seleção inteligente de visualização filtrada por mês e ano através de estados sincronizados.
* **Dashboard Analítico**: Gráficos interativos renderizados em tempo real:
  * Gráfico de Pizza (*Pie Chart*) detalhando a distribuição de gastos por categoria.
  * Gráfico de Barras (*Bar Chart*) com o balanço consolidado de sobra anual.
* **Segurança a Nível de Banco de Dados (RLS)**: Implementação de *Row Level Security* no PostgreSQL para garantir o isolamento absoluto dos dados (cada usuário manipula estritamente seus próprios lançamentos).

---

## 🛠️ Stack Tecnológica

### Front-end
* **React 18** (Biblioteca UI)
* **TypeScript** (Tipagem Estática e Escalabilidade)
* **Vite** (Build Tool & Dev Server)
* **Recharts** (Visualização Gráfica Avançada)
* **Lucide React** (Conjunto de Ícones Vetoriais)

### Back-end & Infraestrutura
* **Supabase** (Database-as-a-Service)
* **PostgreSQL** (Banco de Dados Relacional)
* **GoTrue** (Módulo de Autenticação JWT do Supabase)

---

## 📂 Estrutura Arquitetural do Projeto

O software adota o princípio de **segregação de responsabilidades**, isolando regras de negócio e consumo de serviços externos da camada visual:

```text
src/
├── components/     # Componentes encapsulados de interface (UI)
├── hooks/          # Hooks customizados para gerenciamento de estados globais (Ex: useAuth)
├── lib/            # Camada de serviços, abstração da API e isolamento do SDK do Supabase
├── styles/         # Estilizações estruturadas em CSS nativo (Design System / Design Tokens)
├── types/          # Contratos, interfaces TypeScript e dicionários de dados permanentes
├── App.tsx         # Orquestrador de rotas lógicas da aplicação
└── main.tsx        # Arquivo de bootstrap e ponto de entrada da aplicação
```

---

## 📱 PWA — Instalação

O app é um **Progressive Web App (PWA)** e pode ser instalado no celular ou no computador direto pelo navegador, abrindo em tela cheia, sem barra de endereço.

### Android (Chrome)
1. Abra o app no Chrome.
2. Toque no menu (⋮) no canto superior direito.
3. Toque em **"Instalar app"** ou **"Adicionar à tela inicial"**.
4. Confirme — o ícone aparece na tela inicial como um app nativo.

### iPhone / iPad (Safari)
1. Abra o app no Safari (não funciona no Chrome iOS).
2. Toque no botão de **compartilhar** (quadrado com seta para cima).
3. Role e toque em **"Adicionar à Tela de Início"**.
4. Confirme — o ícone aparece na tela inicial.

### Desktop (Chrome / Edge)
1. Abra o app no navegador.
2. Procure o ícone de **instalação** (⊕) na barra de endereço, à direita.
3. Clique em **"Instalar"** — o app abre em janela própria, como um programa nativo.

> O service worker atualiza o app automaticamente quando uma nova versão é publicada.

---

## 🗺️ Roadmap

Melhorias planejadas:

* 🔎 **Busca e filtro** na lista de lançamentos.
* 🏷️ **Filtro por categoria** no gráfico do dashboard.
* 🔁 **Lançamento recorrente** (assinaturas, salário, contas fixas).
* 📊 **Comparativo mês a mês** com variação percentual.
* 🎯 **Meta de saldo** mensal/anual com indicador de progresso.
* 🌐 **Domínio personalizado** próprio.
