-- Agenda Inteligente: base segura para grupos familiares e convites.
-- Execute no Supabase SQL Editor depois de conferir o projeto correto.
-- Esta migração NÃO compartilha automaticamente eventos ou dados financeiros.
-- O compartilhamento por registro será habilitado somente em uma etapa separada,
-- com políticas RLS próprias para cada tabela.

create table if not exists public.family_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.family_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table if not exists public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.family_groups(id) on delete cascade,
  invited_email text not null,
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists family_members_user_idx on public.family_members(user_id);
create index if not exists family_invites_email_idx on public.family_invitations(lower(invited_email));

alter table public.family_groups enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invitations enable row level security;

drop policy if exists "Family members can view their groups" on public.family_groups;
create policy "Family members can view their groups"
on public.family_groups for select to authenticated
using (exists (
  select 1 from public.family_members m
  where m.family_id = family_groups.id and m.user_id = (select auth.uid())
));

drop policy if exists "Members can view own family membership" on public.family_members;
create policy "Members can view own family membership"
on public.family_members for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Inviters can view their invitations" on public.family_invitations;
create policy "Inviters can view their invitations"
on public.family_invitations for select to authenticated
using (invited_by = (select auth.uid()));

grant select on public.family_groups, public.family_members, public.family_invitations to authenticated;

create or replace function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'É necessário entrar na conta.'; end if;
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 80 then
    raise exception 'O nome da família deve ter entre 2 e 80 caracteres.';
  end if;

  insert into public.family_groups(name, owner_id)
  values (trim(p_name), v_uid)
  returning id into v_family_id;

  insert into public.family_members(family_id, user_id, role)
  values (v_family_id, v_uid, 'admin');

  return v_family_id;
end;
$$;

create or replace function public.invite_family_member(p_family_id uuid, p_email text)
returns table(invitation_token uuid, invitation_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email,'')));
  v_token uuid;
  v_expiry timestamptz;
begin
  if v_uid is null then raise exception 'É necessário entrar na conta.'; end if;
  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$' then
    raise exception 'Informe um e-mail válido.';
  end if;
  if not exists (
    select 1 from public.family_members m
    where m.family_id = p_family_id and m.user_id = v_uid and m.role = 'admin'
  ) then raise exception 'Somente o administrador da família pode convidar.'; end if;
  if exists (
    select 1 from public.family_members m
    join auth.users u on u.id = m.user_id
    where m.family_id = p_family_id and lower(u.email) = v_email
  ) then raise exception 'Esta pessoa já faz parte da família.'; end if;

  update public.family_invitations i
  set status = 'revoked'
  where i.family_id = p_family_id and lower(i.invited_email) = v_email and i.status = 'pending';

  insert into public.family_invitations(family_id, invited_email, invited_by)
  values (p_family_id, v_email, v_uid)
  returning token, expires_at into v_token, v_expiry;

  return query select v_token, v_expiry;
end;
$$;

create or replace function public.accept_family_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.family_invitations%rowtype;
begin
  if v_uid is null then raise exception 'Entre na sua conta antes de aceitar o convite.'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;

  select * into v_inv
  from public.family_invitations
  where token = p_token and status = 'pending' and expires_at > now()
  for update;

  if not found then raise exception 'Convite inválido, expirado ou já utilizado.'; end if;
  if lower(v_inv.invited_email) <> coalesce(v_email,'') then
    raise exception 'Este convite foi enviado para outro endereço de e-mail.';
  end if;

  insert into public.family_members(family_id, user_id, role)
  values (v_inv.family_id, v_uid, 'member')
  on conflict (family_id, user_id) do nothing;

  update public.family_invitations set status = 'accepted' where id = v_inv.id;
  return v_inv.family_id;
end;
$$;

create or replace function public.get_my_families()
returns table(family_id uuid, family_name text, member_role text, member_count bigint)
language sql
security definer
set search_path = ''
as $$
  select g.id, g.name, m.role,
    (select count(*) from public.family_members allm where allm.family_id = g.id)
  from public.family_groups g
  join public.family_members m on m.family_id = g.id
  where m.user_id = auth.uid()
  order by g.created_at desc;
$$;

revoke all on function public.create_family(text) from public;
revoke all on function public.invite_family_member(uuid,text) from public;
revoke all on function public.accept_family_invitation(uuid) from public;
revoke all on function public.get_my_families() from public;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.invite_family_member(uuid,text) to authenticated;
grant execute on function public.accept_family_invitation(uuid) to authenticated;
grant execute on function public.get_my_families() to authenticated;
