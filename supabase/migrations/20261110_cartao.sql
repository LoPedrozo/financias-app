-- Cartão de crédito: o cartão, as compras e os gastos previstos.
--
-- As compras ficam fora de "lancamentos" de propósito. O que sai do saldo é
-- a fatura, no vencimento, e ela é calculada no app (src/lib/fatura.ts). Se
-- as compras morassem em "lancamentos", qualquer tela que ainda não conheça
-- o cartão — inclusive a versão publicada enquanto esta é testada no preview,
-- que usa o mesmo banco — somaria cada compra como saída do dia, e o saldo
-- contaria tudo duas vezes.
--
-- Só acrescenta: nenhuma tabela existente muda.

create table public.cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null default 'Cartão de crédito' check (char_length(nome) between 1 and 60),
  dia_fechamento smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  meta_total numeric(12, 2) check (meta_total > 0),
  meta_essenciais numeric(12, 2) check (meta_essenciais >= 0),
  -- Vencimento da primeira fatura acompanhada; as de antes foram lançadas à mão.
  inicio date not null,
  created_at timestamptz not null default now(),
  check (meta_essenciais is null or meta_total is null or meta_essenciais <= meta_total)
);
create index cartoes_user_id_idx on public.cartoes (user_id);

create table public.compras_cartao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cartao_id uuid not null references public.cartoes (id) on delete cascade,
  descricao text not null default '' check (char_length(descricao) <= 200),
  valor numeric(12, 2) not null check (valor > 0 and valor <= 1000000000),
  categoria text not null,
  data date not null,
  parcelas smallint not null default 1 check (parcelas between 1 and 48),
  -- null: segue a categoria (CATEGORIAS_ESSENCIAIS em src/lib/fatura.ts).
  essencial boolean,
  como text check (como in ('aproximacao', 'online')),
  created_at timestamptz not null default now()
);
create index compras_cartao_cartao_data_idx on public.compras_cartao (cartao_id, data);
create index compras_cartao_user_id_idx on public.compras_cartao (user_id);

create table public.previstos_cartao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cartao_id uuid not null references public.cartoes (id) on delete cascade,
  descricao text not null check (char_length(descricao) between 1 and 200),
  valor numeric(12, 2) not null check (valor > 0 and valor <= 1000000000),
  categoria text not null,
  frequencia text not null check (frequencia in ('semanal', 'mensal')),
  dia_semana smallint check (dia_semana between 0 and 6),
  dia_mes smallint check (dia_mes between 1 and 31),
  essencial boolean,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (frequencia = 'semanal' and dia_semana is not null)
    or (frequencia = 'mensal' and dia_mes is not null)
  )
);
create index previstos_cartao_cartao_idx on public.previstos_cartao (cartao_id);
create index previstos_cartao_user_id_idx on public.previstos_cartao (user_id);

-- O que cada fatura já traz e outra pessoa paga direto ao banco (a parte da
-- mãe). Muda de fatura para fatura; ocupa a meta, mas não sai do saldo.
create table public.faturas_cartao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cartao_id uuid not null references public.cartoes (id) on delete cascade,
  -- Dia do fechamento: identifica a fatura.
  fechamento date not null,
  inicial numeric(12, 2) not null check (inicial >= 0 and inicial <= 1000000000),
  created_at timestamptz not null default now(),
  unique (cartao_id, fechamento)
);
create index faturas_cartao_user_id_idx on public.faturas_cartao (user_id);

alter table public.cartoes enable row level security;
alter table public.compras_cartao enable row level security;
alter table public.previstos_cartao enable row level security;
alter table public.faturas_cartao enable row level security;

-- "(select auth.uid())" é avaliado uma vez por consulta, e não uma por linha
-- (lint 0003 do Supabase).
create policy "ver os proprios cartoes" on public.cartoes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "criar o proprio cartao" on public.cartoes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "editar o proprio cartao" on public.cartoes
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "apagar o proprio cartao" on public.cartoes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Compras e previstos: além de serem do usuário, o cartão também tem de ser
-- dele — senão daria para pendurar uma compra no cartão de outra pessoa.
create policy "ver as proprias compras" on public.compras_cartao
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "criar compra no proprio cartao" on public.compras_cartao
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cartoes c where c.id = cartao_id and c.user_id = (select auth.uid()))
  );
create policy "editar as proprias compras" on public.compras_cartao
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cartoes c where c.id = cartao_id and c.user_id = (select auth.uid()))
  );
create policy "apagar as proprias compras" on public.compras_cartao
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ver os proprios previstos" on public.previstos_cartao
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "criar previsto no proprio cartao" on public.previstos_cartao
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cartoes c where c.id = cartao_id and c.user_id = (select auth.uid()))
  );
create policy "editar os proprios previstos" on public.previstos_cartao
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cartoes c where c.id = cartao_id and c.user_id = (select auth.uid()))
  );
create policy "apagar os proprios previstos" on public.previstos_cartao
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ver as proprias faturas" on public.faturas_cartao
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "criar fatura no proprio cartao" on public.faturas_cartao
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cartoes c where c.id = cartao_id and c.user_id = (select auth.uid()))
  );
create policy "editar as proprias faturas" on public.faturas_cartao
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cartoes c where c.id = cartao_id and c.user_id = (select auth.uid()))
  );
create policy "apagar as proprias faturas" on public.faturas_cartao
  for delete to authenticated using ((select auth.uid()) = user_id);
