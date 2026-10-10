/**
 * Converte o que vier (célula de planilha, texto colado) em número.
 * Aceita número nativo, texto pt-BR ("1.234,56", "25,2195", "R$ 1.000,50") e texto com ponto decimal ("1234.56").
 * Devolve null quando não é número.
 */
export function paraNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (typeof valor !== 'string') return null
  let texto = valor.trim().replace(/\s|R\$|%/g, '')
  if (!texto) return null
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.') // pt-BR
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null
  return Number(texto)
}
