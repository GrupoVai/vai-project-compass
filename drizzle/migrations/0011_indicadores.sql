-- Indicadores mensais dos clientes (Sales Tank e VAI Acelerar).
-- Só administradores e líderes do projeto (gestor ou líder da vertical) leem e gravam.
-- Pode rodar mais de uma vez sem erro.

create table if not exists public.v2_indicadores (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.v2_projetos(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  faturamento numeric(14,2),
  ticket_medio numeric(14,2),
  vendas integer check (vendas is null or vendas >= 0),
  meta numeric(14,2),
  obs text,
  atualizado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  unique (projeto_id, mes)
);

create or replace function public.v2_lidera_projeto(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.v2_edita(p.vertical, p.gestor) and p.vertical in ('tank','acelerar')
                     from public.v2_projetos p where p.id = pid), false)
$$;

create or replace function public.v2_indicadores_antes() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_por := auth.uid();
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists v2_indicadores_antes on public.v2_indicadores;
create trigger v2_indicadores_antes before insert or update on public.v2_indicadores
  for each row execute function public.v2_indicadores_antes();

alter table public.v2_indicadores enable row level security;
drop policy if exists "v2_indicadores_ler" on public.v2_indicadores;
create policy "v2_indicadores_ler" on public.v2_indicadores for select to authenticated
  using (public.v2_lidera_projeto(projeto_id));
drop policy if exists "v2_indicadores_criar" on public.v2_indicadores;
create policy "v2_indicadores_criar" on public.v2_indicadores for insert to authenticated
  with check (public.v2_lidera_projeto(projeto_id));
drop policy if exists "v2_indicadores_alterar" on public.v2_indicadores;
create policy "v2_indicadores_alterar" on public.v2_indicadores for update to authenticated
  using (public.v2_lidera_projeto(projeto_id)) with check (public.v2_lidera_projeto(projeto_id));
drop policy if exists "v2_indicadores_excluir" on public.v2_indicadores;
create policy "v2_indicadores_excluir" on public.v2_indicadores for delete to authenticated
  using (public.v2_lidera_projeto(projeto_id));

revoke all on public.v2_indicadores from anon;
grant select, insert, update, delete on public.v2_indicadores to authenticated;
grant all on public.v2_indicadores to service_role;
