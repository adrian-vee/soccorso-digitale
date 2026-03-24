'use client'
import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from './sidebar'
import { Header } from './header'

const AUTH_PATHS = ['/login', '/auth']

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = React.useState(false)
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p))

  React.useEffect(() => {
    if (isAuthPage) {
      setReady(true)
      return
    }
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setReady(true)
      }
    })
  }, [pathname, isAuthPage, router])

  if (!ready) return null

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--sd-bg)]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
