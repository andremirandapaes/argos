-- =============================================================================
-- ARGOS — HeadCount: Logística do sistema a partir de Set/25
-- Só substitui a view vw_headcount_linhas (mesmas colunas). Tabelas e dados não mudam.
-- =============================================================================
-- Regra (pedido do usuário em 2026-11-24, substitui o corte de Jan/26):
--   - até Ago/25: Logística da planilha do Depósito (auditada); a do sistema é ignorada
--     (inclui as exportações de Jul e Ago/25 que vieram na carga inicial);
--   - de Set/25 em diante, AM e RR: Logística da exportação do sistema (Depósito + Distribuição,
--     já com o tratamento aplicado na leitura: as pessoas lotadas no Depósito que são da
--     Distribuição contam na Distribuição) no mês + UF que tiver exportação;
--     enquanto o mês ainda não tiver a exportação enviada, vale a planilha do Depósito.
-- A data é a mesma do leitor (LOGISTICA_DO_SISTEMA_DESDE = '2025-09' em ler-sistema.ts).
-- Atenção: bases de Set/25 em diante importadas ANTES desta regra entraram sem a Logística
-- (o leitor a descartava); é preciso importá-las de novo (o reenvio substitui a base do mês).
-- Comercial, Backoffice e terceirizados: sem mudança.
-- =============================================================================

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
 where -- sistema: Comercial e Backoffice sempre; Logística de Set/25 em diante
       (f.tipo = 'sistema' and (l.area <> 'Logística' or l.competencia >= date '2025-09-01'))
       -- planilhas: terceirizados, se o mês não tem lançamento no ARGOS
    or (f.tipo <> 'sistema' and l.vinculo = 'Terceirizado'
        and not exists (select 1 from public.hc_terceirizados_mes t where t.competencia = l.competencia))
       -- planilhas: onde não há exportação do sistema no mês + UF (Logística até Ago/25: sempre da planilha)
    or (f.tipo <> 'sistema' and l.vinculo <> 'Terceirizado'
        and ((l.area = 'Logística' and l.competencia < date '2025-09-01')
             or not exists (select 1 from cobertura_sistema c where c.competencia = l.competencia and c.uf = l.uf)))
union all
select -i.id, i.competencia, i.uf, i.area,
       i.distribuidora,
       case when i.area = 'Comercial' then coalesce(i.centro, 'Centro não informado') end,
       i.departamento,
       case when i.area = 'Backoffice' then null else 'Terceirizado (cargo não informado)' end,
       'Terceirizado', i.quantidade, 'lancamento_terceirizados'
  from public.hc_terceirizados_itens i;
