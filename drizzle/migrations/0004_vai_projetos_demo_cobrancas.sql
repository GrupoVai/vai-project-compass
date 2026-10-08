-- VAI Projetos: atualização do demo (WhatsApp da equipe, cobranças do dia, "Meu dia" do responsável)
alter table public.perfis add column if not exists whatsapp text;

create table if not exists public.cobrancas (
  id bigint primary key,
  dados jsonb not null,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid()
);
alter table public.cobrancas enable row level security;
create policy "cobrancas_ler" on public.cobrancas for select to authenticated
  using (public.eh_admin() or dados->>'por' = public.meu_nome() or dados->>'para' = public.meu_nome());
create policy "cobrancas_criar" on public.cobrancas for insert to authenticated
  with check (public.eh_membro() and dados->>'por' = public.meu_nome());
revoke all on public.cobrancas from anon;
grant select, insert on public.cobrancas to authenticated;
grant all on public.cobrancas to service_role;

-- responsável por uma entrega (em projeto de outro consultor) vê e atualiza essa entrega e vê o projeto dela
create or replace function public.sou_responsavel_no_projeto(pid bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_membro() and exists (
    select 1 from public.registros r
    where r.colecao = 'entregas' and (r.dados->>'projeto_id')::bigint = pid
      and r.dados->>'responsavel' = public.meu_nome())
$$;
create policy "registros_ler_responsavel" on public.registros for select to authenticated
  using (public.eh_membro() and (
    (colecao = 'entregas' and dados->>'responsavel' = public.meu_nome())
    or (colecao = 'projetos' and public.sou_responsavel_no_projeto(id))
    or (colecao = 'eventos' and public.sou_responsavel_no_projeto((dados->>'projeto_id')::bigint))));
create policy "registros_alterar_responsavel" on public.registros for update to authenticated
  using (public.eh_membro() and colecao = 'entregas' and dados->>'responsavel' = public.meu_nome())
  with check (public.eh_membro() and colecao = 'entregas');
create policy "registros_evento_responsavel" on public.registros for insert to authenticated
  with check (public.eh_membro() and colecao = 'eventos'
    and public.sou_responsavel_no_projeto((dados->>'projeto_id')::bigint));