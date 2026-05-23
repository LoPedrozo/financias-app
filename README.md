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
