-- Agenda Inteligente: tabelas necessárias para notificações push.
-- Execute este arquivo no Supabase SQL Editor. Seguro para execução repetida.

create table if not exists public.push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create table if not exists public.push_notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null,
  reminder_key text not null,
  sent_at timestamptz not null default now(),
  unique(user_id, record_key, reminder_key)
);
alter table public.push_notification_log enable row level security;
