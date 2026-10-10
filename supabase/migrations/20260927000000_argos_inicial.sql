-- =============================================================================
-- ARGOS — Módulo 1: Gerencial DUN PROFESSIONAL
-- Migration inicial: tabelas, versionamento de cargas, cálculos (views) e RLS
-- =============================================================================
-- Princípios:
--   1. Histórico imutável: cargas, linhas e despesas nunca são apagadas nem
--      editadas. Corrigir = criar nova versão. Só a marcação "vigente" muda.
--   2. O banco guarda apenas ENTRADAS (base do Winthor + despesa do mês).
--      Participação, rateio, LB¹ e consolidado anual saem das views.
--   3. Toda gravação passa por funções (RPC), que fazem o versionamento de
--      forma atômica. O front não insere direto nas tabelas.
--
-- Percentuais nas VIEWS são frações (0.2281 = 22,81%).
-- Exceção: faturamento_linhas.margem_pct guarda o % como veio do Winthor
-- (25.2195 = 25,2195%), para bater 1:1 com o arquivo original.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. PERFIS DE ACESSO
-- -----------------------------------------------------------------------------
-- admin  : tudo, inclusive gerenciar perfis
-- editor : envia cargas, lança despesas, troca versão vigente, edita departamentos
-- leitor : só visualiza
-- Usuário sem linha em perfis não enxerga nada.
--
-- Primeiro admin (rodar uma vez no SQL Editor, após criar o usuário no Auth):
--   insert into public.perfis (user_id, nome, papel)
--   values ('<uuid do usuário>', 'Nic', 'admin');

create table public.perfis (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nome       text,
  papel      text not null default 'leitor' check (papel in ('admin', 'editor', 'leitor')),
  criado_em  timestamptz not null default now()
);

create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from public.perfis where user_id = auth.uid()
$$;


-- -----------------------------------------------------------------------------
-- 2. CADASTROS
-- -----------------------------------------------------------------------------
create table public.distribuidoras (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  nome       text not null,
  criado_em  timestamptz not null default now()
);

insert into public.distribuidoras (slug, nome)
values ('dun-professional', 'DUN PROFESSIONAL');

-- Departamentos são criados automaticamente pelas cargas.
-- codigo_winthor pode ficar nulo apenas para departamentos vindos do histórico
-- da planilha que ainda não apareceram numa base do Winthor; quando aparecerem,
-- o código é preenchido automaticamente pelo nome (ver _resolver_departamento).
create table public.departamentos (
  id                      uuid primary key default gen_random_uuid(),
  distribuidora_id        uuid not null references public.distribuidoras (id),
  codigo_winthor          integer,
  nome                    text not null,
  exclusivo_professional  boolean not null default false,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  unique (distribuidora_id, codigo_winthor)
);

create or replace function public._tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger departamentos_atualizado_em
  before update on public.departamentos
  for each row execute function public._tocar_atualizado_em();


-- -----------------------------------------------------------------------------
-- 3. CARGAS DE FATURAMENTO (versionadas)
-- -----------------------------------------------------------------------------
create table public.cargas_faturamento (
  id                  uuid primary key default gen_random_uuid(),
  distribuidora_id    uuid not null references public.distribuidoras (id),
  mes_ref             date not null check (mes_ref = date_trunc('month', mes_ref)::date),
  versao              integer not null check (versao > 0),
  vigente             boolean not null default false,
  origem              text not null default 'upload' check (origem in ('upload', 'historico_planilha')),
  arquivo_nome        text,
  arquivo_path        text,          -- caminho no bucket argos-bases
  qtd_linhas          integer not null,
  total_faturamento   numeric(18, 4) not null,
  total_margem_valor  numeric(20, 6) not null,
  observacao          text,
  enviado_por         uuid default auth.uid(),
  enviado_em          timestamptz not null default now(),
  unique (distribuidora_id, mes_ref, versao)
);

-- no máximo UMA versão vigente por distribuidora/mês
create unique index cargas_faturamento_uma_vigente
  on public.cargas_faturamento (distribuidora_id, mes_ref)
  where vigente;

create table public.faturamento_linhas (
  id                   bigint generated always as identity primary key,
  carga_id             uuid not null references public.cargas_faturamento (id),
  departamento_id      uuid not null references public.departamentos (id),
  codigo_winthor       integer,       -- como veio no arquivo
  nome_departamento    text not null, -- como veio no arquivo
  faturamento_liquido  numeric(18, 4) not null,
  margem_pct           numeric(20, 10) not null,  -- % do Winthor (ex.: 25.2195)
  margem_valor         numeric(20, 6)
                       generated always as (faturamento_liquido * margem_pct / 100) stored,
  linha_original       jsonb,         -- linha inteira do arquivo, para auditoria
  unique (carga_id, departamento_id)
);

create index faturamento_linhas_departamento on public.faturamento_linhas (departamento_id);


-- -----------------------------------------------------------------------------
-- 4. DESPESA MENSAL (valor total, versionada)
-- -----------------------------------------------------------------------------
create table public.lancamentos_despesa (
  id                uuid primary key default gen_random_uuid(),
  distribuidora_id  uuid not null references public.distribuidoras (id),
  mes_ref           date not null check (mes_ref = date_trunc('month', mes_ref)::date),
  versao            integer not null check (versao > 0),
  vigente           boolean not null default false,
  valor_total       numeric(18, 2) not null check (valor_total >= 0),
  origem            text not null default 'manual' check (origem in ('manual', 'historico_planilha')),
  observacao        text,
  lancado_por       uuid default auth.uid(),
  lancado_em        timestamptz not null default now(),
  unique (distribuidora_id, mes_ref, versao)
);

create unique index lancamentos_despesa_uma_vigente
  on public.lancamentos_despesa (distribuidora_id, mes_ref)
  where vigente;


-- -----------------------------------------------------------------------------
-- 5. IMUTABILIDADE DO HISTÓRICO
-- -----------------------------------------------------------------------------
-- DELETE: sempre bloqueado.
-- UPDATE: só é aceito se a única coluna alterada for "vigente".
--         (faturamento_linhas não tem "vigente", então qualquer UPDATE falha.)
create or replace function public._bloquear_alteracao_historico()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'ARGOS: registros de histórico não podem ser apagados (%).', tg_table_name;
  end if;

  if (to_jsonb(new) - 'vigente') is distinct from (to_jsonb(old) - 'vigente') then
    raise exception 'ARGOS: histórico é imutável; apenas a versão vigente pode ser trocada (%).', tg_table_name;
  end if;

  return new;
end;
$$;

create trigger cargas_faturamento_imutavel
  before update or delete on public.cargas_faturamento
  for each row execute function public._bloquear_alteracao_historico();

create trigger faturamento_linhas_imutavel
  before update or delete on public.faturamento_linhas
  for each row execute function public._bloquear_alteracao_historico();

create trigger lancamentos_despesa_imutavel
  before update or delete on public.lancamentos_despesa
  for each row execute function public._bloquear_alteracao_historico();


-- -----------------------------------------------------------------------------
-- 6. FUNÇÕES DE GRAVAÇÃO (RPC)
-- -----------------------------------------------------------------------------

-- 6.1 Localiza o departamento pelo código; se não achar, tenta casar pelo nome
--     com um departamento do histórico ainda sem código; se não achar, cria.
create or replace function public._resolver_departamento(
  p_distribuidora_id uuid,
  p_codigo           integer,
  p_nome             text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from departamentos
   where distribuidora_id = p_distribuidora_id
     and codigo_winthor = p_codigo;

  if found then
    -- mantém o nome de exibição igual ao do Winthor
    update departamentos set nome = p_nome
     where id = v_id and nome is distinct from p_nome;
    return v_id;
  end if;

  select id into v_id
    from departamentos
   where distribuidora_id = p_distribuidora_id
     and codigo_winthor is null
     and upper(trim(nome)) = upper(trim(p_nome))
   limit 1;

  if found then
    update departamentos set codigo_winthor = p_codigo where id = v_id;
    return v_id;
  end if;

  insert into departamentos (distribuidora_id, codigo_winthor, nome)
  values (p_distribuidora_id, p_codigo, p_nome)
  returning id into v_id;

  return v_id;
end;
$$;


-- 6.2 Registra uma nova carga de faturamento (nova versão do mês, já vigente).
--     p_linhas: array JSON de objetos
--       { "codigo": 91, "nome": "SOFTYS - PROFESSIONAL",
--         "faturamento_liquido": 513175.86, "margem_pct": 25.219531,
--         "linha_original": [ ...18 colunas... ] }
create or replace function public.registrar_carga_faturamento(
  p_distribuidora_slug text,
  p_mes_ref            date,
  p_linhas             jsonb,
  p_arquivo_nome       text default null,
  p_arquivo_path       text default null,
  p_observacao         text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dist    uuid;
  v_versao  integer;
  v_carga   uuid;
  v_qtd     integer;
  v_fat     numeric;
  v_margem  numeric;
  r         record;
begin
  if coalesce(papel_atual(), '') not in ('admin', 'editor') then
    raise exception 'ARGOS: sem permissão para enviar cargas.';
  end if;

  select id into v_dist from distribuidoras where slug = p_distribuidora_slug;
  if v_dist is null then
    raise exception 'ARGOS: distribuidora "%" não encontrada.', p_distribuidora_slug;
  end if;

  if p_mes_ref is null or p_mes_ref <> date_trunc('month', p_mes_ref)::date then
    raise exception 'ARGOS: mes_ref deve ser o primeiro dia do mês (ex.: 2026-09-01).';
  end if;

  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) = 0 then
    raise exception 'ARGOS: a carga não tem linhas.';
  end if;

  -- validações das linhas
  if exists (
    select 1
      from jsonb_to_recordset(p_linhas)
           as x(codigo integer, nome text, faturamento_liquido numeric, margem_pct numeric)
     where x.codigo is null or nullif(trim(x.nome), '') is null
        or x.faturamento_liquido is null or x.margem_pct is null
  ) then
    raise exception 'ARGOS: há linhas sem código, nome, faturamento ou margem.';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_linhas) as x(codigo integer)
     group by x.codigo
    having count(*) > 1
  ) then
    raise exception 'ARGOS: há códigos de departamento repetidos no arquivo.';
  end if;

  select count(*),
         sum(x.faturamento_liquido),
         sum(x.faturamento_liquido * x.margem_pct / 100)
    into v_qtd, v_fat, v_margem
    from jsonb_to_recordset(p_linhas)
         as x(faturamento_liquido numeric, margem_pct numeric);

  -- evita duas cargas simultâneas do mesmo mês
  perform pg_advisory_xact_lock(hashtext('argos:fat:' || v_dist::text || ':' || p_mes_ref::text));

  select coalesce(max(versao), 0) + 1 into v_versao
    from cargas_faturamento
   where distribuidora_id = v_dist and mes_ref = p_mes_ref;

  update cargas_faturamento set vigente = false
   where distribuidora_id = v_dist and mes_ref = p_mes_ref and vigente;

  insert into cargas_faturamento (
    distribuidora_id, mes_ref, versao, vigente, origem,
    arquivo_nome, arquivo_path, qtd_linhas, total_faturamento, total_margem_valor, observacao
  ) values (
    v_dist, p_mes_ref, v_versao, true, 'upload',
    p_arquivo_nome, p_arquivo_path, v_qtd, v_fat, v_margem, p_observacao
  )
  returning id into v_carga;

  for r in
    select x.codigo, trim(x.nome) as nome, x.faturamento_liquido, x.margem_pct, x.linha_original
      from jsonb_to_recordset(p_linhas)
           as x(codigo integer, nome text, faturamento_liquido numeric,
                margem_pct numeric, linha_original jsonb)
  loop
    insert into faturamento_linhas (
      carga_id, departamento_id, codigo_winthor, nome_departamento,
      faturamento_liquido, margem_pct, linha_original
    ) values (
      v_carga,
      _resolver_departamento(v_dist, r.codigo, r.nome),
      r.codigo, r.nome, r.faturamento_liquido, r.margem_pct, r.linha_original
    );
  end loop;

  return v_carga;
end;
$$;


-- 6.3 Troca a versão vigente de um mês (ex.: voltar para a v1).
create or replace function public.definir_carga_vigente(p_carga_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dist uuid;
  v_mes  date;
begin
  if coalesce(papel_atual(), '') not in ('admin', 'editor') then
    raise exception 'ARGOS: sem permissão para trocar a versão vigente.';
  end if;

  select distribuidora_id, mes_ref into v_dist, v_mes
    from cargas_faturamento where id = p_carga_id;
  if v_dist is null then
    raise exception 'ARGOS: carga não encontrada.';
  end if;

  perform pg_advisory_xact_lock(hashtext('argos:fat:' || v_dist::text || ':' || v_mes::text));

  update cargas_faturamento set vigente = false
   where distribuidora_id = v_dist and mes_ref = v_mes and vigente and id <> p_carga_id;
  update cargas_faturamento set vigente = true
   where id = p_carga_id and not vigente;
end;
$$;


-- 6.4 Lança a despesa total do mês (nova versão, já vigente).
create or replace function public.registrar_despesa(
  p_distribuidora_slug text,
  p_mes_ref            date,
  p_valor_total        numeric,
  p_observacao         text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dist   uuid;
  v_versao integer;
  v_id     uuid;
begin
  if coalesce(papel_atual(), '') not in ('admin', 'editor') then
    raise exception 'ARGOS: sem permissão para lançar despesa.';
  end if;

  select id into v_dist from distribuidoras where slug = p_distribuidora_slug;
  if v_dist is null then
    raise exception 'ARGOS: distribuidora "%" não encontrada.', p_distribuidora_slug;
  end if;

  if p_mes_ref is null or p_mes_ref <> date_trunc('month', p_mes_ref)::date then
    raise exception 'ARGOS: mes_ref deve ser o primeiro dia do mês (ex.: 2026-09-01).';
  end if;

  if p_valor_total is null or p_valor_total < 0 then
    raise exception 'ARGOS: valor de despesa inválido.';
  end if;

  perform pg_advisory_xact_lock(hashtext('argos:desp:' || v_dist::text || ':' || p_mes_ref::text));

  select coalesce(max(versao), 0) + 1 into v_versao
    from lancamentos_despesa
   where distribuidora_id = v_dist and mes_ref = p_mes_ref;

  update lancamentos_despesa set vigente = false
   where distribuidora_id = v_dist and mes_ref = p_mes_ref and vigente;

  insert into lancamentos_despesa (distribuidora_id, mes_ref, versao, vigente, valor_total, observacao)
  values (v_dist, p_mes_ref, v_versao, true, p_valor_total, p_observacao)
  returning id into v_id;

  return v_id;
end;
$$;


-- 6.5 Troca a versão vigente da despesa de um mês.
create or replace function public.definir_despesa_vigente(p_lancamento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dist uuid;
  v_mes  date;
begin
  if coalesce(papel_atual(), '') not in ('admin', 'editor') then
    raise exception 'ARGOS: sem permissão para trocar a versão vigente.';
  end if;

  select distribuidora_id, mes_ref into v_dist, v_mes
    from lancamentos_despesa where id = p_lancamento_id;
  if v_dist is null then
    raise exception 'ARGOS: lançamento não encontrado.';
  end if;

  perform pg_advisory_xact_lock(hashtext('argos:desp:' || v_dist::text || ':' || v_mes::text));

  update lancamentos_despesa set vigente = false
   where distribuidora_id = v_dist and mes_ref = v_mes and vigente and id <> p_lancamento_id;
  update lancamentos_despesa set vigente = true
   where id = p_lancamento_id and not vigente;
end;
$$;


-- -----------------------------------------------------------------------------
-- 7. VIEWS DE CÁLCULO (security_invoker: respeitam o RLS de quem consulta)
-- -----------------------------------------------------------------------------

-- 7.1 Linhas da versão vigente de cada mês
create view public.vw_faturamento_vigente
with (security_invoker = true) as
select c.distribuidora_id,
       c.mes_ref,
       c.id     as carga_id,
       c.versao,
       l.departamento_id,
       d.codigo_winthor,
       d.nome,
       d.exclusivo_professional,
       l.faturamento_liquido,
       l.margem_valor
  from public.cargas_faturamento c
  join public.faturamento_linhas l on l.carga_id = c.id
  join public.departamentos d      on d.id = l.departamento_id
 where c.vigente;

-- 7.2 Despesa vigente de cada mês
create view public.vw_despesa_vigente
with (security_invoker = true) as
select distribuidora_id, mes_ref, id as lancamento_id, versao, valor_total
  from public.lancamentos_despesa
 where vigente;

-- 7.3 DUN PROFESSIONAL — mensal por departamento (aba "--")
--   participacao    = FAT do depto / FAT total do mês
--   despesa_rateada = participacao × despesa total do mês
--   lb              = rentabilidade − despesa_rateada
create view public.vw_gerencial_mensal
with (security_invoker = true) as
with f as (
  select v.*,
         sum(v.faturamento_liquido) over (partition by v.distribuidora_id, v.mes_ref) as fat_total
    from public.vw_faturamento_vigente v
), calc as (
  select f.distribuidora_id,
         f.mes_ref,
         f.carga_id,
         f.versao                                          as versao_faturamento,
         d.versao                                          as versao_despesa,
         f.departamento_id,
         f.codigo_winthor,
         f.nome,
         f.exclusivo_professional,
         f.faturamento_liquido,
         f.margem_valor                                    as rentabilidade,
         coalesce(f.faturamento_liquido / nullif(f.fat_total, 0), 0) as participacao,
         d.valor_total                                     as despesa_total_mes
    from f
    left join public.vw_despesa_vigente d
           on d.distribuidora_id = f.distribuidora_id and d.mes_ref = f.mes_ref
)
select calc.*,
       coalesce(calc.rentabilidade / nullif(calc.faturamento_liquido, 0), 0) as rentabilidade_pct,
       calc.participacao * coalesce(calc.despesa_total_mes, 0)              as despesa_rateada,
       calc.rentabilidade - calc.participacao * coalesce(calc.despesa_total_mes, 0) as lb,
       case when calc.faturamento_liquido > 0
            then (calc.rentabilidade - calc.participacao * coalesce(calc.despesa_total_mes, 0))
                 / calc.faturamento_liquido
            else 0 end                                                    as lb_pct
  from calc;

-- 7.4 DUN PROFESSIONAL — totais do mês (linha TOTAL + base do gráfico)
create view public.vw_gerencial_mensal_total
with (security_invoker = true) as
with f as (
  select distribuidora_id, mes_ref,
         max(versao)              as versao_faturamento,
         count(*)                 as qtd_departamentos,
         sum(faturamento_liquido) as faturamento_liquido,
         sum(margem_valor)        as rentabilidade
    from public.vw_faturamento_vigente
   group by distribuidora_id, mes_ref
)
select f.distribuidora_id,
       f.mes_ref,
       f.versao_faturamento,
       d.versao                                                   as versao_despesa,
       f.qtd_departamentos,
       f.faturamento_liquido,
       f.rentabilidade,
       coalesce(f.rentabilidade / nullif(f.faturamento_liquido, 0), 0) as rentabilidade_pct,
       d.valor_total                                              as despesa,
       f.rentabilidade - coalesce(d.valor_total, 0)               as lb,
       case when f.faturamento_liquido > 0
            then (f.rentabilidade - coalesce(d.valor_total, 0)) / f.faturamento_liquido
            else 0 end                                            as lb_pct,
       coalesce(d.valor_total / nullif(f.faturamento_liquido, 0), 0) as custo_op_pct
  from f
  left join public.vw_despesa_vigente d
         on d.distribuidora_id = f.distribuidora_id and d.mes_ref = f.mes_ref;

-- 7.5 DUN PROFESSIONAL — anual por departamento (bloco ANO)
--   Igual à planilha: a despesa anual é rateada pela participação ANUAL
--   (participação anual × despesa anual), e não pela soma dos rateios mensais.
create view public.vw_gerencial_anual
with (security_invoker = true) as
with a as (
  select distribuidora_id,
         extract(year from mes_ref)::int as ano,
         departamento_id, codigo_winthor, nome, exclusivo_professional,
         sum(faturamento_liquido) as faturamento_liquido,
         sum(margem_valor)        as rentabilidade
    from public.vw_faturamento_vigente
   group by distribuidora_id, extract(year from mes_ref)::int,
            departamento_id, codigo_winthor, nome, exclusivo_professional
), t as (
  select distribuidora_id, ano, sum(faturamento_liquido) as fat_total
    from a group by distribuidora_id, ano
), dsp as (
  select distribuidora_id, extract(year from mes_ref)::int as ano, sum(valor_total) as despesa_total
    from public.vw_despesa_vigente
   group by distribuidora_id, extract(year from mes_ref)::int
), calc as (
  select a.*,
         coalesce(a.faturamento_liquido / nullif(t.fat_total, 0), 0) as participacao,
         coalesce(dsp.despesa_total, 0)                               as despesa_total_ano
    from a
    join t on t.distribuidora_id = a.distribuidora_id and t.ano = a.ano
    left join dsp on dsp.distribuidora_id = a.distribuidora_id and dsp.ano = a.ano
)
select calc.*,
       coalesce(calc.rentabilidade / nullif(calc.faturamento_liquido, 0), 0) as rentabilidade_pct,
       calc.participacao * calc.despesa_total_ano                           as despesa_rateada,
       calc.rentabilidade - calc.participacao * calc.despesa_total_ano      as lb,
       case when calc.faturamento_liquido > 0
            then (calc.rentabilidade - calc.participacao * calc.despesa_total_ano) / calc.faturamento_liquido
            else 0 end                                                    as lb_pct
  from calc;

-- 7.6 DUN PROFESSIONAL — total anual
create view public.vw_gerencial_anual_total
with (security_invoker = true) as
with f as (
  select distribuidora_id, extract(year from mes_ref)::int as ano,
         sum(faturamento_liquido) as faturamento_liquido,
         sum(margem_valor)        as rentabilidade
    from public.vw_faturamento_vigente
   group by distribuidora_id, extract(year from mes_ref)::int
), dsp as (
  select distribuidora_id, extract(year from mes_ref)::int as ano, sum(valor_total) as despesa
    from public.vw_despesa_vigente
   group by distribuidora_id, extract(year from mes_ref)::int
)
select f.distribuidora_id, f.ano, f.faturamento_liquido, f.rentabilidade,
       coalesce(f.rentabilidade / nullif(f.faturamento_liquido, 0), 0) as rentabilidade_pct,
       dsp.despesa,
       f.rentabilidade - coalesce(dsp.despesa, 0)                       as lb,
       case when f.faturamento_liquido > 0
            then (f.rentabilidade - coalesce(dsp.despesa, 0)) / f.faturamento_liquido
            else 0 end                                                  as lb_pct,
       coalesce(dsp.despesa / nullif(f.faturamento_liquido, 0), 0)      as custo_op_pct
  from f
  left join dsp on dsp.distribuidora_id = f.distribuidora_id and dsp.ano = f.ano;

-- 7.7 PROFESSIONAL (só departamentos exclusivos) — mensal
--   participação calculada sobre o total dos exclusivos; sem despesa/LB.
create view public.vw_professional_mensal
with (security_invoker = true) as
with f as (
  select v.*,
         sum(v.faturamento_liquido) over (partition by v.distribuidora_id, v.mes_ref) as fat_total
    from public.vw_faturamento_vigente v
   where v.exclusivo_professional
)
select distribuidora_id, mes_ref, departamento_id, codigo_winthor, nome,
       faturamento_liquido,
       margem_valor                                                   as rentabilidade,
       coalesce(margem_valor / nullif(faturamento_liquido, 0), 0)     as rentabilidade_pct,
       coalesce(faturamento_liquido / nullif(fat_total, 0), 0)        as participacao
  from f;

-- 7.8 PROFESSIONAL — anual
create view public.vw_professional_anual
with (security_invoker = true) as
with a as (
  select distribuidora_id, extract(year from mes_ref)::int as ano,
         departamento_id, codigo_winthor, nome,
         sum(faturamento_liquido) as faturamento_liquido,
         sum(margem_valor)        as rentabilidade
    from public.vw_faturamento_vigente
   where exclusivo_professional
   group by distribuidora_id, extract(year from mes_ref)::int, departamento_id, codigo_winthor, nome
)
select a.*,
       coalesce(a.rentabilidade / nullif(a.faturamento_liquido, 0), 0) as rentabilidade_pct,
       coalesce(a.faturamento_liquido
                / nullif(sum(a.faturamento_liquido) over (partition by a.distribuidora_id, a.ano), 0), 0)
                                                                        as participacao
  from a;


-- -----------------------------------------------------------------------------
-- 8. COMPARAÇÃO ENTRE VERSÕES
-- -----------------------------------------------------------------------------
-- Compara duas cargas (normalmente v1 × v2 do mesmo mês), por departamento.
-- situacao: 'igual' | 'alterado' | 'novo' (só em B) | 'removido' (só em A)
create or replace function public.comparar_cargas_faturamento(p_carga_a uuid, p_carga_b uuid)
returns table (
  departamento_id    uuid,
  codigo_winthor     integer,
  nome               text,
  faturamento_a      numeric,
  faturamento_b      numeric,
  dif_faturamento    numeric,
  rentabilidade_a    numeric,
  rentabilidade_b    numeric,
  dif_rentabilidade  numeric,
  situacao           text
)
language sql
stable
security invoker
set search_path = public
as $$
  with a as (select * from faturamento_linhas where carga_id = p_carga_a),
       b as (select * from faturamento_linhas where carga_id = p_carga_b)
  select coalesce(a.departamento_id, b.departamento_id),
         d.codigo_winthor,
         d.nome,
         coalesce(a.faturamento_liquido, 0),
         coalesce(b.faturamento_liquido, 0),
         coalesce(b.faturamento_liquido, 0) - coalesce(a.faturamento_liquido, 0),
         coalesce(a.margem_valor, 0),
         coalesce(b.margem_valor, 0),
         coalesce(b.margem_valor, 0) - coalesce(a.margem_valor, 0),
         case
           when a.id is null then 'novo'
           when b.id is null then 'removido'
           when abs(coalesce(b.faturamento_liquido, 0) - coalesce(a.faturamento_liquido, 0)) < 0.005
            and abs(coalesce(b.margem_valor, 0) - coalesce(a.margem_valor, 0)) < 0.005 then 'igual'
           else 'alterado'
         end
    from a
    full join b on b.departamento_id = a.departamento_id
    join departamentos d on d.id = coalesce(a.departamento_id, b.departamento_id)
   order by abs(coalesce(b.faturamento_liquido, 0) - coalesce(a.faturamento_liquido, 0)) desc, d.nome
$$;


-- -----------------------------------------------------------------------------
-- 9. RLS
-- -----------------------------------------------------------------------------
alter table public.perfis              enable row level security;
alter table public.distribuidoras      enable row level security;
alter table public.departamentos       enable row level security;
alter table public.cargas_faturamento  enable row level security;
alter table public.faturamento_linhas  enable row level security;
alter table public.lancamentos_despesa enable row level security;

-- perfis: qualquer usuário com perfil vê a lista (para exibir "enviado por");
-- só admin gerencia
create policy perfis_select on public.perfis
  for select to authenticated
  using (public.papel_atual() is not null);
create policy perfis_admin_insert on public.perfis
  for insert to authenticated with check (public.papel_atual() = 'admin');
create policy perfis_admin_update on public.perfis
  for update to authenticated
  using (public.papel_atual() = 'admin') with check (public.papel_atual() = 'admin');
create policy perfis_admin_delete on public.perfis
  for delete to authenticated using (public.papel_atual() = 'admin');

-- leitura: qualquer usuário com perfil
create policy distribuidoras_select on public.distribuidoras
  for select to authenticated using (public.papel_atual() is not null);
create policy departamentos_select on public.departamentos
  for select to authenticated using (public.papel_atual() is not null);
create policy cargas_select on public.cargas_faturamento
  for select to authenticated using (public.papel_atual() is not null);
create policy linhas_select on public.faturamento_linhas
  for select to authenticated using (public.papel_atual() is not null);
create policy despesa_select on public.lancamentos_despesa
  for select to authenticated using (public.papel_atual() is not null);

-- departamentos: admin/editor podem editar (ex.: marcar "exclusivo PROFESSIONAL")
create policy departamentos_update on public.departamentos
  for update to authenticated
  using (public.papel_atual() in ('admin', 'editor'))
  with check (public.papel_atual() in ('admin', 'editor'));

-- cargas, linhas e despesas: SEM políticas de insert/update/delete.
-- Gravação só pelas funções RPC (security definer), que fazem o versionamento.

-- funções internas não podem ser chamadas pelo front
revoke execute on function public._resolver_departamento(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.registrar_carga_faturamento(text, date, jsonb, text, text, text) from public, anon;
revoke execute on function public.definir_carga_vigente(uuid) from public, anon;
revoke execute on function public.registrar_despesa(text, date, numeric, text) from public, anon;
revoke execute on function public.definir_despesa_vigente(uuid) from public, anon;
revoke execute on function public.comparar_cargas_faturamento(uuid, uuid) from public, anon;

grant execute on function public.papel_atual() to authenticated;
grant execute on function public.registrar_carga_faturamento(text, date, jsonb, text, text, text) to authenticated;
grant execute on function public.definir_carga_vigente(uuid) to authenticated;
grant execute on function public.registrar_despesa(text, date, numeric, text) to authenticated;
grant execute on function public.definir_despesa_vigente(uuid) to authenticated;
grant execute on function public.comparar_cargas_faturamento(uuid, uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 10. STORAGE — arquivos originais enviados (auditoria)
-- -----------------------------------------------------------------------------
-- Bucket privado. Upload só por admin/editor. Sem update/delete: o arquivo
-- original de cada carga fica guardado para sempre.
-- Caminho sugerido: dun-professional/2026-09/v2_20261005T143000_1464_prof_setembro.xls
insert into storage.buckets (id, name, public)
values ('argos-bases', 'argos-bases', false)
on conflict (id) do nothing;

create policy argos_bases_select on storage.objects
  for select to authenticated
  using (bucket_id = 'argos-bases' and public.papel_atual() is not null);

create policy argos_bases_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'argos-bases' and public.papel_atual() in ('admin', 'editor'));
