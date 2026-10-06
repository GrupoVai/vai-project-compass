-- VAI Projetos: acessos da equipe, dados com regras de acesso e link do cliente
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  papel text not null default 'consultor' check (papel in ('admin','consultor')),
  status text not null default 'pendente' check (status in ('pendente','ativo','bloqueado')),
  criado_em timestamptz not null default now()
);
create unique index perfis_nome_unico on public.perfis (lower(nome));
create unique index perfis_email_unico on public.perfis (lower(email));
alter table public.perfis enable row level security;

create table public.registros (
  colecao text not null check (colecao in ('clientes','projetos','entregas','eventos','metricas')),
  id bigint not null,
  cliente_id bigint not null,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (colecao, id)
);
create index registros_cliente on public.registros (cliente_id);
create index registros_token on public.registros ((dados->>'token')) where colecao = 'projetos';
alter table public.registros enable row level security;

-- funções de apoio (security definer para não entrar em recursão nas regras)
create or replace function public.eh_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and status = 'ativo')
$$;
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and status = 'ativo' and papel = 'admin')
$$;
create or replace function public.meu_nome() returns text
language sql stable security definer set search_path = public as $$
  select nome from public.perfis where id = auth.uid() and status = 'ativo'
$$;
create or replace function public.pode_ver_cliente(cid bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_admin() or (
    public.eh_membro() and exists (
      select 1 from public.registros r
      where r.cliente_id = cid and r.colecao in ('clientes','projetos')
        and r.dados->>'consultor' = public.meu_nome()))
$$;

-- perfis: cada um lê o próprio; o administrador lê e altera todos
create policy "perfis_ler" on public.perfis for select to authenticated
  using (id = auth.uid() or public.eh_admin());
create policy "perfis_alterar" on public.perfis for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
create policy "perfis_excluir" on public.perfis for delete to authenticated
  using (public.eh_admin() and id <> auth.uid());

-- registros: consultor só na carteira dele; administrador em tudo
create policy "registros_ler" on public.registros for select to authenticated
  using (public.pode_ver_cliente(cliente_id));
create policy "registros_criar" on public.registros for insert to authenticated
  with check (public.eh_admin() or (public.eh_membro() and (
    (colecao in ('clientes','projetos') and dados->>'consultor' = public.meu_nome())
    or public.pode_ver_cliente(cliente_id))));
create policy "registros_alterar" on public.registros for update to authenticated
  using (public.pode_ver_cliente(cliente_id)) with check (public.pode_ver_cliente(cliente_id));
create policy "registros_excluir" on public.registros for delete to authenticated
  using (public.eh_admin() or (colecao in ('entregas','eventos','metricas') and public.pode_ver_cliente(cliente_id)));

revoke all on public.perfis from anon;
revoke all on public.registros from anon;

-- todo cadastro novo nasce como pedido pendente; o e-mail do dono nasce administrador
create or replace function public.novo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare dono boolean := lower(new.email) = 'contato@grupovai.com.br';
begin
  insert into public.perfis (id, nome, email, papel, status)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)),
          lower(new.email),
          case when dono then 'admin' else 'consultor' end,
          case when dono then 'ativo' else 'pendente' end);
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_perfil();

-- link de acompanhamento: devolve só o projeto do token, sem notas internas
create or replace function public.portal_cliente(tok text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.registros%rowtype;
begin
  if tok is null or length(tok) < 16 then return null; end if;
  select * into p from public.registros where colecao = 'projetos' and dados->>'token' = tok limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'projeto', p.dados,
    'cliente', (select dados - 'observacoes' from public.registros where colecao = 'clientes' and id = p.cliente_id),
    'entregas', coalesce((select jsonb_agg(dados - 'nota' order by id) from public.registros
                          where colecao = 'entregas' and (dados->>'projeto_id')::bigint = p.id), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(dados order by id) from public.registros
                         where colecao = 'eventos' and (dados->>'projeto_id')::bigint = p.id
                           and coalesce((dados->>'publico')::boolean, false)), '[]'::jsonb),
    'metricas', (select dados from public.registros where colecao = 'metricas' and id = p.cliente_id));
end $$;
revoke all on function public.portal_cliente(text) from public;
grant execute on function public.portal_cliente(text) to anon, authenticated;