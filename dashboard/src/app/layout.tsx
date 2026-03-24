import type { Metadata } from 'next'
import { Inter_Tight, IBM_Plex_Serif } from 'next/font/google'
import '@/styles/globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ConditionalShell } from '@/components/layout/conditional-shell'
import { QueryProvider } from '@/lib/providers/query-provider'

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})
const ibmPlex = IBM_Plex_Serif({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Soccorso Digitale — Dashboard',
  description: 'Piattaforma cloud per il trasporto sanitario programmato',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={`${interTight.variable} ${ibmPlex.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <ConditionalShell>
              {children}
            </ConditionalShell>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
