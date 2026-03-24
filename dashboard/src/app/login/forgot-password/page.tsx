'use client'
import * as React from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/impostazioni`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
  }

  return (
    <div className="min-h-screen bg-[#E7F0FA] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full bg-gradient-to-br from-[#2E5E99]/[0.07] to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-[380px] animate-fade-in">
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_8px_32px_rgba(13,36,64,0.08)] p-8">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] flex items-center justify-center shadow-sm shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-[#0D2440] leading-tight">Recupera Password</h1>
              <p className="text-[11px] text-[#7BA4D0]">Soccorso Digitale</p>
            </div>
          </div>

          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <h2 className="text-[15px] font-bold text-[#0D2440] mb-2">Email inviata</h2>
              <p className="text-[12px] text-[#7BA4D0] leading-relaxed">
                Controlla <strong className="text-[#0D2440]">{email}</strong> — troverai un link per reimpostare la password.
              </p>
              <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2E5E99] hover:text-[#0D2440] transition-colors">
                <ArrowLeft size={13} /> Torna al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <p className="text-[12px] text-[#7BA4D0] leading-relaxed -mt-1 mb-1">
                Inserisci la tua email e ti invieremo un link per reimpostare la password.
              </p>

              {error && (
                <div className="flex items-center gap-2.5 bg-red-500/[0.07] border border-red-500/[0.15] rounded-xl px-3.5 py-2.5">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-[12px] font-medium text-red-600">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[#0D2440] mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  placeholder="nome@organizzazione.it"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "w-full h-[42px] px-3.5 rounded-xl border text-[13px] text-[#0D2440]",
                    "bg-white/60 placeholder:text-[#7BA4D0]/50",
                    "border-[#2E5E99]/[0.12] focus:border-[#7BA4D0]/50 focus:ring-2 focus:ring-[#7BA4D0]/15",
                    "outline-none transition-all"
                  )}
                />
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
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Invio in corso...' : 'Invia link di reset'}
              </button>

              <Link href="/login" className="flex items-center justify-center gap-1.5 text-[12px] text-[#7BA4D0] hover:text-[#2E5E99] transition-colors">
                <ArrowLeft size={12} /> Torna al login
              </Link>
            </form>
          )}
        </div>
      </div>

      <p className="mt-6 text-[11px] text-[#7BA4D0]/70 text-center">
        © {new Date().getFullYear()} Soccorso Digitale S.r.l. — Verona, Italia
      </p>
    </div>
  )
}
