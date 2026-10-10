import type { ReactNode } from 'react'
import type { CustomCellRendererProps } from 'ag-grid-react'
import { AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Celula, FiltroVinculo as FiltroVinculoTipo, LinhaArvore } from './regras'

const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const pct1 = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Pessoas: 1234 → "1.234"; null → "—" */
export const fmtPessoas = (v: number | null | undefined) => (v == null ? '—' : inteiro.format(Math.round(v)))
/** Fração com uma casa: 0.123 → "12,3%" */
export const fmtPct1 = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : pct1.format(v).replace(/ /g, ' '))
/** Variação com sinal: +12 / −3 */
export const fmtVariacao = (v: number) => `${v > 0 ? '+' : ''}${fmtPessoas(v)}`

/** Campo de filtro com rótulo pequeno em cima. */
export function CampoFiltro({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{rotulo}</span>
      {children}
    </div>
  )
}

/** cor: bolinha ao lado do nome (ex.: cor oficial da distribuidora) */
export type Opcao = { value: string; label: string; grupo?: string; cor?: string }

/** Texto curto da seleção: "Todos", "Elo Norte (consolidado)", "Dunorte · Vendas" ou "3 selecionados". */
export function resumoSelecao(valor: string[], opcoes: Opcao[]) {
  if (valor.length === 0) return 'Todos'
  // seleção = exatamente um grupo inteiro (ex.: Vendas + Merchan de uma distribuidora) → "Nome (consolidado)"
  const grupos = [...new Set(opcoes.map((o) => o.grupo ?? ''))]
  const grupoInteiro = grupos.find((g) => {
    const doGrupo = opcoes.filter((o) => (o.grupo ?? '') === g).map((o) => o.value)
    return g && doGrupo.length > 1 && doGrupo.length === valor.length && doGrupo.every((v) => valor.includes(v))
  })
  if (grupoInteiro) return `${grupoInteiro} (consolidado)`
  if (valor.length > 1) return `${valor.length} selecionados`
  const o = opcoes.find((x) => x.value === valor[0])
  return o ? (o.grupo ? `${o.grupo} · ${o.label}` : o.label) : valor[0]
}

/** Filtro de várias escolhas (vazio = todos). */
export function FiltroMulti({
  rotulo,
  valor,
  onMudar,
  opcoes,
  corGrupo,
}: {
  rotulo: string
  valor: string[]
  onMudar: (v: string[]) => void
  opcoes: Opcao[]
  /** cor do nome do grupo (ex.: distribuidora); sem cor, o nome do grupo fica verde */
  corGrupo?: (grupo: string) => string | undefined
}) {
  const grupos = [...new Set(opcoes.map((o) => o.grupo ?? ''))]
  const resumo = resumoSelecao(valor, opcoes)
  const alternar = (v: string, marcado: boolean) => onMudar(marcado ? [...valor, v] : valor.filter((x) => x !== v))
  const alternarGrupo = (g: string) => {
    const doGrupo = opcoes.filter((o) => (o.grupo ?? '') === g).map((o) => o.value)
    const todos = doGrupo.every((v) => valor.includes(v))
    onMudar(todos ? valor.filter((v) => !doGrupo.includes(v)) : [...new Set([...valor, ...doGrupo])])
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={cn('h-9 w-full justify-between px-3 font-normal', valor.length === 0 && 'text-muted-foreground')}
            aria-label={rotulo}
          />
        }
      >
        <span className="truncate">{resumo}</span>
        <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 min-w-(--anchor-width) overflow-y-auto">
        {opcoes.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Nada para escolher</div>}
        {grupos.map((g, i) => (
          <DropdownMenuGroup key={g || i}>
            {i > 0 && <DropdownMenuSeparator />}
            {g && (
              // nome do grupo (ex.: distribuidora) colorido: clicar seleciona o grupo inteiro (consolidado)
              <DropdownMenuLabel
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-md font-semibold hover:bg-accent',
                  !corGrupo?.(g) && 'text-positivo',
                )}
                // o texto puxa um pouco para a cor da tinta, para ficar legível mesmo nos tons claros (amarelo)
                style={corGrupo?.(g) ? { color: `color-mix(in oklch, ${corGrupo(g)} 78%, var(--foreground))` } : undefined}
                onClick={() => alternarGrupo(g)}
                title={`Selecionar todo o grupo ${g} (consolidado)`}
              >
                <span className="flex items-center gap-1.5">
                  {corGrupo?.(g) && <span className="size-2.5 rounded-full" style={{ background: corGrupo(g) }} />}
                  {g}
                </span>
                {opcoes.filter((o) => (o.grupo ?? '') === g).every((o) => valor.includes(o.value)) && <Check className="size-4" />}
              </DropdownMenuLabel>
            )}
            {opcoes
              .filter((o) => (o.grupo ?? '') === g)
              .map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.value}
                  checked={valor.includes(o.value)}
                  onCheckedChange={(m) => alternar(o.value, m)}
                  closeOnClick={false}
                >
                  {o.cor && <span className="size-2.5 rounded-full" style={{ background: o.cor }} />}
                  {o.label}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuGroup>
        ))}
        {valor.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              className="w-full rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => onMudar([])}
            >
              Limpar seleção
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Escolha única em botões lado a lado (ex.: Ambos | CLT | Terceirizado). */
export function Escolha<T extends string>({
  valor,
  onMudar,
  opcoes,
  rotulo,
}: {
  valor: T
  onMudar: (v: T) => void
  opcoes: { value: T; label: string }[]
  rotulo: string
}) {
  return (
    <ToggleGroup spacing={0} variant="outline" size="sm" value={[valor]} onValueChange={(v) => v[0] && onMudar(v[0] as T)} aria-label={rotulo}>
      {opcoes.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-9 min-w-14 px-4 group-data-[spacing=0]/toggle-group:px-4 text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** Botões lado a lado que ligam/desligam cada opção (nenhum ligado = todos). */
export function EscolhaMulti({
  valor,
  onMudar,
  opcoes,
  rotulo,
}: {
  valor: string[]
  onMudar: (v: string[]) => void
  opcoes: { value: string; label: string; dica?: string }[]
  rotulo: string
}) {
  return (
    <ToggleGroup spacing={0} multiple variant="outline" size="sm" value={valor} onValueChange={(v) => onMudar(v as string[])} aria-label={rotulo}>
      {opcoes.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          title={o.dica}
          className="h-9 min-w-14 px-4 group-data-[spacing=0]/toggle-group:px-4 text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** Vínculo: CLT | Terceirizado. Nenhum marcado = os dois (Ambos); marcar um troca a seleção. */
export function BotoesVinculo({ valor, onMudar }: { valor: FiltroVinculoTipo; onMudar: (v: FiltroVinculoTipo) => void }) {
  return (
    <EscolhaMulti
      rotulo="Vínculo (nenhum marcado = CLT e terceirizados)"
      valor={valor === 'Ambos' ? [] : [valor]}
      onMudar={(v) => onMudar(v.length === 0 ? 'Ambos' : ((v.find((x) => x !== valor) ?? v[0]) as FiltroVinculoTipo))}
      opcoes={[
        { value: 'CLT', label: 'CLT' },
        { value: 'Terceirizado', label: 'Terceirizado' },
      ]}
    />
  )
}

/** Aviso de total parcial (alguma base faltando no mês). */
export function AvisoParcial({ itens, claro = false }: { itens: string[]; /** sobre fundo escuro (card de destaque) */ claro?: boolean }) {
  if (!itens.length) return null
  return (
    <p
      className={cn('mt-1 flex items-start gap-1.5 text-xs whitespace-normal', claro ? 'text-amber-200' : 'text-alerta-foreground')}
      title={itens.join('\n')}
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0" />
      <span>Parcial: {itens.length === 1 ? itens[0] : `${itens[0]} e mais ${itens.length - 1}`}</span>
    </p>
  )
}

/** Célula de mês: número, "—" (sem dado), vazio (ainda não existia) ou parcial com "*". */
export function CelulaMes({ value }: { value: Celula | undefined }) {
  if (value === '') return <span />
  if (value == null) {
    return (
      <span className="text-muted-foreground/70" title="Sem dado ou sem detalhamento neste mês">
        —
      </span>
    )
  }
  if (typeof value === 'object') {
    return (
      <span className="font-medium text-alerta-foreground" title="Parcial: parte das bases está sem dado neste mês">
        {fmtPessoas(value.v)}*
      </span>
    )
  }
  return <span className={cn(value === 0 && 'text-muted-foreground/60')}>{fmtPessoas(value)}</span>
}

/** Δ período: último mês menos o primeiro. */
export function CelulaDelta({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground/70">—</span>
  return (
    <span className={cn('font-medium', value > 0 ? 'text-positivo' : value < 0 ? 'text-destructive' : 'text-muted-foreground')}>
      {fmtVariacao(value)}
    </span>
  )
}

// recuo por nível da árvore (classes literais para o Tailwind)
const RECUO = ['pl-0', 'pl-5', 'pl-10', 'pl-15', 'pl-20']

/** Primeira coluna do detalhamento: nome com recuo e botão de abrir/fechar. */
export function CelulaEstrutura({
  data,
  context,
}: CustomCellRendererProps<LinhaArvore & { __total?: boolean }, unknown, { alternar: (id: string) => void }>) {
  if (!data) return null
  if (data.__total) return <span className="font-semibold">Total</span>
  return (
    <div className={cn('flex h-full items-center gap-1', RECUO[data.prof])}>
      {data.temFilhos ? (
        <button
          type="button"
          aria-label={data.aberto ? `Recolher ${data.label}` : `Expandir ${data.label}`}
          onClick={() => context.alternar(data.id)}
          className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronRight className={cn('size-4 transition-transform', data.aberto && 'rotate-90')} />
        </button>
      ) : (
        <span className="w-6 shrink-0" />
      )}
      <span className={cn('truncate', data.prof === 0 && 'font-semibold', data.prof === 1 && 'font-medium')} title={data.label}>
        {data.label}
      </span>
    </div>
  )
}
