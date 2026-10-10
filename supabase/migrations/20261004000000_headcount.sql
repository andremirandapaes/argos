-- =============================================================================
-- ARGOS — Módulo HeadCount (colaboradores ativos no último dia de cada mês)
-- Tabelas, gravação (RPC), consolidação (view) e RLS.
-- Só ADICIONA objetos; não mexe em nada do Duno Pro.
-- =============================================================================
-- Princípios (vindos do artefato "Headcount de Colaboradores"):
--   1. O banco guarda as BASES como vieram das planilhas, já agregadas
--      (competência × UF × área × distribuidora × centro × departamento ×
--      cargo × vínculo → quantidade). Sem versões: reenviar uma base substitui
--      a anterior por inteiro.
--   2. Bases:
--        sistema_AAAA-MM : exportação do sistema (Relação de Colaboradores),
--                          um arquivo por mês, AM e RR. Só CLT.
--        comercial_am/rr : planilhas manuais das pastas comerciais.
--        logistica       : planilha manual do depósito (AM e RR).
--        backoffice_am   : planilha manual do back office.
--   3. Consolidação (vw_headcount_linhas):
--        - Onde há exportação do sistema (mês + UF), ela substitui as planilhas
--          manuais, exceto os terceirizados, que o sistema não traz.
--        - Terceirizados (INOVAR) lançados no ARGOS para um mês substituem os
--          terceirizados das planilhas manuais naquele mês (lançar "nenhum"
--          também substitui).
--   4. Gravação só pelas funções RPC; o front não insere direto nas tabelas.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. TABELAS
-- -----------------------------------------------------------------------------
create table public.hc_fontes (
  fonte          text primary key,
  tipo           text not null check (tipo in ('sistema', 'comercial', 'logistica', 'backoffice')),
  uf             text not null,                    -- 'AM', 'RR' ou 'AM/RR'
  ufs            text[],                           -- sistema: UFs presentes na exportação
  resumo         jsonb,                            -- sistema: colaboradores por UF, ex. {"AM": 466}
  arquivo        text not null,
  competencias   date[] not null,                  -- meses que a base cobre (ordenados)
  avisos         jsonb not null default '[]'::jsonb,  -- avisos de conferência da leitura
  padronizacoes  jsonb not null default '[]'::jsonb,  -- [["NOME ORIGINAL", "Nome padronizado"], ...]
  importado_em   timestamptz,                      -- null = carga inicial (vinda do artefato)
  importado_por  uuid references auth.users (id) on delete set null,
  constraint hc_fontes_sistema_chk check (
    tipo <> 'sistema' or (fonte ~ '^sistema_\d{4}-\d{2}$' and cardinality(competencias) = 1)
  )
);

create table public.hc_linhas (
  id            bigint generated always as identity primary key,
  fonte         text not null references public.hc_fontes (fonte) on delete cascade,
  competencia   date not null check (competencia = date_trunc('month', competencia)::date),
  uf            text not null check (uf in ('AM', 'RR')),
  area          text not null check (area in ('Comercial', 'Logística', 'Backoffice')),
  distribuidora text,          -- só Comercial (Dunorte, Meta Norte, Elo Norte...)
  centro        text,          -- Comercial: Vendas / Merchan / Centro não informado
  departamento  text,          -- Backoffice: departamento; Logística (sistema): setor
  cargo         text,          -- null = sem detalhamento por cargo
  vinculo       text not null check (vinculo in ('CLT', 'Terceirizado', 'Não informado')),
  quantidade    integer not null check (quantidade > 0)
);
create index hc_linhas_fonte_idx on public.hc_linhas (fonte);
create index hc_linhas_competencia_idx on public.hc_linhas (competencia);

-- Lançamento de terceirizados (INOVAR) por mês. A existência da linha do mês,
-- mesmo sem itens, já substitui os terceirizados das planilhas manuais.
create table public.hc_terceirizados_mes (
  competencia     date primary key check (competencia = date_trunc('month', competencia)::date),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references auth.users (id) on delete set null
);

create table public.hc_terceirizados_itens (
  id             bigint generated always as identity primary key,
  competencia    date not null references public.hc_terceirizados_mes (competencia) on delete cascade,
  uf             text not null check (uf in ('AM', 'RR')),
  area           text not null check (area in ('Comercial', 'Logística', 'Backoffice')),
  distribuidora  text,         -- Comercial
  centro         text,         -- Comercial: Vendas / Merchan (null = não definido)
  departamento   text,         -- Backoffice
  quantidade     integer not null check (quantidade > 0),
  constraint hc_terc_itens_chk check (
    (area = 'Comercial'  and distribuidora is not null and departamento is null) or
    (area = 'Logística'  and distribuidora is null and centro is null and departamento is null) or
    (area = 'Backoffice' and departamento is not null and distribuidora is null and centro is null)
  )
);
create index hc_terc_itens_comp_idx on public.hc_terceirizados_itens (competencia);


-- -----------------------------------------------------------------------------
-- 2. GRAVAÇÃO (RPC)
-- -----------------------------------------------------------------------------

-- Salva uma ou mais bases lidas das planilhas (tudo ou nada).
-- p_bases: [{fonte, tipo, uf, ufs, resumo, arquivo, avisos, padronizacoes,
--            linhas: [{competencia: "2026-08-01", uf, area, distribuidora,
--                      centro, departamento, cargo, vinculo, quantidade}]}]
-- Cada base substitui por inteiro a base de mesmo nome (sem versões).
create or replace function public.hc_registrar_bases(p_bases jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  b        jsonb;
  v_fonte  text;
  v_tipo   text;
  v_comps  date[];
  v_total  integer := 0;
  v_qtd    integer;
begin
  if coalesce(papel_atual(), '') not in ('admin', 'editor') then
    raise exception 'ARGOS: sem permissão para atualizar as bases do HeadCount.';
  end if;

  if jsonb_typeof(p_bases) is distinct from 'array' or jsonb_array_length(p_bases) = 0 then
    raise exception 'ARGOS: nenhuma base enviada.';
  end if;

  for b in select * from jsonb_array_elements(p_bases) loop
    v_fonte := nullif(trim(b ->> 'fonte'), '');
    v_tipo  := b ->> 'tipo';
    if v_fonte is null then
      raise exception 'ARGOS: base sem identificação.';
    end if;
    if jsonb_typeof(b -> 'linhas') is distinct from 'array' or jsonb_array_length(b -> 'linhas') = 0 then
      raise exception 'ARGOS: a base "%" não tem linhas.', v_fonte;
    end if;

    if exists (
      select 1
        from jsonb_to_recordset(b -> 'linhas')
             as x(competencia date, uf text, area text, vinculo text, quantidade integer)
       where x.competencia is null or x.uf is null or x.area is null
          or x.vinculo is null or x.quantidade is null or x.quantidade <= 0
    ) then
      raise exception 'ARGOS: a base "%" tem linhas sem competência, UF, área, vínculo ou quantidade.', v_fonte;
    end if;

    select array_agg(distinct date_trunc('month', x.competencia)::date order by date_trunc('month', x.competencia)::date)
      into v_comps
      from jsonb_to_recordset(b -> 'linhas') as x(competencia date);

    insert into hc_fontes (fonte, tipo, uf, ufs, resumo, arquivo, competencias, avisos, padronizacoes, importado_em, importado_por)
    values (
      v_fonte,
      v_tipo,
      coalesce(nullif(b ->> 'uf', ''), '—'),
      case when jsonb_typeof(b -> 'ufs') = 'array'
           then array(select jsonb_array_elements_text(b -> 'ufs')) end,
      case when jsonb_typeof(b -> 'resumo') = 'object' then b -> 'resumo' end,
      coalesce(nullif(b ->> 'arquivo', ''), v_fonte),
      v_comps,
      coalesce(case when jsonb_typeof(b -> 'avisos') = 'array' then b -> 'avisos' end, '[]'::jsonb),
      coalesce(case when jsonb_typeof(b -> 'padronizacoes') = 'array' then b -> 'padronizacoes' end, '[]'::jsonb),
      now(),
      auth.uid()
    )
    on conflict (fonte) do update set
      tipo = excluded.tipo, uf = excluded.uf, ufs = excluded.ufs, resumo = excluded.resumo,
      arquivo = excluded.arquivo, competencias = excluded.competencias, avisos = excluded.avisos,
      padronizacoes = excluded.padronizacoes, importado_em = excluded.importado_em,
      importado_por = excluded.importado_por;

    delete from hc_linhas where fonte = v_fonte;

    insert into hc_linhas (fonte, competencia, uf, area, distribuidora, centro, departamento, cargo, vinculo, quantidade)
    select v_fonte, date_trunc('month', x.competencia)::date, x.uf, x.area,
           nullif(trim(x.distribuidora), ''), nullif(trim(x.centro), ''),
           nullif(trim(x.departamento), ''), nullif(trim(x.cargo), ''),
           x.vinculo, x.quantidade
      from jsonb_to_recordset(b -> 'linhas')
           as x(competencia date, uf text, area text, distribuidora text, centro text,
                departamento text, cargo text, vinculo text, quantidade integer);
    get diagnostics v_qtd = row_count;
    v_total := v_total + v_qtd;
  end loop;

  return v_total;
end;
$$;

-- Lança os terceirizados (INOVAR) de um mês, substituindo o lançamento anterior.
-- p_itens: [{uf, area, distribuidora, centro, departamento, quantidade}]
-- Lista vazia = "não havia terceirizados neste mês" (também substitui as planilhas).
create or replace function public.hc_salvar_terceirizados(p_competencia date, p_itens jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  if coalesce(papel_atual(), '') not in ('admin', 'editor') then
    raise exception 'ARGOS: sem permissão para lançar terceirizados.';
  end if;
  if p_competencia is null or p_competencia <> date_trunc('month', p_competencia)::date then
    raise exception 'ARGOS: competência deve ser o primeiro dia do mês (ex.: 2026-08-01).';
  end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'ARGOS: itens inválidos.';
  end if;

  insert into hc_terceirizados_mes (competencia, atualizado_em, atualizado_por)
  values (p_competencia, now(), auth.uid())
  on conflict (competencia) do update set atualizado_em = now(), atualizado_por = auth.uid();

  delete from hc_terceirizados_itens where competencia = p_competencia;

  -- itens iguais (mesma UF/área/distribuidora/centro/departamento) são somados
  insert into hc_terceirizados_itens (competencia, uf, area, distribuidora, centro, departamento, quantidade)
  select p_competencia, x.uf, x.area,
         case when x.area = 'Comercial' then nullif(trim(x.distribuidora), '') end,
         case when x.area = 'Comercial' then nullif(trim(x.centro), '') end,
         case when x.area = 'Backoffice' then nullif(trim(x.departamento), '') end,
         sum(x.quantidade)::integer
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb))
         as x(uf text, area text, distribuidora text, centro text, departamento text, quantidade integer)
   where coalesce(x.quantidade, 0) > 0
   group by 1, 2, 3, 4, 5, 6;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. CONSOLIDAÇÃO (o que o painel enxerga)
-- -----------------------------------------------------------------------------
-- id: positivo = linha de base (hc_linhas.id); negativo = item de terceirizados lançado (-hc_terceirizados_itens.id)
create or replace view public.vw_headcount_linhas
with (security_invoker = true) as
with cobertura_sistema as (
  -- mês + UF que têm exportação do sistema
  select f.competencias[1] as competencia, u.uf
    from public.hc_fontes f
         cross join lateral unnest(f.ufs) as u(uf)
   where f.tipo = 'sistema'
)
select l.id, l.competencia, l.uf, l.area, l.distribuidora, l.centro, l.departamento,
       l.cargo, l.vinculo, l.quantidade, l.fonte
  from public.hc_linhas l
  join public.hc_fontes f on f.fonte = l.fonte
 where f.tipo = 'sistema'
    or (l.vinculo = 'Terceirizado'
        and not exists (select 1 from public.hc_terceirizados_mes t where t.competencia = l.competencia))
    or (l.vinculo <> 'Terceirizado'
        and not exists (select 1 from cobertura_sistema c where c.competencia = l.competencia and c.uf = l.uf))
union all
select -i.id, i.competencia, i.uf, i.area,
       i.distribuidora,
       case when i.area = 'Comercial' then coalesce(i.centro, 'Centro não informado') end,
       i.departamento,
       case when i.area = 'Backoffice' then null else 'Terceirizado (cargo não informado)' end,
       'Terceirizado', i.quantidade, 'lancamento_terceirizados'
  from public.hc_terceirizados_itens i;


-- -----------------------------------------------------------------------------
-- 4. RLS
-- -----------------------------------------------------------------------------
alter table public.hc_fontes              enable row level security;
alter table public.hc_linhas              enable row level security;
alter table public.hc_terceirizados_mes   enable row level security;
alter table public.hc_terceirizados_itens enable row level security;

create policy hc_fontes_select on public.hc_fontes
  for select to authenticated using (public.papel_atual() is not null);
create policy hc_linhas_select on public.hc_linhas
  for select to authenticated using (public.papel_atual() is not null);
create policy hc_terc_mes_select on public.hc_terceirizados_mes
  for select to authenticated using (public.papel_atual() is not null);
create policy hc_terc_itens_select on public.hc_terceirizados_itens
  for select to authenticated using (public.papel_atual() is not null);
-- sem políticas de insert/update/delete: gravação só pelas funções acima

revoke execute on function public.hc_registrar_bases(jsonb) from public, anon;
revoke execute on function public.hc_salvar_terceirizados(date, jsonb) from public, anon;
grant execute on function public.hc_registrar_bases(jsonb) to authenticated;
grant execute on function public.hc_salvar_terceirizados(date, jsonb) to authenticated;
