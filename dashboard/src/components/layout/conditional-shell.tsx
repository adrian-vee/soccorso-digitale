'use client'
import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Header } from './header'

const AUTH_PATHS = ['/login', '/auth']

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p))

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
