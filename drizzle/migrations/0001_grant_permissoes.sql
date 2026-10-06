grant select, insert, update, delete on public.perfis, public.registros to authenticated;
grant all on public.perfis, public.registros to service_role;
grant execute on function public.portal_cliente(text) to anon, authenticated;