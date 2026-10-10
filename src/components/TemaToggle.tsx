import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function TemaToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const escuro = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(escuro ? 'light' : 'dark')}
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
    >
      {escuro ? <Sun /> : <Moon />}
    </Button>
  )
}
