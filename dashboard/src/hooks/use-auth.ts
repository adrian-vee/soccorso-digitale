'use client'

import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Derived display values
  const firstName: string = (user?.user_metadata?.first_name as string) || ''
  const lastName: string  = (user?.user_metadata?.last_name  as string) || ''
  const displayName = firstName
    ? `${firstName} ${lastName}`.trim()
    : (user?.email?.split('@')[0] ?? 'Utente')
  const initials = firstName
    ? `${firstName[0]}${lastName[0] ?? ''}`.toUpperCase()
    : (user?.email?.[0] ?? 'U').toUpperCase()
  const email = user?.email ?? ''

  return { user, loading, signOut, displayName, initials, email }
}
