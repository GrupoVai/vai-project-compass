-- Cria o perfil de quem se cadastrou antes do gatilho de cadastro existir no banco do 2.0
-- (essas pessoas ficavam presas em "Aguardando liberação" e não apareciam para o administrador).
-- Pode rodar mais de uma vez sem erro.

insert into public.perfis (id, nome, email, papel, status, nivel, whatsapp)
select u.id,
       coalesce(nullif(trim(u.raw_user_meta_data->>'nome'), ''), split_part(u.email, '@', 1)),
       lower(u.email),
       case when f.email is not null then 'admin' else 'consultor' end,
       case when f.email is not null then 'ativo' else 'pendente' end,
       case when f.email is not null then 'admin' else null end,
       nullif(trim(coalesce(u.raw_user_meta_data->>'whatsapp', '')), '')
  from auth.users u
  left join public.admins_fixos f on f.email = lower(u.email)
 where not exists (select 1 from public.perfis p where p.id = u.id)
on conflict (id) do nothing;

update public.perfis set status = 'ativo', nivel = 'admin'
 where lower(email) in (select email from public.admins_fixos)
   and (status <> 'ativo' or nivel is distinct from 'admin');

-- ao entrar, o sistema garante que o perfil existe (e libera os administradores fixos)
create or replace function public.v2_garantir_perfil() returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mail text;
  meta jsonb;
  dono boolean;
begin
  if uid is null then return null; end if;
  select lower(email), coalesce(raw_user_meta_data, '{}'::jsonb) into mail, meta from auth.users where id = uid;
  if mail is null then return null; end if;
  dono := exists (select 1 from public.admins_fixos where email = mail);
  insert into public.perfis (id, nome, email, papel, status, nivel, whatsapp)
  values (uid,
          coalesce(nullif(trim(meta->>'nome'), ''), split_part(mail, '@', 1)),
          mail,
          case when dono then 'admin' else 'consultor' end,
          case when dono then 'ativo' else 'pendente' end,
          case when dono then 'admin' else null end,
          nullif(trim(coalesce(meta->>'whatsapp', '')), ''))
  on conflict (id) do nothing;
  if dono then
    update public.perfis set status = 'ativo', nivel = 'admin'
     where id = uid and (status <> 'ativo' or nivel is distinct from 'admin');
  end if;
  return (select status from public.perfis where id = uid);
end $$;
revoke all on function public.v2_garantir_perfil() from public;
grant execute on function public.v2_garantir_perfil() to authenticated;
