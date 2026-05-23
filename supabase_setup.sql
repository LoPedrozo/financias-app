-- =====================================================================
-- BANCO DE DADOS — App Minhas Finanças
-- Cole este script inteiro no SQL Editor do Supabase e clique em "Run".
-- Ele cria a tabela de lançamentos e as regras de segurança (RLS)
-- que garantem que CADA usuário só enxerga os PRÓPRIOS dados.
-- =====================================================================

-- 1) Tabela de lançamentos
create table if not exists public.lancamentos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  tipo        text not null check (tipo in ('entrada', 'saida')),
  valor       numeric(12, 2) not null check (valor > 0),
  descricao   text default '',
  categoria   text not null,
  mes         smallint not null check (mes between 0 and 11),
  ano         smallint not null,
  created_at  timestamptz not null default now()
);

-- Índice para acelerar as consultas por usuário
create index if not exists idx_lancamentos_user
  on public.lancamentos (user_id, ano, mes);

-- 2) Liga o Row Level Security (RLS).
-- Sem isso, qualquer usuário poderia ler dados de outro. Essencial.
alter table public.lancamentos enable row level security;

-- 3) Políticas: o usuário só acessa as linhas onde user_id = ele mesmo.

-- Ver (SELECT)
create policy "ver os proprios lancamentos"
  on public.lancamentos for select
  using (auth.uid() = user_id);

-- Inserir (INSERT)
create policy "inserir os proprios lancamentos"
  on public.lancamentos for insert
  with check (auth.uid() = user_id);

-- Apagar (DELETE)
create policy "apagar os proprios lancamentos"
  on public.lancamentos for delete
  using (auth.uid() = user_id);

-- Atualizar (UPDATE) — deixado pronto caso você adicione edição depois
create policy "atualizar os proprios lancamentos"
  on public.lancamentos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
