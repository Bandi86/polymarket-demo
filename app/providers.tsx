'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/lib/theme-context'
import { Toaster } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SSEProvider } from '@/hooks/useSSE'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      }
    }
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider>
          <SSEProvider>
            {children}
          </SSEProvider>
          <Toaster />
        </ThemeProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}