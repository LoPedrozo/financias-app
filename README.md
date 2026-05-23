# 💰 Minhas Finanças

App de controle financeiro pessoal. Cada usuário cria sua conta e acompanha
renda, gastos e quanto sobra no mês — de qualquer dispositivo.

Construído com **React + TypeScript + Vite** no front-end e **Supabase**
(banco de dados PostgreSQL + autenticação) no back-end.

---

## 🚀 Como colocar no ar (passo a passo)

São 4 etapas. Faça na ordem. Tempo total: ~20 minutos.

### Etapa 1 — Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (pode usar
   o login com GitHub, é o mais rápido).
2. Clique em **New project**.
3. Dê um nome (ex: `financas`), crie uma senha forte para o banco
   (anote num lugar seguro) e escolha a região **South America (São Paulo)**.
4. Espere ~2 minutos enquanto o projeto é criado.

### Etapa 2 — Criar a tabela do banco

1. No menu lateral do Supabase, abra o **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `supabase_setup.sql` deste projeto, copie TODO o conteúdo
   e cole no editor.
4. Clique em **Run** (ou Ctrl+Enter). Deve aparecer "Success".

Isso cria a tabela de lançamentos e — importante — as regras de segurança
(RLS) que garantem que cada pessoa só enxerga os próprios dados.

### Etapa 3 — Pegar as chaves e configurar o projeto

1. No Supabase, vá em **Settings** (engrenagem) → **API**.
2. Copie dois valores:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public** key (uma chave longa)
3. Na pasta do projeto, faça uma cópia do arquivo `.env.example` e renomeie
   a cópia para `.env.local`.
4. Preencha com os valores que você copiou:

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
   ```

> ⚠️ A chave "anon public" é segura de usar no front-end — ela só funciona
> junto com as regras RLS que você criou na Etapa 2. Nunca use a chave
> "service_role" aqui.

### Etapa 4 — Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (geralmente `http://localhost:5173`).
Crie uma conta com email e senha e teste!

---

## 🔑 Ativando o login com Google (opcional)

O login por email/senha já funciona sem nada extra. Para o botão do Google:

1. No Supabase: **Authentication** → **Providers** → **Google** → ative.
2. Você vai precisar de um **Client ID** e **Client Secret** do Google.
   Siga o guia oficial que o próprio Supabase linka nessa tela (é no
   [Google Cloud Console](https://console.cloud.google.com)).
3. Na configuração do Google Cloud, adicione como **Authorized redirect URI**
   o endereço que o Supabase mostrar (algo como
   `https://xxxxx.supabase.co/auth/v1/callback`).
4. Cole o Client ID e Secret no Supabase e salve.

Enquanto não fizer isso, use o login por email/senha normalmente.

---

## 🌐 Publicar na internet (deploy no Vercel)

1. Suba este projeto para um repositório no seu GitHub.
2. Acesse [vercel.com](https://vercel.com), entre com o GitHub e clique em
   **Add New → Project**.
3. Selecione o repositório. O Vercel detecta o Vite automaticamente.
4. **Importante:** em **Environment Variables**, adicione as duas variáveis
   (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) com os mesmos valores
   do seu `.env.local`.
5. Clique em **Deploy**. Em ~1 minuto você tem um link público.
6. Por fim, no Supabase vá em **Authentication → URL Configuration** e
   adicione a URL do Vercel em **Site URL** e **Redirect URLs**, para o
   login funcionar no site publicado.

Pronto — é só mandar o link para quem você quiser. 🎉

---

## 📁 Estrutura do projeto

```
src/
├── components/      Componentes de UI (Login, Dashboard, Card, ModalNovo)
├── hooks/           useAuth — gerencia a sessão do usuário
├── lib/             supabase (cliente), lancamentos (acesso ao banco), format
├── types/           Tipos TypeScript e listas de categorias/meses
├── styles/          CSS global (tema claro)
├── App.tsx          Decide entre tela de login e dashboard
└── main.tsx         Ponto de entrada
```

A camada `lib/lancamentos.ts` isola toda a comunicação com o banco. Se um dia
você quiser trocar o Supabase por outro back-end, só esse arquivo muda.

---

## 🛠️ Comandos

| Comando           | O que faz                          |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Roda em modo desenvolvimento       |
| `npm run build`   | Gera a versão de produção (`dist/`)|
| `npm run preview` | Pré-visualiza o build localmente   |
