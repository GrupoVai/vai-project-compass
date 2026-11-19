-- Equipe e acessos: o administrador enxerga todas as pessoas cadastradas (ativas, pendentes e inativas).
-- Pode rodar mais de uma vez sem erro.

-- situações aceitas no cadastro (inclui "recusado", usado ao recusar um pedido)
alter table public.perfis drop constraint if exists perfis_status_check;
alter table public.perfis add constraint perfis_status_check
  check (status in ('pendente','ativo','bloqueado','recusado')) not valid;

-- cria o cadastro de quem entrou no login mas ficou sem perfil, para aparecer ao administrador
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
    left join public.admins_fixos f on f.email = lower(u.email)
   where u.email is not null
     and not exists (select 1 from public.perfis p where p.id = u.id)
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.v2_sincronizar_cadastros() from public;
grant execute on function public.v2_sincronizar_cadastros() to authenticated;

-- o administrador lê todos os cadastros, em qualquer situação
drop policy if exists "perfis_admin_ler_todos" on public.perfis;
create policy "perfis_admin_ler_todos" on public.perfis for select to authenticated
  using (public.v2_admin());

-- o administrador altera qualquer cadastro (liberar, desativar, reativar, recusar)
drop policy if exists "perfis_admin_alterar" on public.perfis;
create policy "perfis_admin_alterar" on public.perfis for update to authenticated
  using (public.v2_admin()) with check (public.v2_admin());
