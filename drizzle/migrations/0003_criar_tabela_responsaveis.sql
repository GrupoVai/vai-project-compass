create table public.responsaveis (
  id bigint primary key,
  nome text not null,
  funcao text,
  contato text,
  criado_em timestamptz not null default now()
);

create unique index responsaveis_nome_unico on public.responsaveis (lower(nome));

alter table public.responsaveis enable row level security;

create policy "responsaveis_ler" on public.responsaveis for select to authenticated using (public.eh_membro());
create policy "responsaveis_criar" on public.responsaveis for insert to authenticated with check (public.eh_admin());
create policy "responsaveis_alterar" on public.responsaveis for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
create policy "responsaveis_excluir" on public.responsaveis for delete to authenticated using (public.eh_admin());

revoke all on public.responsaveis from anon;
grant select, insert, update, delete on public.responsaveis to authenticated;
grant all on public.responsaveis to service_role;