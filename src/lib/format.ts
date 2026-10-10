// Formatação pt-BR. Só formata: nenhum cálculo financeiro acontece no front.

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const percentual = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

const moedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** 220349.5 → "R$ 220,3 mil" (para eixos de gráfico) */
export function formatarMoedaCompacta(valor: number | null | undefined): string {
  if (valor == null) return '—'
  return moedaCompacta.format(valor).replace(/ /g, ' ')
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** 1234567.891 → "R$ 1.234.567,89" */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return '—'
  // Intl usa espaço não separável depois do "R$"; troca por espaço comum para exportação/cópia
  return moeda.format(valor).replace(/ /g, ' ')
}

/** Recebe FRAÇÃO (como vem das views): 0.2281 → "22,81%" */
export function formatarPct(fracao: number | null | undefined): string {
  if (fracao == null) return '—'
  return percentual.format(fracao).replace(/ /g, ' ')
}

/** 1234 → "1.234" */
export function formatarInteiro(valor: number | null | undefined): string {
  if (valor == null) return '—'
  return inteiro.format(valor)
}

/** "2026-08-01" → "Ago/26" (lê a data como texto para não sofrer com fuso horário) */
export function formatarMes(mesRef: string | null | undefined): string {
  if (!mesRef) return '—'
  const [ano, mes] = mesRef.split('-')
  return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`
}

/** Data/hora ISO → "27/09/2026 14:30" */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
