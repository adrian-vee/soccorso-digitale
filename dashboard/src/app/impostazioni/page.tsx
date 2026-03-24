"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import {
  User, Building2, Users, Bell, CreditCard, Plug,
  Save, Plus, Trash2, Copy, RefreshCw, Shield, Eye, EyeOff
} from "lucide-react"
import { mockOrgSettings, mockUsers, type UserRole } from "@/lib/mock-settings"

const TABS = [
  { id: "profilo", label: "Profilo", icon: User },
  { id: "organizzazione", label: "Organizzazione", icon: Building2 },
  { id: "utenti", label: "Utenti", icon: Users },
  { id: "notifiche", label: "Notifiche", icon: Bell },
  { id: "piano", label: "Piano", icon: CreditCard },
  { id: "integrazioni", label: "Integrazioni", icon: Plug },
] as const

type TabId = (typeof TABS)[number]["id"]

const inputCls = "w-full h-8 px-2.5 rounded-[8px] border border-[#2E5E99]/15 bg-white/60 text-[12px] text-[#0D2440] placeholder:text-[#7BA4D0]/50 focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30"

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7BA4D0]">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-2">
      <span className="text-[13px] text-[#0D2440]">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors",
          checked ? "bg-[#2E5E99]" : "bg-[#7BA4D0]/30"
        )}
      >
        <span className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all",
          checked ? "left-4" : "left-0.5"
        )} />
      </button>
    </label>
  )
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  coordinatore: "Coordinatore",
  operatore: "Operatore",
  viewer: "Viewer",
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-purple-500/10 text-purple-700",
  coordinatore: "bg-[#2E5E99]/10 text-[#2E5E99]",
  operatore: "bg-emerald-500/10 text-emerald-700",
  viewer: "bg-gray-400/10 text-gray-500",
}

// --- Tab components ---

function TabProfilo() {
  const [showPwd, setShowPwd] = React.useState(false)
  const [twoFA, setTwoFA] = React.useState(false)
  return (
    <div className="space-y-4">
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <h3 className="text-[13px] font-bold text-[#0D2440] mb-4">Dati Personali</h3>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] flex items-center justify-center text-white text-2xl font-bold shadow">A</div>
          <div>
            <p className="text-[12px] font-semibold text-[#0D2440]">Admin</p>
            <p className="text-[11px] text-[#7BA4D0]">admin@org.it</p>
            <button className="mt-1 text-[11px] text-[#2E5E99] hover:underline cursor-pointer">Carica foto</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome"><input className={inputCls} defaultValue="Marco" /></Field>
          <Field label="Cognome"><input className={inputCls} defaultValue="Admin" /></Field>
          <Field label="Email" className="col-span-2"><input className={inputCls} defaultValue="admin@croceeuropa.it" type="email" /></Field>
          <Field label="Telefono"><input className={inputCls} defaultValue="+39 345 0000000" /></Field>
        </div>
      </div>

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <h3 className="text-[13px] font-bold text-[#0D2440] mb-4">Sicurezza</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Password Attuale">
            <div className="relative">
              <input className={inputCls} type={showPwd ? "text" : "password"} placeholder="••••••••" />
              <button onClick={() => setShowPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer">
                {showPwd ? <EyeOff size={12} className="text-[#7BA4D0]" /> : <Eye size={12} className="text-[#7BA4D0]" />}
              </button>
            </div>
          </Field>
          <Field label="Nuova Password"><input className={inputCls} type="password" placeholder="••••••••" /></Field>
        </div>
        <div className="border-t border-[#2E5E99]/[0.08] pt-3">
          <Toggle checked={twoFA} onChange={() => setTwoFA(t => !t)} label="Autenticazione a due fattori (2FA)" />
        </div>
      </div>

      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-[#2E5E99] text-white text-[13px] font-semibold hover:bg-[#254E82] transition-colors shadow-sm shadow-[#2E5E99]/20 cursor-pointer">
          <Save size={13} /> Salva Modifiche
        </button>
      </div>
    </div>
  )
}

function TabOrganizzazione() {
  const org = mockOrgSettings
  return (
    <div className="space-y-4">
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <h3 className="text-[13px] font-bold text-[#0D2440] mb-4">Dati Organizzazione</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome Organizzazione"><input className={inputCls} defaultValue={org.name} /></Field>
          <Field label="Nome Legale"><input className={inputCls} defaultValue={org.legalName} /></Field>
          <Field label="P.IVA / C.F."><input className={inputCls} defaultValue={org.piva} /></Field>
          <Field label="Telefono"><input className={inputCls} defaultValue={org.phone} /></Field>
          <Field label="Email" className="col-span-2"><input className={inputCls} defaultValue={org.email} /></Field>
          <Field label="Indirizzo" className="col-span-2"><input className={inputCls} defaultValue={org.address} /></Field>
        </div>
      </div>
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <h3 className="text-[13px] font-bold text-[#0D2440] mb-3">Sedi Operative</h3>
        <div className="space-y-1.5">
          {org.sedi.map(s => (
            <div key={s} className="flex items-center gap-2">
              <input className={cn(inputCls, "flex-1")} defaultValue={s} />
              <button className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-red-500/10 transition-colors cursor-pointer">
                <Trash2 size={12} className="text-red-400" />
              </button>
            </div>
          ))}
          <button className="flex items-center gap-1.5 text-[12px] text-[#2E5E99] hover:underline cursor-pointer mt-1">
            <Plus size={12} /> Aggiungi sede
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-[#2E5E99] text-white text-[13px] font-semibold hover:bg-[#254E82] transition-colors shadow-sm cursor-pointer">
          <Save size={13} /> Salva
        </button>
      </div>
    </div>
  )
}

function TabUtenti() {
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const users = mockUsers
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[#7BA4D0]">{users.filter(u => u.active).length} utenti attivi · {users.length} totali</p>
        <button
          onClick={() => setInviteOpen(t => !t)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#2E5E99] text-white text-[12px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer"
        >
          <Plus size={12} /> Invita Utente
        </button>
      </div>

      {inviteOpen && (
        <div className="rounded-[14px] bg-white/60 backdrop-blur-xl border border-[#2E5E99]/15 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Email" className="col-span-2"><input className={inputCls} placeholder="nome@org.it" /></Field>
            <Field label="Ruolo">
              <select className={inputCls}>
                <option>Operatore</option>
                <option>Coordinatore</option>
                <option>Viewer</option>
                <option>Admin</option>
              </select>
            </Field>
          </div>
          <button className="mt-3 h-8 px-4 rounded-[8px] bg-[#2E5E99] text-white text-[12px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer">
            Invia Invito
          </button>
        </div>
      )}

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#2E5E99]/[0.08]">
              {["Utente", "Ruolo", "Ultimo Accesso", "Stato", ""].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className={cn("border-b border-[#2E5E99]/[0.05]", i % 2 === 0 && "bg-white/20")}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                      {u.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-medium text-[#0D2440]">{u.name}</p>
                      <p className="text-[10px] text-[#7BA4D0]">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", ROLE_COLORS[u.role])}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[#0D2440]/60">{u.lastLogin}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
                    u.active ? "bg-emerald-500/10 text-emerald-700" : "bg-gray-400/10 text-gray-500"
                  )}>
                    {u.active ? "Attivo" : "Inattivo"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <button className="text-[11px] text-[#7BA4D0] hover:text-red-500 transition-colors cursor-pointer">
                    {u.active ? "Disattiva" : "Attiva"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TabNotifiche() {
  const [state, setState] = React.useState({
    emailCert: true, emailReport: true, emailTurni: false,
    pushAlert: true, pushNuovoServizio: true,
    freqReport: "settimanale",
    alertCert30: true, alertCert90: false,
  })
  const set = (k: string, v: boolean | string) => setState(s => ({ ...s, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <h3 className="text-[13px] font-bold text-[#0D2440] mb-1">Notifiche Email</h3>
        <div className="divide-y divide-[#2E5E99]/[0.07]">
          <Toggle checked={state.emailCert} onChange={() => set("emailCert", !state.emailCert)} label="Scadenze certificazioni" />
          <Toggle checked={state.emailReport} onChange={() => set("emailReport", !state.emailReport)} label="Report periodici" />
          <Toggle checked={state.emailTurni} onChange={() => set("emailTurni", !state.emailTurni)} label="Pubblicazione turni" />
        </div>
      </div>

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <h3 className="text-[13px] font-bold text-[#0D2440] mb-1">Notifiche Push</h3>
        <div className="divide-y divide-[#2E5E99]/[0.07]">
          <Toggle checked={state.pushAlert} onChange={() => set("pushAlert", !state.pushAlert)} label="Alert urgenti" />
          <Toggle checked={state.pushNuovoServizio} onChange={() => set("pushNuovoServizio", !state.pushNuovoServizio)} label="Nuovo servizio assegnato" />
        </div>
      </div>

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <h3 className="text-[13px] font-bold text-[#0D2440] mb-3">Frequenza Report</h3>
        <div className="flex gap-2">
          {["giornaliero", "settimanale", "mensile"].map(f => (
            <button
              key={f}
              onClick={() => set("freqReport", f)}
              className={cn(
                "flex-1 h-8 rounded-[8px] text-[12px] font-medium transition-colors cursor-pointer capitalize",
                state.freqReport === f
                  ? "bg-[#2E5E99] text-white"
                  : "border border-[#2E5E99]/20 text-[#0D2440] hover:bg-[#2E5E99]/5"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <h3 className="text-[13px] font-bold text-[#0D2440] mb-1">Alert Scadenze</h3>
        <div className="divide-y divide-[#2E5E99]/[0.07]">
          <Toggle checked={state.alertCert30} onChange={() => set("alertCert30", !state.alertCert30)} label="Avviso 30 giorni prima della scadenza" />
          <Toggle checked={state.alertCert90} onChange={() => set("alertCert90", !state.alertCert90)} label="Avviso 90 giorni prima della scadenza" />
        </div>
      </div>
    </div>
  )
}

function TabPiano() {
  const org = mockOrgSettings
  const vehPct = Math.round((org.vehiclesCount / org.vehiclesMax) * 100)
  const userPct = Math.round((org.usersCount / org.usersMax) * 100)

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-bold text-[#0D2440]">Piano Attuale</h3>
            <span className="inline-block mt-1 px-3 py-0.5 rounded-full bg-[#2E5E99]/10 text-[#2E5E99] text-[11px] font-bold uppercase tracking-wider">
              Professional
            </span>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-light text-[#0D2440]">€49<span className="text-[13px] text-[#7BA4D0]">/mese</span></p>
            <p className="text-[11px] text-[#7BA4D0]">Fatturazione mensile</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-[12px] mb-1">
              <span className="text-[#0D2440]">Veicoli</span>
              <span className="text-[#7BA4D0]">{org.vehiclesCount} / {org.vehiclesMax}</span>
            </div>
            <div className="h-2 rounded-full bg-[#2E5E99]/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0]" style={{ width: `${vehPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[12px] mb-1">
              <span className="text-[#0D2440]">Utenti</span>
              <span className="text-[#7BA4D0]">{org.usersCount} / {org.usersMax}</span>
            </div>
            <div className="h-2 rounded-full bg-[#2E5E99]/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0]" style={{ width: `${userPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { name: "Starter", price: "€19", features: ["5 veicoli", "5 utenti", "Report base"] },
          { name: "Professional", price: "€49", features: ["15 veicoli", "15 utenti", "Analytics avanzati"], current: true },
          { name: "Enterprise", price: "Custom", features: ["Illimitato", "SLA dedicato", "Integrazioni custom"] },
        ].map(plan => (
          <div key={plan.name} className={cn(
            "rounded-[12px] p-4 border",
            plan.current ? "bg-[#2E5E99]/5 border-[#2E5E99]/30" : "bg-white/40 border-white/50"
          )}>
            <p className="text-[13px] font-bold text-[#0D2440]">{plan.name}</p>
            <p className="text-[18px] font-light text-[#2E5E99] my-1">{plan.price}<span className="text-[10px] text-[#7BA4D0]">/mese</span></p>
            <ul className="space-y-0.5 mb-3">
              {plan.features.map(f => <li key={f} className="text-[11px] text-[#0D2440]/70">• {f}</li>)}
            </ul>
            <button className={cn(
              "w-full h-7 rounded-[7px] text-[11px] font-medium transition-colors cursor-pointer",
              plan.current
                ? "bg-[#2E5E99] text-white"
                : "border border-[#2E5E99]/20 text-[#2E5E99] hover:bg-[#2E5E99]/5"
            )}>
              {plan.current ? "Piano Attuale" : "Seleziona"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabIntegrazioni() {
  const [apiVisible, setApiVisible] = React.useState(false)
  const apiKey = "sd_live_k4x9mN2pQr7vWzA1bCdEfGhIjKlMnOpQr"

  const integrations = [
    { name: "Supabase", desc: "Database e autenticazione", active: true, color: "#3ECF8E" },
    { name: "Brevo", desc: "Email transazionali e notifiche", active: true, color: "#0B5CAD" },
    { name: "ULSS 9 Scaligera", desc: "Integrazione ASL per ordini di servizio", active: false, color: "#CC0000" },
    { name: "Webhook Events", desc: "Notifiche eventi in tempo reale", active: false, color: "#7BA4D0" },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[13px] font-bold text-[#0D2440]">API Key</h3>
            <p className="text-[11px] text-[#7BA4D0]">Usa questa chiave per autenticare le chiamate API esterne</p>
          </div>
          <Shield size={18} className="text-[#2E5E99]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-8 px-2.5 rounded-[8px] border border-[#2E5E99]/15 bg-white/60 text-[11px] text-[#0D2440] font-mono flex items-center overflow-hidden">
            {apiVisible ? apiKey : apiKey.slice(0, 12) + "•".repeat(24)}
          </div>
          <button onClick={() => setApiVisible(v => !v)} className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-[#2E5E99]/15 hover:bg-[#2E5E99]/5 transition-colors cursor-pointer">
            {apiVisible ? <EyeOff size={13} className="text-[#7BA4D0]" /> : <Eye size={13} className="text-[#7BA4D0]" />}
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-[#2E5E99]/15 hover:bg-[#2E5E99]/5 transition-colors cursor-pointer">
            <Copy size={13} className="text-[#7BA4D0]" />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-[#2E5E99]/15 hover:bg-red-500/10 transition-colors cursor-pointer">
            <RefreshCw size={13} className="text-red-400" />
          </button>
        </div>
      </div>

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <h3 className="text-[13px] font-bold text-[#0D2440] mb-3">Integrazioni</h3>
        <div className="space-y-2">
          {integrations.map(intg => (
            <div key={intg.name} className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] border border-[#2E5E99]/[0.07] hover:bg-white/30 transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-[10px] font-bold" style={{ background: intg.color }}>
                {intg.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#0D2440]">{intg.name}</p>
                <p className="text-[11px] text-[#7BA4D0]">{intg.desc}</p>
              </div>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium",
                intg.active ? "bg-emerald-500/10 text-emerald-700" : "bg-gray-400/10 text-gray-500"
              )}>
                {intg.active ? "Attivo" : "Inattivo"}
              </span>
              <button className={cn(
                "h-7 px-3 rounded-[7px] text-[11px] font-medium transition-colors cursor-pointer",
                intg.active
                  ? "border border-red-200 text-red-500 hover:bg-red-50"
                  : "bg-[#2E5E99] text-white hover:bg-[#254E82]"
              )}>
                {intg.active ? "Disconnetti" : "Connetti"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-5">
        <h3 className="text-[13px] font-bold text-[#0D2440] mb-2">Webhook URL</h3>
        <p className="text-[11px] text-[#7BA4D0] mb-2">Ricevi notifiche HTTP per ogni evento (nuovo servizio, aggiornamento turno, ecc.)</p>
        <div className="flex gap-2">
          <input className={cn(inputCls, "flex-1")} placeholder="https://tuo-sistema.it/webhook" />
          <button className="h-8 px-4 rounded-[8px] bg-[#2E5E99] text-white text-[12px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer">Salva</button>
        </div>
      </div>
    </div>
  )
}

// --- Main page ---
export default function ImpostazioniPage() {
  const [activeTab, setActiveTab] = React.useState<TabId>("profilo")

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-[18px] font-bold text-[#0D2440] leading-tight">Impostazioni</h1>
        <p className="text-[12px] text-[#7BA4D0] mt-0.5">Gestisci account, organizzazione, utenti e integrazioni</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-[12px] bg-white/40 backdrop-blur-xl border border-white/50 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12px] font-medium whitespace-nowrap transition-all cursor-pointer",
              activeTab === tab.id
                ? "bg-white/80 text-[#2E5E99] shadow-sm"
                : "text-[#0D2440]/55 hover:text-[#0D2440] hover:bg-white/30"
            )}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "profilo" && <TabProfilo />}
      {activeTab === "organizzazione" && <TabOrganizzazione />}
      {activeTab === "utenti" && <TabUtenti />}
      {activeTab === "notifiche" && <TabNotifiche />}
      {activeTab === "piano" && <TabPiano />}
      {activeTab === "integrazioni" && <TabIntegrazioni />}
    </div>
  )
}
