'use client'
import * as React from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [form, setForm] = React.useState({
    firstName: '', lastName: '', email: '',
    password: '', confirm: '', org: '',
  })
  const [terms, setTerms] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Le password non coincidono.')
      return
    }
    if (!terms) {
      setError('Devi accettare i Termini di Servizio.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          organization: form.org,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
  }

  const fieldCls = cn(
    "w-full h-[42px] px-3.5 rounded-xl border text-[13px] text-[#0D2440]",
    "bg-white/60 placeholder:text-[#7BA4D0]/50",
    "border-[#2E5E99]/[0.12] focus:border-[#7BA4D0]/50 focus:ring-2 focus:ring-[#7BA4D0]/15",
    "outline-none transition-all"
  )

  return (
    <div className="min-h-screen bg-[#E7F0FA] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full bg-gradient-to-bl from-[#2E5E99]/[0.07] to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] left-[-80px] w-[350px] h-[350px] rounded-full bg-gradient-to-tr from-[#7BA4D0]/[0.08] to-transparent blur-3xl pointer-events-none" />

      <div className="w-full max-w-[440px] animate-fade-in">
        <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_8px_32px_rgba(13,36,64,0.08)] p-8">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] flex items-center justify-center shadow-sm shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-[#0D2440] leading-tight">Crea Account</h1>
              <p className="text-[11px] text-[#7BA4D0]">Soccorso Digitale</p>
            </div>
          </div>

          {done ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <h2 className="text-[16px] font-bold text-[#0D2440] mb-2">Controlla la tua email</h2>
              <p className="text-[12px] text-[#7BA4D0] leading-relaxed">
                Abbiamo inviato un link di conferma a <strong className="text-[#0D2440]">{form.email}</strong>.
                Clicca il link per attivare il tuo account.
              </p>
              <Link href="/login" className="mt-6 inline-block text-[12px] font-semibold text-[#2E5E99] hover:text-[#0D2440] transition-colors">
                ← Torna al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              {error && (
                <div className="flex items-center gap-2.5 bg-red-500/[0.07] border border-red-500/[0.15] rounded-xl px-3.5 py-2.5">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-[12px] font-medium text-red-600">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#0D2440] mb-1.5">Nome</label>
                  <input type="text" required placeholder="Mario" value={form.firstName} onChange={set('firstName')} className={fieldCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#0D2440] mb-1.5">Cognome</label>
                  <input type="text" required placeholder="Rossi" value={form.lastName} onChange={set('lastName')} className={fieldCls} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0D2440] mb-1.5">Email</label>
                <input type="email" required placeholder="nome@org.it" value={form.email} onChange={set('email')} className={fieldCls} />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0D2440] mb-1.5">Nome Organizzazione</label>
                <input type="text" placeholder="Croce Rossa — Sede di Verona" value={form.org} onChange={set('org')} className={fieldCls} />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#0D2440] mb-1.5">Password</label>
                  <input type="password" required placeholder="••••••••" value={form.password} onChange={set('password')} className={fieldCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#0D2440] mb-1.5">Conferma</label>
                  <input type="password" required placeholder="••••••••" value={form.confirm} onChange={set('confirm')} className={fieldCls} />
                </div>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-[#2E5E99]/20 text-[#2E5E99] cursor-pointer accent-[#2E5E99]"
                />
                <span className="text-[11px] text-[#7BA4D0] leading-relaxed">
                  Accetto i{' '}
                  <span className="text-[#2E5E99] hover:underline cursor-pointer">Termini di Servizio</span>
                  {' '}e la{' '}
                  <span className="text-[#2E5E99] hover:underline cursor-pointer">Privacy Policy</span>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full h-[42px] rounded-xl text-[14px] font-semibold text-white mt-1 transition-all",
                  "bg-[#2E5E99] hover:bg-[#254E82] shadow-sm shadow-[#2E5E99]/20",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Registrazione...' : 'Crea Account'}
              </button>
            </form>
          )}

          {!done && (
            <p className="text-center text-[12px] text-[#7BA4D0] mt-5">
              Hai già un account?{' '}
              <Link href="/login" className="text-[#2E5E99] font-semibold hover:text-[#0D2440] transition-colors">
                Accedi
              </Link>
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-[11px] text-[#7BA4D0]/70 text-center">
        © {new Date().getFullYear()} Soccorso Digitale S.r.l. — Verona, Italia
      </p>
    </div>
  )
}
