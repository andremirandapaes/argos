-- =============================================================================
-- ARGOS — HeadCount: regras da Logística (pedido do usuário em 2026-10-07)
-- Troca a view de consolidação (mesmas colunas) e permite informar o setor da
-- Logística (Depósito / Distribuição) no lançamento de terceirizados.
-- Os dados já gravados não mudam.
-- =============================================================================
-- Logística:
--   - até Ago/26: vale a planilha do Depósito (auditada); a Logística da
--     exportação do sistema é ignorada nesses meses;
--   - de Set/26 em diante: vem da exportação do sistema (Depósito + Distribuição),
--     já com o tratamento do usuário aplicado na leitura (pessoas do Depósito que
--     são da Distribuição). A planilha manual não conta mais para a Logística.
-- Comercial e Backoffice: sem mudança (o sistema substitui as planilhas no mês + UF).
-- Terceirizados: sem mudança na regra; o lançamento da Logística agora pode trazer
-- o setor (o Depósito concentra os terceirizados e precisa aparecer separado).
-- =============================================================================

-- 1. Lançamento de terceirizados: Logística pode ter setor (departamento)
alter table public.hc_terceirizados_itens drop constraint hc_terc_itens_chk;
alter table public.hc_terceirizados_itens add constraint hc_terc_itens_chk check (
  (area = 'Comercial'  and distribuidora is not null and departamento is null) or
  (area = 'Logística'  and distribuidora is null and centro is null) or
  (area = 'Backoffice' and departamento is not null and distribuidora is null and centro is null)
);

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

  -- itens iguais (mesma UF/área/distribuidora/centro/departamento ou setor) são somados
  insert into hc_terceirizados_itens (competencia, uf, area, distribuidora, centro, departamento, quantidade)
  select p_competencia, x.uf, x.area,
         case when x.area = 'Comercial' then nullif(trim(x.distribuidora), '') end,
         case when x.area = 'Comercial' then nullif(trim(x.centro), '') end,
         case when x.area in ('Backoffice', 'Logística') then nullif(trim(x.departamento), '') end,
         sum(x.quantidade)::integer
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb))
         as x(uf text, area text, distribuidora text, centro text, departamento text, quantidade integer)
   where coalesce(x.quantidade, 0) > 0
   group by 1, 2, 3, 4, 5, 6;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

-- 2. Consolidação
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
 where -- sistema: Comercial e Backoffice sempre; Logística só de Set/26 em diante
       (f.tipo = 'sistema' and (l.area <> 'Logística' or l.competencia >= date '2026-09-01'))
       -- planilhas: terceirizados, se o mês não tem lançamento no ARGOS
    or (f.tipo <> 'sistema' and l.vinculo = 'Terceirizado'
        and not exists (select 1 from public.hc_terceirizados_mes t where t.competencia = l.competencia))
       -- planilhas: Logística até Ago/26; Comercial/Backoffice onde não há exportação do sistema
    or (f.tipo <> 'sistema' and l.vinculo <> 'Terceirizado'
        and case when l.area = 'Logística' then l.competencia < date '2026-09-01'
                 else not exists (select 1 from cobertura_sistema c where c.competencia = l.competencia and c.uf = l.uf)
            end)
union all
select -i.id, i.competencia, i.uf, i.area,
       i.distribuidora,
       case when i.area = 'Comercial' then coalesce(i.centro, 'Centro não informado') end,
       i.departamento,
       case when i.area = 'Backoffice' then null else 'Terceirizado (cargo não informado)' end,
       'Terceirizado', i.quantidade, 'lancamento_terceirizados'
  from public.hc_terceirizados_itens i;
