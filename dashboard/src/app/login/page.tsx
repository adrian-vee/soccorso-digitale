'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email o password non corretti.'
          : error.message
      )
      setLoading(false)
      return
    }

    // Auth bridge: get Express JWT token after Supabase login
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        const { token } = await res.json()
        if (token) localStorage.setItem('sd_token', token)
      }
    } catch {
      // Non-blocking: dashboard works with Supabase session even without Express JWT
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#E7F0FA] flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Background orbs */}
      <div className="absolute top-[-120px] left-[-120px] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#2E5E99]/[0.08] to-[#7BA4D0]/[0.04] blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full bg-gradient-to-tl from-[#7BA4D0]/[0.10] to-[#2E5E99]/[0.04] blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 w-[200px] h-[200px] rounded-full bg-[#2E5E99]/[0.04] blur-2xl pointer-events-none" />

      {/* Card */}
      <div className="w-full max-w-[400px] animate-fade-in">
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_8px_32px_rgba(13,36,64,0.08)] p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] flex items-center justify-center shadow-lg mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <h1 className="text-[22px] font-bold text-[#0D2440] leading-tight text-center">Soccorso Digitale</h1>
            <p className="text-[12px] text-[#7BA4D0] mt-1 text-center">Piattaforma Cloud · Trasporto Sanitario</p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2.5 bg-red-500/[0.07] border border-red-500/[0.15] rounded-xl px-3.5 py-2.5 mb-5">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-[12px] font-medium text-red-600">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#0D2440] mb-1.5">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@organizzazione.it"
                className={cn(
                  "w-full h-[42px] px-3.5 rounded-xl border text-[13px] text-[#0D2440]",
                  "bg-white/60 placeholder:text-[#7BA4D0]/50",
                  "border-[#2E5E99]/[0.12] focus:border-[#7BA4D0]/50 focus:ring-2 focus:ring-[#7BA4D0]/15",
                  "outline-none transition-all"
                )}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#0D2440] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    "w-full h-[42px] pl-3.5 pr-10 rounded-xl border text-[13px] text-[#0D2440]",
                    "bg-white/60 placeholder:text-[#7BA4D0]/50",
                    "border-[#2E5E99]/[0.12] focus:border-[#7BA4D0]/50 focus:ring-2 focus:ring-[#7BA4D0]/15",
                    "outline-none transition-all"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7BA4D0] hover:text-[#2E5E99] transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link
                href="/login/forgot-password"
                className="text-[11px] text-[#7BA4D0] hover:text-[#2E5E99] transition-colors"
              >
                Password dimenticata?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-[42px] rounded-xl text-[14px] font-semibold text-white transition-all",
                "bg-[#2E5E99] hover:bg-[#254E82] shadow-sm shadow-[#2E5E99]/20",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#2E5E99]/[0.08]" />
            <span className="text-[11px] text-[#7BA4D0]">oppure</span>
            <div className="flex-1 h-px bg-[#2E5E99]/[0.08]" />
          </div>

          {/* Google (UI only — OAuth to be enabled in Supabase) */}
          <button
            type="button"
            disabled
            className="w-full h-[42px] rounded-xl border border-[#2E5E99]/[0.12] bg-white/60 text-[13px] font-medium text-[#0D2440]/50 flex items-center justify-center gap-2.5 cursor-not-allowed opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Accedi con Google <span className="text-[10px] text-[#7BA4D0] ml-1">(prossimamente)</span>
          </button>

          {/* Register link */}
          <p className="text-center text-[12px] text-[#7BA4D0] mt-5">
            Non hai un account?{' '}
            <Link href="/login/register" className="text-[#2E5E99] font-semibold hover:text-[#0D2440] transition-colors">
              Registrati
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-[11px] text-[#7BA4D0]/70 text-center">
        © {new Date().getFullYear()} Soccorso Digitale S.r.l. — Verona, Italia
      </p>
    </div>
  )
}
