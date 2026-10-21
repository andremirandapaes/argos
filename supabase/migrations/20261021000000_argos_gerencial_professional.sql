-- =============================================================================
-- ARGOS — Módulo 1: Relatório Gerencial só com os departamentos PROFESSIONAL
-- =============================================================================
-- Só ACRESCENTA seis views. Não altera tabelas, dados, funções nem views existentes.
--
-- Usadas pelo toggle "Só Professional" do Relatório Gerencial (abas Padrão e
-- Acompanhamento). PROFESSIONAL = departamentos marcados como exclusivo_professional.
--
-- Regra (decisão do usuário, 2026-10-21): a despesa do período é a MESMA (valor
-- cheio lançado) e é re-rateada só entre os departamentos Professional:
--   participacao    = FAT do depto / FAT total dos Professional no período
--   despesa_rateada = participacao × despesa total do período
--   lb              = rentabilidade − despesa_rateada
-- Totais: despesa = despesa cheia do período; lb = rentabilidade Professional − despesa.
-- Mês, trimestre e ano seguem a mesma lógica das views do Gerencial (trimestre e ano
-- rateiam pela participação do período, não pela soma dos rateios mensais).
-- Mesmas colunas das views do Gerencial, para o front usar os mesmos tipos.
-- Percentuais são frações (0.2281 = 22,81%), como nas demais views.
-- =============================================================================

-- Mensal por departamento (como vw_gerencial_mensal)
create view public.vw_gerencial_professional_mensal
with (security_invoker = true) as
with f as (
  select v.*,
         sum(v.faturamento_liquido) over (partition by v.distribuidora_id, v.mes_ref) as fat_total
    from public.vw_faturamento_vigente v
   where v.exclusivo_professional
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

-- Total do mês (como vw_gerencial_mensal_total)
create view public.vw_gerencial_professional_mensal_total
with (security_invoker = true) as
with f as (
  select distribuidora_id, mes_ref,
         max(versao)              as versao_faturamento,
         count(*)                 as qtd_departamentos,
         sum(faturamento_liquido) as faturamento_liquido,
         sum(margem_valor)        as rentabilidade
    from public.vw_faturamento_vigente
   where exclusivo_professional
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

-- Trimestral por departamento (como vw_gerencial_trimestral)
create view public.vw_gerencial_professional_trimestral
with (security_invoker = true) as
with a as (
  select distribuidora_id,
         extract(year from mes_ref)::int    as ano,
         extract(quarter from mes_ref)::int as trimestre,
         departamento_id, codigo_winthor, nome, exclusivo_professional,
         sum(faturamento_liquido) as faturamento_liquido,
         sum(margem_valor)        as rentabilidade
    from public.vw_faturamento_vigente
   where exclusivo_professional
   group by distribuidora_id, extract(year from mes_ref)::int, extract(quarter from mes_ref)::int,
            departamento_id, codigo_winthor, nome, exclusivo_professional
), t as (
  select distribuidora_id, ano, trimestre, sum(faturamento_liquido) as fat_total
    from a group by distribuidora_id, ano, trimestre
), dsp as (
  select distribuidora_id,
         extract(year from mes_ref)::int    as ano,
         extract(quarter from mes_ref)::int as trimestre,
         sum(valor_total)                   as despesa_total
    from public.vw_despesa_vigente
   group by distribuidora_id, extract(year from mes_ref)::int, extract(quarter from mes_ref)::int
), calc as (
  select a.*,
         coalesce(a.faturamento_liquido / nullif(t.fat_total, 0), 0) as participacao,
         coalesce(dsp.despesa_total, 0)                               as despesa_total_trimestre
    from a
    join t on t.distribuidora_id = a.distribuidora_id and t.ano = a.ano and t.trimestre = a.trimestre
    left join dsp on dsp.distribuidora_id = a.distribuidora_id and dsp.ano = a.ano and dsp.trimestre = a.trimestre
)
select calc.*,
       coalesce(calc.rentabilidade / nullif(calc.faturamento_liquido, 0), 0) as rentabilidade_pct,
       calc.participacao * calc.despesa_total_trimestre                     as despesa_rateada,
       calc.rentabilidade - calc.participacao * calc.despesa_total_trimestre as lb,
       case when calc.faturamento_liquido > 0
            then (calc.rentabilidade - calc.participacao * calc.despesa_total_trimestre) / calc.faturamento_liquido
            else 0 end                                                     as lb_pct
  from calc;

-- Total do trimestre (como vw_gerencial_trimestral_total)
create view public.vw_gerencial_professional_trimestral_total
with (security_invoker = true) as
with f as (
  select distribuidora_id,
         extract(year from mes_ref)::int    as ano,
         extract(quarter from mes_ref)::int as trimestre,
         count(distinct mes_ref)            as meses_com_carga,
         sum(faturamento_liquido)           as faturamento_liquido,
         sum(margem_valor)                  as rentabilidade
    from public.vw_faturamento_vigente
   where exclusivo_professional
   group by distribuidora_id, extract(year from mes_ref)::int, extract(quarter from mes_ref)::int
), dsp as (
  select distribuidora_id,
         extract(year from mes_ref)::int    as ano,
         extract(quarter from mes_ref)::int as trimestre,
         count(*)                           as meses_com_despesa,
         sum(valor_total)                   as despesa
    from public.vw_despesa_vigente
   group by distribuidora_id, extract(year from mes_ref)::int, extract(quarter from mes_ref)::int
)
select f.distribuidora_id, f.ano, f.trimestre, f.meses_com_carga,
       coalesce(dsp.meses_com_despesa, 0)                               as meses_com_despesa,
       f.faturamento_liquido, f.rentabilidade,
       coalesce(f.rentabilidade / nullif(f.faturamento_liquido, 0), 0) as rentabilidade_pct,
       dsp.despesa,
       f.rentabilidade - coalesce(dsp.despesa, 0)                       as lb,
       case when f.faturamento_liquido > 0
            then (f.rentabilidade - coalesce(dsp.despesa, 0)) / f.faturamento_liquido
            else 0 end                                                  as lb_pct,
       coalesce(dsp.despesa / nullif(f.faturamento_liquido, 0), 0)      as custo_op_pct
  from f
  left join dsp on dsp.distribuidora_id = f.distribuidora_id and dsp.ano = f.ano and dsp.trimestre = f.trimestre;

-- Anual por departamento (como vw_gerencial_anual)
create view public.vw_gerencial_professional_anual
with (security_invoker = true) as
with a as (
  select distribuidora_id,
         extract(year from mes_ref)::int as ano,
         departamento_id, codigo_winthor, nome, exclusivo_professional,
         sum(faturamento_liquido) as faturamento_liquido,
         sum(margem_valor)        as rentabilidade
    from public.vw_faturamento_vigente
   where exclusivo_professional
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

-- Total do ano (como vw_gerencial_anual_total)
create view public.vw_gerencial_professional_anual_total
with (security_invoker = true) as
with f as (
  select distribuidora_id, extract(year from mes_ref)::int as ano,
         sum(faturamento_liquido) as faturamento_liquido,
         sum(margem_valor)        as rentabilidade
    from public.vw_faturamento_vigente
   where exclusivo_professional
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
