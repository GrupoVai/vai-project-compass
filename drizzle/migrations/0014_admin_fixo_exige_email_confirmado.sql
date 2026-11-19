CREATE OR REPLACE FUNCTION public.novo_perfil()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare dono boolean := new.email_confirmed_at is not null and exists (select 1 from public.admins_fixos where email = lower(new.email));
begin
  insert into public.perfis (id, nome, email, papel, status, nivel, whatsapp)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)),
          lower(new.email),
          case when dono then 'admin' else 'consultor' end,
          case when dono then 'ativo' else 'pendente' end,
          case when dono then 'admin' else null end,
          nullif(trim(coalesce(new.raw_user_meta_data->>'whatsapp', '')), ''))
  on conflict (id) do nothing;
  return new;
end $function$;

DROP FUNCTION IF EXISTS public.confirmar_admin_fixo() CASCADE;

CREATE OR REPLACE FUNCTION public.promover_admin_confirmado()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null
     and exists (select 1 from public.admins_fixos where email = lower(new.email)) then
    update public.perfis set papel = 'admin', status = 'ativo', nivel = 'admin'
     where id = new.id and status = 'pendente';
  end if;
  return new;
end $function$;
REVOKE EXECUTE ON FUNCTION public.promover_admin_confirmado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ao_confirmar_email ON auth.users;
CREATE TRIGGER ao_confirmar_email AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.promover_admin_confirmado();