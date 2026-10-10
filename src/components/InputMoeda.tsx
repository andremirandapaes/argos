import { useId, type ClipboardEvent, type KeyboardEvent } from 'react'
import { paraNumero } from '@/lib/numero'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'

const FORMATO = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const LIMITE_CENTAVOS = 99_999_999_999_99 // R$ 99 bilhões: evita números sem sentido

/**
 * Campo de moeda pt-BR. Digitar preenche da direita para a esquerda, em centavos
 * ("22034950" → 220.349,50). Colar aceita "220.349,50", "R$ 220.349,50" ou "220349.5".
 */
export function InputMoeda({
  valor,
  onChange,
  id,
  invalido,
  disabled,
  autoFocus,
}: {
  valor: number | null
  onChange: (valor: number | null) => void
  id?: string
  invalido?: boolean
  disabled?: boolean
  autoFocus?: boolean
}) {
  const idPadrao = useId()
  const texto = valor == null ? '' : FORMATO.format(valor)

  function aoDigitar(bruto: string) {
    const digitos = bruto.replace(/\D/g, '').replace(/^0+/, '')
    if (!digitos) return onChange(null)
    const centavos = Math.min(Number(digitos), LIMITE_CENTAVOS)
    onChange(centavos / 100)
  }

  function aoColar(e: ClipboardEvent<HTMLInputElement>) {
    const numero = paraNumero(e.clipboardData.getData('text'))
    if (numero == null || numero < 0) return // deixa o comportamento padrão (só dígitos)
    e.preventDefault()
    onChange(Math.round(numero * 100) / 100)
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && valor != null) {
      e.preventDefault()
      onChange(null)
    }
  }

  return (
    <InputGroup data-disabled={disabled || undefined}>
      <InputGroupAddon>
        <InputGroupText>R$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id ?? idPadrao}
        inputMode="numeric"
        autoComplete="off"
        placeholder="0,00"
        value={texto}
        onChange={(e) => aoDigitar(e.target.value)}
        onPaste={aoColar}
        onKeyDown={aoTeclar}
        aria-invalid={invalido || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        className="text-right tabular-nums"
      />
    </InputGroup>
  )
}
