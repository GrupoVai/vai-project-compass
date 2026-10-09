create or replace function public.novo_perfil() returns trigger language plpgsql security definer set search_path = public as $$
declare dono boolean := lower(new.email) in ('renanbessa2@gmail.com', 'contato@grupovai.com.br');
begin
  insert into public.perfis (id, nome, email, papel, status)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)),
          lower(new.email),
          case when dono then 'admin' else 'consultor' end,
          'ativo')
  on conflict (id) do nothing;
  return new;
end $$;
alter table public.perfis alter column status set default 'ativo';