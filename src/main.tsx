import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { SessaoProvider } from '@/auth/SessaoProvider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="argos-tema">
      <QueryClientProvider client={queryClient}>
        <SessaoProvider>
          <TooltipProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </SessaoProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
