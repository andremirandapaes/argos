// Configuração única do AG Grid: módulos e tema.
// O tema usa as variáveis CSS do ARGOS, então acompanha o claro/escuro sem código extra.

import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type ValueFormatterParams,
} from 'ag-grid-community'
import { formatarMoeda, formatarPct } from './format'

ModuleRegistry.registerModules([AllCommunityModule])

export const temaArgos = themeQuartz.withParams({
  fontFamily: 'inherit',
  fontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 600,
  spacing: 6,
  rowHeight: 36,
  headerHeight: 38,
  backgroundColor: 'var(--card)',
  foregroundColor: 'var(--card-foreground)',
  headerBackgroundColor: 'var(--muted)',
  headerTextColor: 'var(--muted-foreground)',
  borderColor: 'var(--border)',
  rowHoverColor: 'var(--accent)',
  selectedRowBackgroundColor: 'var(--accent)',
  accentColor: 'var(--ring)',
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  columnBorder: false,
  browserColorScheme: 'inherit',
  // linha TOTAL fixa no rodapé
  pinnedRowBackgroundColor: 'var(--muted)',
  pinnedRowFontWeight: 600,
  pinnedRowBorder: { width: 2, color: 'var(--border)' },
})

/** valueFormatters prontos para colunas numéricas (só formatação). */
export const fmtMoeda = (p: ValueFormatterParams) => formatarMoeda(p.value as number | null)
export const fmtPct = (p: ValueFormatterParams) => formatarPct(p.value as number | null)

/** Classe de célula: vermelho quando negativo. */
export const classeNegativo = { 'text-destructive': (p: { value: unknown }) => typeof p.value === 'number' && p.value < 0 }

/**
 * Linhas exatamente como estão na tela: respeita a busca/filtro e a ordenação atual
 * (a linha TOTAL fixa no rodapé não entra; ela é tratada à parte na exportação).
 */
export function linhasExibidas<T>(api: GridApi<T>): T[] {
  const linhas: T[] = []
  api.forEachNodeAfterFilterAndSort((n) => n.data && linhas.push(n.data))
  return linhas
}

/** Coluna numérica centralizada (cabeçalho e valores). */
export const colunaNumerica = { headerClass: 'ag-centro', cellClass: 'tabular-nums text-center' } satisfies Partial<ColDef>

/**
 * Coluna numérica com fundo preenchido (cabeçalho, linhas e TOTAL). Cores em index.css:
 * bege-2 = bege forte (destaque), bege-1 = bege suave, azul = azul claro.
 */
export function colunaFundo(cor: 'bege-1' | 'bege-2' | 'azul') {
  return {
    headerClass: `ag-centro ag-fundo-${cor}`,
    cellClass: `tabular-nums text-center ag-fundo-${cor}`,
  } satisfies Partial<ColDef>
}
