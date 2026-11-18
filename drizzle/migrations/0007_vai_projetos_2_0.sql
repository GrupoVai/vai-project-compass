-- VAI Projetos 2.0: equipe com alçadas, projetos (modelos ou do zero), pós-venda,
-- atividades do dia a dia, rotinas e modelos criados pela equipe.
-- Pode rodar mais de uma vez sem erro. Não altera nem apaga dados das tabelas antigas.

-- ============ administradores fixos ============
create table if not exists public.admins_fixos (email text primary key);
alter table public.admins_fixos enable row level security;
grant all on public.admins_fixos to service_role;
insert into public.admins_fixos (email)
values ('pbrasilmachado@gmail.com'), ('contato@grupovai.com.br'), ('renanbessa2@gmail.com')
on conflict do nothing;

-- ============ perfis: alçada, cargo e funções ============
alter table public.perfis add column if not exists whatsapp text;
alter table public.perfis add column if not exists nivel text;
alter table public.perfis add column if not exists cargo text;
alter table public.perfis add column if not exists setor text;
alter table public.perfis add column if not exists verticais text[] not null default '{}';
alter table public.perfis add column if not exists funcoes text[] not null default '{}';
alter table public.perfis add column if not exists cliente text;
alter table public.perfis add column if not exists extra text;
do $$ begin
  alter table public.perfis add constraint perfis_nivel_check
    check (nivel is null or nivel in ('admin','lider','esp','oper','cliente'));
exception when duplicate_object then null; end $$;

update public.perfis set nivel = 'admin' where papel = 'admin' and nivel is null;
update public.perfis set papel = 'admin', status = 'ativo', nivel = 'admin'
 where lower(email) in (select email from public.admins_fixos);

-- o papel antigo acompanha a alçada (o servidor usa papel = 'admin')
create or replace function public.v2_sincroniza_papel() returns trigger
language plpgsql set search_path = public as $$
begin
  new.papel := case when new.nivel = 'admin' then 'admin' else 'consultor' end;
  return new;
end $$;
drop trigger if exists v2_sincroniza_papel on public.perfis;
create trigger v2_sincroniza_papel before insert or update of nivel on public.perfis
  for each row execute function public.v2_sincroniza_papel();

-- todo cadastro novo nasce pendente e sem alçada; administradores fixos já entram liberados
create or replace function public.novo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare dono boolean := exists (select 1 from public.admins_fixos where email = lower(new.email));
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
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_perfil();

create or replace function public.meu_status() returns text
language sql stable security definer set search_path = public as $$
  select status from public.perfis where id = auth.uid()
$$;
grant execute on function public.meu_status() to authenticated;

-- ============ funções de apoio das alçadas ============
create or replace function public.v2_arr(j jsonb) returns jsonb
language sql immutable as $$
  select case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end
$$;
create or replace function public.v2_eu_nivel() returns text
language sql stable security definer set search_path = public as $$
  select nivel from public.perfis where id = auth.uid() and status = 'ativo'
$$;
create or replace function public.v2_eu_verticais() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select verticais from public.perfis where id = auth.uid() and status = 'ativo'), '{}')
$$;
create or replace function public.v2_eu_cliente() returns text
language sql stable security definer set search_path = public as $$
  select cliente from public.perfis where id = auth.uid() and status = 'ativo' and nivel = 'cliente'
$$;
create or replace function public.v2_time() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.v2_eu_nivel() in ('admin','lider','esp','oper'), false)
$$;
create or replace function public.v2_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.v2_eu_nivel() = 'admin', false)
$$;
create or replace function public.v2_comercial() returns boolean
language sql stable security definer set search_path = public as $$
  select public.v2_admin() or exists (
    select 1 from public.perfis where id = auth.uid() and status = 'ativo'
      and nivel in ('lider','esp','oper') and setor = 'comercial')
$$;
-- quem edita um projeto: administrador, gestor do projeto ou líder da vertical
create or replace function public.v2_edita(pv text, pg uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.v2_eu_nivel() = 'admin'
    or (public.v2_eu_nivel() in ('admin','lider') and pg = auth.uid())
    or (public.v2_eu_nivel() = 'lider' and pv = any(public.v2_eu_verticais())), false)
$$;

-- a equipe ativa vê a equipe (nomes, cargos e funções); cada um continua vendo o próprio cadastro
drop policy if exists "perfis_ler_time" on public.perfis;
create policy "perfis_ler_time" on public.perfis for select to authenticated using (public.v2_time());

-- ============ projetos ============
create table if not exists public.v2_projetos (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  vertical text not null check (vertical in ('acelerar','tank','hunter','tech')),
  gestor uuid references public.perfis(id) on delete set null,
  status text not null default 'montagem' check (status in ('montagem','apresentacao','ativo','encerrado')),
  dados jsonb not null default '{}'::jsonb,
  membros uuid[] not null default '{}',
  versao integer not null default 1,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index if not exists v2_projetos_cliente on public.v2_projetos (lower(cliente));
create index if not exists v2_projetos_membros on public.v2_projetos using gin (membros);

-- membros = gestor + responsáveis de fase + responsáveis e participantes das atividades
create or replace function public.v2_projeto_antes() returns trigger
language plpgsql set search_path = public as $$
begin
  new.membros := coalesce((
    select array_agg(distinct x::uuid) from (
      select new.gestor::text as x
      union all select f->>'resp' from jsonb_array_elements(public.v2_arr(new.dados->'fases')) f
      union all select a->>'resp'
        from jsonb_array_elements(public.v2_arr(new.dados->'fases')) f,
             jsonb_array_elements(public.v2_arr(f->'et')) e,
             jsonb_array_elements(public.v2_arr(e->'acts')) a
      union all select ap
        from jsonb_array_elements(public.v2_arr(new.dados->'fases')) f,
             jsonb_array_elements(public.v2_arr(f->'et')) e,
             jsonb_array_elements(public.v2_arr(e->'acts')) a,
             jsonb_array_elements_text(public.v2_arr(a->'apoio')) ap
    ) s
    where x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'), '{}');
  if tg_op = 'UPDATE' then new.versao := old.versao + 1; end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists v2_projeto_antes on public.v2_projetos;
create trigger v2_projeto_antes before insert or update on public.v2_projetos
  for each row execute function public.v2_projeto_antes();

alter table public.v2_projetos enable row level security;
drop policy if exists "v2_projetos_ler" on public.v2_projetos;
create policy "v2_projetos_ler" on public.v2_projetos for select to authenticated
  using (public.v2_edita(vertical, gestor) or (public.v2_time() and auth.uid() = any(membros)));
drop policy if exists "v2_projetos_criar" on public.v2_projetos;
create policy "v2_projetos_criar" on public.v2_projetos for insert to authenticated
  with check (public.v2_admin() or (public.v2_eu_nivel() = 'lider' and vertical = any(public.v2_eu_verticais())));
drop policy if exists "v2_projetos_alterar" on public.v2_projetos;
create policy "v2_projetos_alterar" on public.v2_projetos for update to authenticated
  using (public.v2_edita(vertical, gestor))
  with check (public.v2_admin() or (public.v2_eu_nivel() = 'lider' and (vertical = any(public.v2_eu_verticais()) or gestor = auth.uid())));
drop policy if exists "v2_projetos_excluir" on public.v2_projetos;
create policy "v2_projetos_excluir" on public.v2_projetos for delete to authenticated
  using (public.v2_admin());

-- ações pontuais em atividades (quem não edita o projeto também pode: concluir a sua,
-- aceitar novo prazo, incluir a sua atividade, aceitar os prazos; o cliente marca a dele)
create or replace function public.v2_acao(p_id uuid, p_acao text, p_ativ text default null, p_dados jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.v2_projetos;
  eu uuid := auth.uid();
  niv text := public.v2_eu_nivel();
  ed boolean;
  a jsonb;
  cobr text;
  novo jsonb;
begin
  if eu is null or niv is null then raise exception 'Faça login de novo.'; end if;
  select * into r from public.v2_projetos where id = p_id for update;
  if not found then raise exception 'Projeto não encontrado.'; end if;
  ed := public.v2_edita(r.vertical, r.gestor);
  cobr := case when r.vertical = 'acelerar' and coalesce(r.dados->'equipe'->>'ind', '') <> ''
               then r.dados->'equipe'->>'ind' else r.gestor::text end;

  if p_acao = 'aceite' then
    if not (r.status = 'apresentacao' and (ed or eu = any(r.membros))) then raise exception 'Sem permissão.'; end if;
    r.dados := jsonb_set(r.dados, '{aceites}', coalesce(r.dados->'aceites', '{}'::jsonb) || jsonb_build_object(eu::text, true));

  elsif p_acao = 'incluir' then
    if r.status <> 'ativo' then raise exception 'O projeto não está ativo.'; end if;
    if not (ed or (niv in ('admin','lider','esp','oper') and eu = any(r.membros) and p_dados->>'resp' = eu::text)) then
      raise exception 'Sem permissão.'; end if;
    p_dados := p_dados || jsonb_build_object('criadaPor', eu::text, 'pend', (p_dados->>'resp') <> eu::text, 'done', false);
    r.dados := jsonb_set(r.dados, '{fases}', (
      select coalesce(jsonb_agg(jsonb_set(f, '{et}', (
        select coalesce(jsonb_agg(case when e->>'id' = p_ativ
                                       then jsonb_set(e, '{acts}', public.v2_arr(e->'acts') || jsonb_build_array(p_dados))
                                       else e end order by eo), '[]'::jsonb)
        from jsonb_array_elements(public.v2_arr(f->'et')) with ordinality as t2(e, eo))) order by fo), '[]'::jsonb)
      from jsonb_array_elements(public.v2_arr(r.dados->'fases')) with ordinality as t1(f, fo)));

  else
    select x into a
      from jsonb_array_elements(public.v2_arr(r.dados->'fases')) f,
           jsonb_array_elements(public.v2_arr(f->'et')) e,
           jsonb_array_elements(public.v2_arr(e->'acts')) x
     where x->>'id' = p_ativ limit 1;
    if a is null then raise exception 'Atividade não encontrada.'; end if;

    if p_acao = 'concluir' then
      if not (r.status = 'ativo' and (ed or a->>'resp' = eu::text or (a->>'resp' = 'cliente' and cobr = eu::text))) then
        raise exception 'Sem permissão.'; end if;
      novo := jsonb_build_object('done', coalesce((p_dados->>'done')::boolean, true),
                                 'doneAt', case when coalesce((p_dados->>'done')::boolean, true) then to_jsonb(current_date::text) else 'null'::jsonb end);
    elsif p_acao = 'aceitar_prazo' then
      if a->>'resp' <> eu::text then raise exception 'Sem permissão.'; end if;
      novo := '{"pend": false}'::jsonb;
    elsif p_acao = 'cliente_feito' then
      if not (niv = 'cliente' and r.status = 'ativo' and lower(r.cliente) = lower(coalesce(public.v2_eu_cliente(), ''))
              and a->>'resp' = 'cliente') then raise exception 'Sem permissão.'; end if;
      novo := jsonb_build_object('cliFeito', current_date::text);
    elsif p_acao = 'confirmar' then
      if not (ed or cobr = eu::text) then raise exception 'Sem permissão.'; end if;
      novo := jsonb_build_object('done', true, 'doneAt', coalesce(a->'cliFeito', to_jsonb(current_date::text)), 'cliFeito', null);
    elsif p_acao = 'negar' then
      if not (ed or cobr = eu::text) then raise exception 'Sem permissão.'; end if;
      novo := '{"cliFeito": null}'::jsonb;
    elsif p_acao = 'editar' then
      if not ed then raise exception 'Sem permissão.'; end if;
      novo := p_dados - 'id';
    else
      raise exception 'Ação desconhecida.';
    end if;

    r.dados := jsonb_set(r.dados, '{fases}', (
      select coalesce(jsonb_agg(jsonb_set(f, '{et}', (
        select coalesce(jsonb_agg(jsonb_set(e, '{acts}', (
          select coalesce(jsonb_agg(case when x->>'id' = p_ativ then x || novo else x end order by xo), '[]'::jsonb)
          from jsonb_array_elements(public.v2_arr(e->'acts')) with ordinality as t3(x, xo))) order by eo), '[]'::jsonb)
        from jsonb_array_elements(public.v2_arr(f->'et')) with ordinality as t2(e, eo))) order by fo), '[]'::jsonb)
      from jsonb_array_elements(public.v2_arr(r.dados->'fases')) with ordinality as t1(f, fo)));
  end if;

  update public.v2_projetos set dados = r.dados where id = p_id;
  if niv = 'cliente' then return null; end if;
  return (select to_jsonb(p) from public.v2_projetos p where p.id = p_id);
end $$;
revoke all on function public.v2_acao(uuid, text, text, jsonb) from public;
grant execute on function public.v2_acao(uuid, text, text, jsonb) to authenticated;

-- área do cliente: só os projetos ativos do próprio cliente, sem histórico interno
create or replace function public.v2_portal() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'projetos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'cliente', p.cliente, 'vertical', p.vertical, 'gestor', p.gestor, 'status', p.status,
        'dados', jsonb_set(p.dados - 'aceites' - 'validado', '{fases}', (
          select coalesce(jsonb_agg(jsonb_set(f, '{et}', (
            select coalesce(jsonb_agg(jsonb_set(e, '{acts}', (
              select coalesce(jsonb_agg(x - 'hist' - 'orig' - 'repl' - 'pend' - 'criadaPor' order by xo), '[]'::jsonb)
              from jsonb_array_elements(public.v2_arr(e->'acts')) with ordinality as t3(x, xo))) order by eo), '[]'::jsonb)
            from jsonb_array_elements(public.v2_arr(f->'et')) with ordinality as t2(e, eo))) order by fo), '[]'::jsonb)
          from jsonb_array_elements(public.v2_arr(p.dados->'fases')) with ordinality as t1(f, fo))))
        order by p.criado_em)
      from public.v2_projetos p
      where public.v2_eu_cliente() is not null and lower(p.cliente) = lower(public.v2_eu_cliente()) and p.status = 'ativo'), '[]'::jsonb),
    'pessoas', coalesce((
      select jsonb_object_agg(pe.id::text, jsonb_build_object('nome', pe.nome, 'cargo', pe.cargo))
      from public.perfis pe
      where pe.id in (select unnest(p.membros) from public.v2_projetos p
                      where public.v2_eu_cliente() is not null and lower(p.cliente) = lower(public.v2_eu_cliente()) and p.status = 'ativo')), '{}'::jsonb))
$$;
revoke all on function public.v2_portal() from public;
grant execute on function public.v2_portal() to authenticated;

-- ============ pós-venda ============
create table if not exists public.v2_vendas (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  dados jsonb not null default '{}'::jsonb,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.v2_vendas enable row level security;
drop policy if exists "v2_vendas_ler" on public.v2_vendas;
create policy "v2_vendas_ler" on public.v2_vendas for select to authenticated
  using (public.v2_comercial() or (public.v2_time() and dados->>'gestor' = auth.uid()::text));
drop policy if exists "v2_vendas_criar" on public.v2_vendas;
create policy "v2_vendas_criar" on public.v2_vendas for insert to authenticated
  with check (public.v2_comercial());
drop policy if exists "v2_vendas_alterar" on public.v2_vendas;
create policy "v2_vendas_alterar" on public.v2_vendas for update to authenticated
  using (public.v2_comercial() or (public.v2_time() and dados->>'gestor' = auth.uid()::text))
  with check (public.v2_comercial() or (public.v2_time() and dados->>'gestor' = auth.uid()::text));
drop policy if exists "v2_vendas_excluir" on public.v2_vendas;
create policy "v2_vendas_excluir" on public.v2_vendas for delete to authenticated
  using (public.v2_comercial() or public.v2_eu_nivel() = 'lider');

-- ============ atividades do dia a dia (sem projeto) ============
create table if not exists public.v2_avulsas (
  id uuid primary key default gen_random_uuid(),
  resp uuid not null references public.perfis(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
alter table public.v2_avulsas enable row level security;
drop policy if exists "v2_avulsas_ler" on public.v2_avulsas;
create policy "v2_avulsas_ler" on public.v2_avulsas for select to authenticated
  using (public.v2_time() and (resp = auth.uid() or criado_por = auth.uid() or public.v2_eu_nivel() in ('admin','lider')));
drop policy if exists "v2_avulsas_criar" on public.v2_avulsas;
create policy "v2_avulsas_criar" on public.v2_avulsas for insert to authenticated
  with check (public.v2_time() and criado_por = auth.uid() and (resp = auth.uid() or public.v2_eu_nivel() in ('admin','lider')));
drop policy if exists "v2_avulsas_alterar" on public.v2_avulsas;
create policy "v2_avulsas_alterar" on public.v2_avulsas for update to authenticated
  using (public.v2_time() and (resp = auth.uid() or criado_por = auth.uid() or public.v2_admin()))
  with check (public.v2_time());
drop policy if exists "v2_avulsas_excluir" on public.v2_avulsas;
create policy "v2_avulsas_excluir" on public.v2_avulsas for delete to authenticated
  using (public.v2_time() and (criado_por = auth.uid() or public.v2_admin()));

-- ============ rotinas (checklist: Tutoria e BPO) ============
create table if not exists public.v2_rotinas (
  chave text primary key,
  feito boolean not null default true,
  por uuid default auth.uid(),
  em timestamptz not null default now()
);
alter table public.v2_rotinas enable row level security;
drop policy if exists "v2_rotinas_ler" on public.v2_rotinas;
create policy "v2_rotinas_ler" on public.v2_rotinas for select to authenticated using (public.v2_time());
drop policy if exists "v2_rotinas_gravar" on public.v2_rotinas;
create policy "v2_rotinas_gravar" on public.v2_rotinas for insert to authenticated with check (public.v2_time());
drop policy if exists "v2_rotinas_alterar" on public.v2_rotinas;
create policy "v2_rotinas_alterar" on public.v2_rotinas for update to authenticated using (public.v2_time()) with check (public.v2_time());

-- ============ modelos criados pela equipe ============
create table if not exists public.v2_modelos (
  id text primary key,
  dados jsonb not null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
alter table public.v2_modelos enable row level security;
drop policy if exists "v2_modelos_ler" on public.v2_modelos;
create policy "v2_modelos_ler" on public.v2_modelos for select to authenticated using (public.v2_time());
drop policy if exists "v2_modelos_gravar" on public.v2_modelos;
create policy "v2_modelos_gravar" on public.v2_modelos for all to authenticated
  using (public.v2_admin()) with check (public.v2_admin());

-- ============ permissões ============
revoke all on public.v2_projetos, public.v2_vendas, public.v2_avulsas, public.v2_rotinas, public.v2_modelos from anon;
grant select, insert, update, delete on public.v2_projetos, public.v2_vendas, public.v2_avulsas, public.v2_rotinas, public.v2_modelos to authenticated;
grant all on public.v2_projetos, public.v2_vendas, public.v2_avulsas, public.v2_rotinas, public.v2_modelos to service_role;
grant select, update on public.perfis to authenticated;
