import { formatarMoeda } from '@/lib/format'

/** Diferenças abaixo de meio centavo contam como iguais (mesmo critério do comparar_cargas_faturamento). */
export function semDiferenca(dif: number) {
  return Math.abs(dif) < 0.005
}

/** Diferença com sinal: +R$ 1.234,56 / -R$ 1.234,56 */
export function moedaComSinal(v: number) {
  return (v > 0.005 ? '+' : '') + formatarMoeda(v)
}
