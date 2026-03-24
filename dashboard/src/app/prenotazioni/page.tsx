"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import {
  CalendarClock, Plus, Search, Copy, ExternalLink, ToggleLeft, ToggleRight,
  CheckCircle2, Clock, AlertCircle, XCircle, Building2, Phone,
  Star, Calendar, MapPin, Users, TrendingUp, MoreHorizontal, Link2
} from "lucide-react"
import {
  mockBookings, mockStructures, mockSpecialEvents, mockPrivateRequests,
  bookingKpis, privateServiceConfig,
  type BookingStatus, type BookingType
} from "@/lib/mock-bookings"

// ─── shared ──────────────────────────────────────────────────────────────────

const inputCls = "h-8 px-2.5 rounded-[8px] border border-[#2E5E99]/15 bg-white/60 text-[12px] text-[#0D2440] placeholder:text-[#7BA4D0]/50 focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30"

const TABS = ["Prenotazioni", "Servizi Privati", "Strutture Richiedenti", "Servizi Speciali"] as const
type Tab = (typeof TABS)[number]

// ─── KPI bar ─────────────────────────────────────────────────────────────────

function BookingKpis() {
  const kpis = [
    { label: "Prenotazioni Oggi", value: bookingKpis.oggi, icon: CalendarClock, color: "#2E5E99" },
    { label: "In Attesa Conferma", value: bookingKpis.inAttesa, icon: Clock, color: "#F59E0B" },
    { label: "Confermate", value: bookingKpis.confermate, icon: CheckCircle2, color: "#10B981" },
    { label: "Revenue Mese", value: `€${bookingKpis.revenueMese.toLocaleString("it-IT")}`, icon: TrendingUp, color: "#2E5E99" },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {kpis.map(k => (
        <div key={k.label} className="relative overflow-hidden rounded-[12px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-3.5">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-35" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-1.5">{k.label}</p>
              <span className="text-[22px] font-light tracking-tight text-[#0D2440] leading-none">{k.value}</span>
            </div>
            <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: `${k.color}12` }}>
              <k.icon size={13} style={{ color: k.color }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<BookingStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  nuova:      { label: "Nuova",      cls: "bg-amber-500/10 text-amber-700",   Icon: AlertCircle },
  confermata: { label: "Confermata", cls: "bg-[#2E5E99]/10 text-[#2E5E99]",   Icon: CheckCircle2 },
  assegnata:  { label: "Assegnata",  cls: "bg-purple-500/10 text-purple-700", Icon: Users },
  completata: { label: "Completata", cls: "bg-emerald-500/10 text-emerald-700", Icon: CheckCircle2 },
  annullata:  { label: "Annullata",  cls: "bg-gray-400/10 text-gray-500",     Icon: XCircle },
}

const TYPE_LABELS: Record<BookingType, string> = {
  dialisi: "Dialisi", visita: "Visita", trasferimento: "Trasferimento",
  dimissione: "Dimissione", privato: "Privato",
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, cls, Icon } = STATUS_CFG[status]
  return (
    <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium w-fit", cls)}>
      <Icon size={9} /> {label}
    </span>
  )
}

// ─── Tab 1: Prenotazioni ─────────────────────────────────────────────────────

function TabPrenotazioni() {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("Tutti")

  const filtered = mockBookings.filter(b => {
    const matchSearch = b.patient.toLowerCase().includes(search.toLowerCase()) || b.structure.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "Tutti" || STATUS_CFG[b.status].label === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-3">
      <BookingKpis />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7BA4D0]" />
          <input className="w-full h-8 pl-8 pr-3 rounded-[8px] border border-white/60 bg-white/55 backdrop-blur-xl text-[12px] text-[#0D2440] placeholder:text-[#7BA4D0]/60 focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30" placeholder="Cerca paziente o struttura..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 px-2.5 rounded-[8px] border border-white/60 bg-white/55 text-[12px] text-[#0D2440] focus:outline-none cursor-pointer">
          {["Tutti", "Nuova", "Confermata", "Assegnata", "Completata", "Annullata"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#2E5E99]/[0.08]">
                {["Data", "Ora", "Paziente", "Struttura", "Tipo", "Veicolo", "Stato", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <tr key={b.id} className={cn("border-b border-[#2E5E99]/[0.05] hover:bg-[#2E5E99]/[0.02]", i % 2 === 0 && "bg-white/20")}>
                  <td className="px-3 py-2 font-medium text-[#0D2440] whitespace-nowrap">{b.date}</td>
                  <td className="px-3 py-2 text-[#0D2440]">{b.time}</td>
                  <td className="px-3 py-2 font-medium text-[#0D2440]">{b.patient}</td>
                  <td className="px-3 py-2 text-[#0D2440]/70 max-w-[160px] truncate">{b.structure}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#2E5E99]/8 text-[#2E5E99] text-[10px] font-medium">{TYPE_LABELS[b.type]}</span>
                  </td>
                  <td className="px-3 py-2 text-[#7BA4D0]">{b.vehicle ?? "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                  <td className="px-3 py-2">
                    <button className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#2E5E99]/10 transition-colors cursor-pointer">
                      <MoreHorizontal size={13} className="text-[#7BA4D0]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: Servizi Privati ───────────────────────────────────────────────────

function TabPrivati() {
  const cfg = privateServiceConfig
  const [active, setActive] = React.useState(cfg.active)
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(cfg.shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Richieste Mese", value: cfg.requestsMonth, icon: CalendarClock },
          { label: "Revenue Mese", value: `€${cfg.revenueMonth.toLocaleString("it-IT")}`, icon: TrendingUp },
          { label: "Tasso Conversione", value: `${cfg.conversionRate}%`, icon: CheckCircle2 },
        ].map(k => (
          <div key={k.label} className="relative overflow-hidden rounded-[12px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-3.5">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-35" />
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-1.5">{k.label}</p>
                <span className="text-[22px] font-light tracking-tight text-[#0D2440] leading-none">{k.value}</span>
              </div>
              <div className="w-7 h-7 rounded-[8px] bg-[#2E5E99]/[0.07] flex items-center justify-center shrink-0">
                <k.icon size={13} className="text-[#2E5E99]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Config panel */}
        <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-[#0D2440]">Pagina Pubblica Prenotazioni</h3>
            <button
              onClick={() => setActive(a => !a)}
              className={cn("flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold transition-colors cursor-pointer",
                active ? "bg-emerald-500/10 text-emerald-700" : "bg-gray-400/10 text-gray-500"
              )}
            >
              {active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {active ? "Attiva" : "Disattiva"}
            </button>
          </div>

          {/* URL share */}
          <div className="mb-3">
            <label className="text-[9px] font-bold uppercase tracking-wider text-[#7BA4D0] mb-1 block">Link condivisibile</label>
            <div className="flex gap-1.5">
              <div className="flex-1 flex items-center h-8 px-2.5 rounded-[8px] border border-[#2E5E99]/15 bg-white/60 text-[11px] text-[#0D2440] font-mono overflow-hidden">
                <Link2 size={11} className="text-[#7BA4D0] shrink-0 mr-1.5" />
                <span className="truncate">{cfg.shareUrl}</span>
              </div>
              <button onClick={handleCopy} className="h-8 px-3 rounded-[8px] bg-[#2E5E99] text-white text-[11px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer flex items-center gap-1">
                <Copy size={11} />
                {copied ? "Copiato!" : "Copia"}
              </button>
              <button className="h-8 w-8 flex items-center justify-center rounded-[8px] border border-[#2E5E99]/20 hover:bg-[#2E5E99]/5 transition-colors cursor-pointer">
                <ExternalLink size={12} className="text-[#7BA4D0]" />
              </button>
            </div>
          </div>

          {/* Services & config */}
          <div className="space-y-2">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-[#7BA4D0] mb-1 block">Servizi disponibili</label>
              <div className="flex flex-wrap gap-1">
                {cfg.services.map(s => (
                  <span key={s} className="px-2 py-0.5 rounded-full bg-[#2E5E99]/8 text-[#2E5E99] text-[10px] font-medium">{s}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#7BA4D0] mb-1 block">Prezzo da</label>
                <input className={inputCls} defaultValue={`€${cfg.priceFrom}`} />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#7BA4D0] mb-1 block">Apertura</label>
                <input className={inputCls} defaultValue={cfg.hoursFrom} />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-[#7BA4D0] mb-1 block">Chiusura</label>
                <input className={inputCls} defaultValue={cfg.hoursTo} />
              </div>
            </div>
          </div>
        </div>

        {/* Public page preview */}
        <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-3">Preview Pagina Pubblica</h3>
          <div className="rounded-[10px] border-2 border-[#2E5E99]/10 bg-white/70 p-3 text-[11px] space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div>
                <p className="font-bold text-[#0D2440] text-[12px]">Croce Europa Legnago</p>
                <p className="text-[9px] text-[#7BA4D0]">Servizio Trasporto Sanitario Privato</p>
              </div>
            </div>
            {[
              { label: "Tipo servizio", placeholder: "Trasporto medico" },
              { label: "Data", placeholder: "gg / mm / aaaa" },
              { label: "Orario", placeholder: "hh : mm" },
              { label: "Partenza", placeholder: "Indirizzo di partenza" },
              { label: "Destinazione", placeholder: "Indirizzo di destinazione" },
              { label: "Paziente", placeholder: "Nome paziente" },
              { label: "Telefono", placeholder: "+39 345 000 0000" },
            ].map(f => (
              <div key={f.label}>
                <p className="text-[8px] font-bold text-[#7BA4D0] mb-0.5">{f.label}</p>
                <div className="h-6 px-2 rounded-md border border-gray-200 bg-white/80 flex items-center text-[10px] text-gray-400">{f.placeholder}</div>
              </div>
            ))}
            <button className="w-full h-7 mt-1 rounded-md bg-[#2E5E99] text-white text-[11px] font-semibold">Richiedi Trasporto</button>
            <p className="text-[9px] text-center text-[#7BA4D0]">Prezzi a partire da €{cfg.priceFrom}</p>
          </div>
        </div>
      </div>

      {/* Requests list */}
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">Richieste Ricevute</h3>
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#2E5E99]/[0.08]">
              {["Data", "Paziente", "Tratta", "Tipo", "Telefono", "Prezzo", "Stato"].map(h => (
                <th key={h} className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockPrivateRequests.map((r, i) => (
              <tr key={r.id} className={cn("border-b border-[#2E5E99]/[0.05]", i % 2 === 0 && "bg-white/20")}>
                <td className="px-4 py-2 text-[#0D2440]">{r.date}</td>
                <td className="px-4 py-2 font-medium text-[#0D2440]">{r.patient}</td>
                <td className="px-4 py-2 text-[#0D2440]/70 text-[11px]">{r.from} → {r.to}</td>
                <td className="px-4 py-2 text-[#0D2440]/70">{r.type}</td>
                <td className="px-4 py-2 text-[#0D2440]/60">{r.phone}</td>
                <td className="px-4 py-2 font-semibold text-[#2E5E99]">{r.price ? `€${r.price}` : "—"}</td>
                <td className="px-4 py-2">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
                    r.status === "completata" ? "bg-emerald-500/10 text-emerald-700" :
                    r.status === "confermata" ? "bg-[#2E5E99]/10 text-[#2E5E99]" :
                    "bg-amber-500/10 text-amber-700"
                  )}>
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab 3: Strutture Richiedenti ────────────────────────────────────────────

const STRUCTURE_TYPE_LABELS = { ospedale: "Ospedale", rsa: "RSA", clinica: "Clinica", privato: "Privato" }
const STRUCTURE_TYPE_COLORS = {
  ospedale: "bg-red-500/10 text-red-700",
  rsa: "bg-amber-500/10 text-amber-700",
  clinica: "bg-[#2E5E99]/10 text-[#2E5E99]",
  privato: "bg-purple-500/10 text-purple-700",
}

function TabStrutture() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[#7BA4D0]">{mockStructures.length} strutture registrate</p>
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#2E5E99] text-white text-[12px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer">
          <Plus size={12} /> Aggiungi Struttura
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {mockStructures.map(s => (
          <div key={s.id} className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4 hover:bg-white/65 transition-colors cursor-pointer">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[10px] bg-[#2E5E99]/[0.08] flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-[#2E5E99]" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#0D2440] leading-tight">{s.name}</p>
                  <span className={cn("inline-block px-2 py-0.5 rounded-full text-[9px] font-bold mt-0.5", STRUCTURE_TYPE_COLORS[s.type])}>
                    {STRUCTURE_TYPE_LABELS[s.type]}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[18px] font-light text-[#2E5E99] leading-none">{s.servicesThisMonth}</p>
                <p className="text-[9px] text-[#7BA4D0]">servizi/mese</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] text-[#0D2440]/60">
                <MapPin size={10} className="text-[#7BA4D0] shrink-0" /> {s.address}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#0D2440]/60">
                <Users size={10} className="text-[#7BA4D0] shrink-0" /> {s.referente}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[#0D2440]/60">
                <Phone size={10} className="text-[#7BA4D0] shrink-0" /> {s.phone}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab 4: Servizi Speciali ─────────────────────────────────────────────────

const EVENT_STATUS_CFG = {
  pianificato: { cls: "bg-amber-500/10 text-amber-700", label: "Pianificato" },
  confermato:  { cls: "bg-[#2E5E99]/10 text-[#2E5E99]", label: "Confermato" },
  completato:  { cls: "bg-emerald-500/10 text-emerald-700", label: "Completato" },
}

function TabEventi() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[#7BA4D0]">{mockSpecialEvents.length} eventi registrati</p>
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#2E5E99] text-white text-[12px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer">
          <Plus size={12} /> Nuovo Evento
        </button>
      </div>
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#2E5E99]/[0.08]">
              {["Data", "Evento", "Luogo", "Assistenza", "Veicoli", "Personale", "Stato"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockSpecialEvents.map((e, i) => (
              <tr key={e.id} className={cn("border-b border-[#2E5E99]/[0.05] hover:bg-[#2E5E99]/[0.02]", i % 2 === 0 && "bg-white/20")}>
                <td className="px-4 py-2.5 font-medium text-[#0D2440] whitespace-nowrap">{e.date}</td>
                <td className="px-4 py-2.5 font-semibold text-[#0D2440]">{e.event}</td>
                <td className="px-4 py-2.5 text-[#0D2440]/70 max-w-[140px] truncate">{e.location}</td>
                <td className="px-4 py-2.5 text-[#0D2440]/70">{e.assistanceType}</td>
                <td className="px-4 py-2.5 text-center font-medium text-[#0D2440]">{e.vehicles}</td>
                <td className="px-4 py-2.5 text-center font-medium text-[#0D2440]">{e.staff}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", EVENT_STATUS_CFG[e.status].cls)}>
                    {EVENT_STATUS_CFG[e.status].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrenotazioniPage() {
  const [activeTab, setActiveTab] = React.useState<Tab>("Prenotazioni")

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[#0D2440] leading-tight">Hub Prenotazioni</h1>
          <p className="text-[12px] text-[#7BA4D0] mt-0.5">Prenotazioni, servizi privati, strutture e eventi speciali</p>
        </div>
        <button className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-[#2E5E99] text-white text-[13px] font-semibold hover:bg-[#254E82] transition-colors shadow-sm shadow-[#2E5E99]/20 cursor-pointer">
          <Plus size={14} /> Nuova Prenotazione
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-[12px] bg-white/40 backdrop-blur-xl border border-white/50 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 min-w-fit px-3 py-1.5 rounded-[9px] text-[12px] font-medium whitespace-nowrap transition-all cursor-pointer",
              activeTab === tab ? "bg-white/80 text-[#2E5E99] shadow-sm" : "text-[#0D2440]/55 hover:text-[#0D2440] hover:bg-white/30"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Prenotazioni" && <TabPrenotazioni />}
      {activeTab === "Servizi Privati" && <TabPrivati />}
      {activeTab === "Strutture Richiedenti" && <TabStrutture />}
      {activeTab === "Servizi Speciali" && <TabEventi />}
    </div>
  )
}
