-- Agenda Inteligente: sincronização segura entre dispositivos.
-- Execute este arquivo no Supabase SQL Editor UMA ÚNICA VEZ.
-- Migração aditiva: não apaga nem altera os registros existentes.

begin;

-- Carimbo de atualização para resolver conflitos por registro.
alter table public.events add column if not exists updated_at timestamptz not null default now();
alter table public.cards add column if not exists updated_at timestamptz not null default now();
alter table public.bills add column if not exists updated_at timestamptz not null default now();
alter table public.incomes add column if not exists updated_at timestamptz not null default now();
alter table public.budgets add column if not exists updated_at timestamptz not null default now();
alter table public.debts add column if not exists updated_at timestamptz not null default now();
alter table public.debt_payments add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_agenda_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := greatest(coalesce(new.updated_at, now()), old.updated_at + interval '1 microsecond', now());
  return new;
end;
$$;

drop trigger if exists agenda_events_updated_at on public.events;
create trigger agenda_events_updated_at before update on public.events
for each row execute function public.set_agenda_updated_at();
drop trigger if exists agenda_cards_updated_at on public.cards;
create trigger agenda_cards_updated_at before update on public.cards
for each row execute function public.set_agenda_updated_at();
drop trigger if exists agenda_bills_updated_at on public.bills;
create trigger agenda_bills_updated_at before update on public.bills
for each row execute function public.set_agenda_updated_at();
drop trigger if exists agenda_incomes_updated_at on public.incomes;
create trigger agenda_incomes_updated_at before update on public.incomes
for each row execute function public.set_agenda_updated_at();
drop trigger if exists agenda_budgets_updated_at on public.budgets;
create trigger agenda_budgets_updated_at before update on public.budgets
for each row execute function public.set_agenda_updated_at();
drop trigger if exists agenda_debts_updated_at on public.debts;
create trigger agenda_debts_updated_at before update on public.debts
for each row execute function public.set_agenda_updated_at();
drop trigger if exists agenda_debt_payments_updated_at on public.debt_payments;
create trigger agenda_debt_payments_updated_at before update on public.debt_payments
for each row execute function public.set_agenda_updated_at();

-- Tombstones registram exclusões para que elas não reapareçam em outro aparelho.
create table if not exists public.sync_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null check (table_name in ('events','cards','bills','incomes','debts','debt_payments')),
  record_id text not null,
  deleted_at timestamptz not null default now(),
  unique (user_id, table_name, record_id)
);

create index if not exists sync_deletions_user_idx
on public.sync_deletions(user_id, deleted_at desc);

alter table public.sync_deletions enable row level security;
drop policy if exists "Users manage own sync deletions" on public.sync_deletions;
create policy "Users manage own sync deletions"
on public.sync_deletions for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.sync_deletions to authenticated;

commit;

-- Observação: os registros existentes permanecem intactos. As exclusões passam a
-- ser registradas separadamente; não limpe sync_deletions sem um procedimento
-- coordenado de retenção para todos os dispositivos da conta.
