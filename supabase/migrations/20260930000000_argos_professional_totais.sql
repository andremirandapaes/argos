-- =============================================================================
-- ARGOS — Módulo 1: totais e visão trimestral do PROFESSIONAL
-- =============================================================================
-- Só ACRESCENTA views. Não altera tabelas, dados, funções nem views existentes.
--
-- PROFESSIONAL = só os departamentos marcados como exclusivo_professional, sem
-- despesa e sem LB (igual a vw_professional_mensal / vw_professional_anual).
-- Participação é sobre o total dos exclusivos do período.
-- Percentuais são frações (0.2281 = 22,81%), como nas demais views.
-- =============================================================================

-- PROFESSIONAL — total do mês (linha TOTAL da visão mensal)
create view public.vw_professional_mensal_total
with (security_invoker = true) as
select distribuidora_id,
       mes_ref,
       count(*)                                                         as qtd_departamentos,
       sum(faturamento_liquido)                                         as faturamento_liquido,
       sum(margem_valor)                                                as rentabilidade,
       coalesce(sum(margem_valor) / nullif(sum(faturamento_liquido), 0), 0) as rentabilidade_pct
  from public.vw_faturamento_vigente
 where exclusivo_professional
 group by distribuidora_id, mes_ref;

-- PROFESSIONAL — total do ano (linha TOTAL da visão anual)
create view public.vw_professional_anual_total
with (security_invoker = true) as
select distribuidora_id,
       extract(year from mes_ref)::int                                  as ano,
       count(distinct mes_ref)                                          as meses_com_carga,
       sum(faturamento_liquido)                                         as faturamento_liquido,
       sum(margem_valor)                                                as rentabilidade,
       coalesce(sum(margem_valor) / nullif(sum(faturamento_liquido), 0), 0) as rentabilidade_pct
  from public.vw_faturamento_vigente
 where exclusivo_professional
 group by distribuidora_id, extract(year from mes_ref)::int;

-- PROFESSIONAL — trimestral por departamento
create view public.vw_professional_trimestral
with (security_invoker = true) as
with a as (
  select distribuidora_id,
         extract(year from mes_ref)::int    as ano,
         extract(quarter from mes_ref)::int as trimestre,
         departamento_id, codigo_winthor, nome,
         sum(faturamento_liquido) as faturamento_liquido,
         sum(margem_valor)        as rentabilidade
    from public.vw_faturamento_vigente
   where exclusivo_professional
   group by distribuidora_id, extract(year from mes_ref)::int, extract(quarter from mes_ref)::int,
            departamento_id, codigo_winthor, nome
)
select a.*,
       coalesce(a.rentabilidade / nullif(a.faturamento_liquido, 0), 0) as rentabilidade_pct,
       coalesce(a.faturamento_liquido
                / nullif(sum(a.faturamento_liquido) over (partition by a.distribuidora_id, a.ano, a.trimestre), 0), 0)
                                                                        as participacao
  from a;

-- PROFESSIONAL — total do trimestre
create view public.vw_professional_trimestral_total
with (security_invoker = true) as
select distribuidora_id,
       extract(year from mes_ref)::int                                  as ano,
       extract(quarter from mes_ref)::int                               as trimestre,
       count(distinct mes_ref)                                          as meses_com_carga,
       sum(faturamento_liquido)                                         as faturamento_liquido,
       sum(margem_valor)                                                as rentabilidade,
       coalesce(sum(margem_valor) / nullif(sum(faturamento_liquido), 0), 0) as rentabilidade_pct
  from public.vw_faturamento_vigente
 where exclusivo_professional
 group by distribuidora_id, extract(year from mes_ref)::int, extract(quarter from mes_ref)::int;
