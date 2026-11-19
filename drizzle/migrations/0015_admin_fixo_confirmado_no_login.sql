-- Administrador fixo só vira administrador com o e-mail confirmado também ao entrar no sistema
-- e na sincronização de cadastros (mesma regra da migração 0014). Pode rodar mais de uma vez sem erro.

-- cadastros sem perfil: cria como pendente (administrador fixo só com e-mail confirmado)
create or replace function public.v2_sincronizar_cadastros() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.v2_admin() then return 0; end if;
  insert into public.perfis (id, nome, email, papel, status, nivel, whatsapp)
  select u.id,
         coalesce(nullif(trim(u.raw_user_meta_data->>'nome'), ''), split_part(u.email, '@', 1)),
         lower(u.email),
         case when f.email is not null then 'admin' else 'consultor' end,
         case when f.email is not null then 'ativo' else 'pendente' end,
         case when f.email is not null then 'admin' else null end,
         nullif(trim(coalesce(u.raw_user_meta_data->>'whatsapp', '')), '')
    from auth.users u
    left join public.admins_fixos f on f.email = lower(u.email) and u.email_confirmed_at is not null
   where u.email is not null
     and not exists (select 1 from public.perfis p where p.id = u.id)
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.v2_sincronizar_cadastros() from public;
grant execute on function public.v2_sincronizar_cadastros() to authenticated;

create or replace function public.v2_garantir_perfil() returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  mail text;
  meta jsonb;
  dono boolean;
begin
  if uid is null then return null; end if;
  select lower(email), coalesce(raw_user_meta_data, '{}'::jsonb), email_confirmed_at is not null
    into mail, meta, dono from auth.users where id = uid;
  if mail is null then return null; end if;
  dono := dono and exists (select 1 from public.admins_fixos where email = mail);
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
     where id = uid and status = 'pendente';
  end if;
  return (select status from public.perfis where id = uid);
end $$;
revoke all on function public.v2_garantir_perfil() from public;
grant execute on function public.v2_garantir_perfil() to authenticated;
