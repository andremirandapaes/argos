// Calendário dos relatórios (datas "AAAA-MM-01" tratadas como texto, sem fuso). Nada financeiro aqui.

/** "2026-08-01" → 3 (jan–mar = 1, abr–jun = 2...). */
export function trimestreDe(mesRef: string) {
  return Math.floor((Number(mesRef.slice(5, 7)) - 1) / 3) + 1
}

/** 3, 2026 → "3º TRI/26" */
export function rotuloTrimestre(tri: number, ano: number) {
  return `${tri}º TRI/${String(ano).slice(2)}`
}

/** Os 12 meses de um ano: ["2026-01-01", ..., "2026-12-01"] */
export function mesesDoAno(ano: number) {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}-01`)
}
