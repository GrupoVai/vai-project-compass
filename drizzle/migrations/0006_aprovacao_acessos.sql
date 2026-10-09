drop index if exists public.perfis_nome_unico;
alter table public.perfis drop constraint perfis_status_check;
alter table public.perfis add constraint perfis_status_check check (status = any (array['pendente','ativo','bloqueado','recusado']));

create table if not exists public.admins_fixos (email text primary key);
grant all on public.admins_fixos to service_role;
alter table public.admins_fixos enable row level security;
insert into public.admins_fixos (email) values ('contato@grupovai.com.br'), ('renanbessa2@gmail.com') on conflict do nothing;

create or replace function public.novo_perfil() returns trigger language plpgsql security definer set search_path = public as $$
declare dono boolean := exists (select 1 from public.admins_fixos where email = lower(new.email));
begin
  insert into public.perfis (id, nome, email, papel, status)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)),
          lower(new.email),
          case when dono then 'admin' else 'consultor' end,
          case when dono then 'ativo' else 'pendente' end)
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.confirmar_admin_fixo() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.admins_fixos where email = lower(new.email)) and new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists confirmar_admin_fixo on auth.users;
create trigger confirmar_admin_fixo before insert on auth.users for each row execute function public.confirmar_admin_fixo();

-- status do próprio pedido (para a mensagem no login), sem abrir a tabela
create or replace function public.meu_status() returns text language sql stable security definer set search_path = public as $$
  select status from public.perfis where id = auth.uid()
$$;
grant execute on function public.meu_status() to authenticated;