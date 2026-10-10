-- =============================================================================
-- ARGOS — Módulo 1: resumo do Gerencial para um intervalo livre de meses
-- =============================================================================
-- Só ACRESCENTA uma função de leitura. Não altera tabelas, dados, funções nem views.
--
-- Usada pelos cards da Evolução quando o usuário seleciona meses no gráfico.
-- Mesma lógica de vw_gerencial_anual_total, só que limitada ao intervalo
-- [p_inicio, p_fim]: selecionar o ano inteiro dá exatamente o total anual.
-- Percentuais são frações (0.2281 = 22,81%), como nas views.
-- =============================================================================

create or replace function public.resumo_gerencial_periodo(
  p_distribuidora_slug text,
  p_inicio             date,
  p_fim                date
)
returns table (
  meses_com_carga     integer,
  faturamento_liquido numeric,
  rentabilidade       numeric,
  rentabilidade_pct   numeric,
  despesa             numeric,
  lb                  numeric,
  lb_pct              numeric,
  custo_op_pct        numeric
)
language sql
stable
security invoker   -- lê as views com o RLS de quem consulta
set search_path = public
as $$
  with d as (
    select id from distribuidoras where slug = p_distribuidora_slug
  ), f as (
    select count(distinct v.mes_ref)::int  as meses_com_carga,
           sum(v.faturamento_liquido)      as faturamento_liquido,
           sum(v.margem_valor)             as rentabilidade
      from vw_faturamento_vigente v
      join d on d.id = v.distribuidora_id
     where v.mes_ref between p_inicio and p_fim
  ), dsp as (
    select sum(x.valor_total) as despesa
      from vw_despesa_vigente x
      join d on d.id = x.distribuidora_id
     where x.mes_ref between p_inicio and p_fim
  )
  select f.meses_com_carga,
         f.faturamento_liquido,
         f.rentabilidade,
         coalesce(f.rentabilidade / nullif(f.faturamento_liquido, 0), 0),
         dsp.despesa,
         f.rentabilidade - coalesce(dsp.despesa, 0),
         case when f.faturamento_liquido > 0
              then (f.rentabilidade - coalesce(dsp.despesa, 0)) / f.faturamento_liquido
              else 0 end,
         coalesce(dsp.despesa / nullif(f.faturamento_liquido, 0), 0)
    from f cross join dsp
$$;

revoke execute on function public.resumo_gerencial_periodo(text, date, date) from public, anon;
grant execute on function public.resumo_gerencial_periodo(text, date, date) to authenticated;
