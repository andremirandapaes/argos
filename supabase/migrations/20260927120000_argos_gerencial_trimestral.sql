-- =============================================================================
-- ARGOS — Módulo 1: visão TRIMESTRAL do Gerencial DUN PROFESSIONAL
-- =============================================================================
-- Só ACRESCENTA duas views. Não altera tabelas, dados, funções nem views
-- existentes (a migration inicial continua igual).
--
-- Mesma lógica da visão anual (vw_gerencial_anual): a despesa do trimestre é
-- rateada pela participação do departamento no faturamento DO TRIMESTRE
-- (participação trimestral × despesa trimestral), e não pela soma dos rateios
-- mensais. Trimestre = extract(quarter): jan–mar = 1, abr–jun = 2, etc.
--
-- Percentuais são frações (0.2281 = 22,81%), como nas demais views.
-- =============================================================================

-- DUN PROFESSIONAL — trimestral por departamento
create view public.vw_gerencial_trimestral
with (security_invoker = true) as
with a as (
  select distribuidora_id,
         extract(year from mes_ref)::int    as ano,
         extract(quarter from mes_ref)::int as trimestre,
         departamento_id, codigo_winthor, nome, exclusivo_professional,
         sum(faturamento_liquido) as faturamento_liquido,
         sum(margem_valor)        as rentabilidade
    from public.vw_faturamento_vigente
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

-- DUN PROFESSIONAL — total do trimestre (linha TOTAL e cards)
--   meses_com_carga / meses_com_despesa: quantos meses do trimestre entraram
--   (um trimestre em andamento pode ter menos de 3).
create view public.vw_gerencial_trimestral_total
with (security_invoker = true) as
with f as (
  select distribuidora_id,
         extract(year from mes_ref)::int    as ano,
         extract(quarter from mes_ref)::int as trimestre,
         count(distinct mes_ref)            as meses_com_carga,
         sum(faturamento_liquido)           as faturamento_liquido,
         sum(margem_valor)                  as rentabilidade
    from public.vw_faturamento_vigente
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
