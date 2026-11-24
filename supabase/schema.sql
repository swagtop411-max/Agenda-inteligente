-- Agenda Inteligente: schema inicial para Supabase
-- Seguro para execução repetida. Não contém dados pessoais.
-- Todas as tabelas pertencem a um usuário autenticado; RLS impede acesso cruzado.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  time text,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  "limit" numeric(14,2) not null default 0 check ("limit" >= 0),
  closing integer not null default 1 check (closing between 1 and 31),
  due integer not null default 1 check (due between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid,
  title text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  date date not null,
  part integer not null default 1 check (part >= 1),
  count integer not null default 1 check (count >= 1),
  paid boolean not null default false,
  card_id uuid references public.cards(id) on delete set null,
  kind text not null default 'bill',
  category text not null default 'Outros',
  created_at timestamptz not null default now()
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  category text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, month, category)
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null default 'mandatory',
  balance numeric(14,2) not null default 0 check (balance >= 0),
  initial_balance numeric(14,2) not null default 0 check (initial_balance >= 0),
  minimum numeric(14,2) not null default 0 check (minimum >= 0),
  interest numeric(8,4) not null default 0 check (interest >= 0),
  date date,
  risk text not null default 'medium',
  created_at timestamptz not null default now()
);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  date date not null,
  note text not null default '',
  include_in_finance boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists events_user_date_idx on public.events(user_id, date);
create index if not exists bills_user_date_idx on public.bills(user_id, date);
create index if not exists bills_user_group_idx on public.bills(user_id, group_id);
create index if not exists incomes_user_date_idx on public.incomes(user_id, date);
create index if not exists debts_user_date_idx on public.debts(user_id, date);
create index if not exists debt_payments_user_date_idx on public.debt_payments(user_id, date);
create index if not exists debt_payments_debt_idx on public.debt_payments(debt_id);

alter table public.events enable row level security;
alter table public.cards enable row level security;
alter table public.bills enable row level security;
alter table public.incomes enable row level security;
alter table public.budgets enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;

-- Cada usuário só pode consultar e alterar linhas cujo user_id seja o próprio auth.uid().
do $$
declare
  tbl text;
begin
  foreach tbl in array array['events','cards','bills','incomes','budgets','debts','debt_payments']
  loop
    execute format('drop policy if exists "Users manage own %I" on public.%I', tbl, tbl);
    execute format(
      'create policy "Users manage own %I" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      tbl, tbl
    );
  end loop;
end $$;

grant select, insert, update, delete on
  public.events, public.cards, public.bills, public.incomes,
  public.budgets, public.debts, public.debt_payments
to authenticated;

-- Não habilite acesso anon às tabelas. A aplicação deve autenticar antes da sincronização.
