"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import {
  FileText, Plus, Search, Download, Upload, CheckCircle2, XCircle,
  AlertTriangle, Camera, MapPin, Clock, Truck, MoreHorizontal,
  FileDown
} from "lucide-react"
import {
  mockDeliveries, mockDamageReports, mockChecklists,
  mockTripNotes, mockDocuments
} from "@/lib/mock-documents"

// ─── shared ───────────────────────────────────────────────────────────────────

const TABS = ["Consegne Digitali", "Rapporto Danni", "Checklist Veicoli", "Note di Viaggio", "Documenti"] as const
type Tab = (typeof TABS)[number]

// ─── Tab 1: Consegne Digitali ─────────────────────────────────────────────────

function TabConsegne() {
  const total = mockDeliveries.length
  const withPdf = mockDeliveries.filter(d => d.hasPdf).length
  const missing = total - withPdf

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Firme Oggi", value: mockDeliveries.filter(d => d.date === "24/03/2026").length },
          { label: "% Con Firma", value: `${Math.round(withPdf / total * 100)}%` },
          { label: "Firme Mancanti", value: missing },
        ].map(k => (
          <div key={k.label} className="relative overflow-hidden rounded-[12px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-3.5">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-35" />
            <p className="text-[8px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-1.5">{k.label}</p>
            <span className="text-[22px] font-light text-[#0D2440] leading-none">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#2E5E99]/[0.08]">
                {["Data", "Servizio", "Paziente", "Firmato da", "Orario", "Veicolo", "GPS", "PDF"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockDeliveries.map((d, i) => (
                <tr key={d.id} className={cn("border-b border-[#2E5E99]/[0.05] hover:bg-[#2E5E99]/[0.02]", i % 2 === 0 && "bg-white/20")}>
                  <td className="px-3 py-2 text-[#0D2440]">{d.date}</td>
                  <td className="px-3 py-2 text-[#7BA4D0] font-mono text-[10px]">{d.serviceId}</td>
                  <td className="px-3 py-2 font-medium text-[#0D2440]">{d.patient}</td>
                  <td className="px-3 py-2 text-[#0D2440]/70">{d.signedBy}</td>
                  <td className="px-3 py-2 text-[#0D2440]">
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-[#7BA4D0]" />
                      {d.signTime}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[#0D2440]">{d.vehicle}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 text-[10px] text-[#7BA4D0]">
                      <MapPin size={9} />
                      {d.gps}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {d.hasPdf ? (
                      <button className="flex items-center gap-1 text-[#2E5E99] hover:underline text-[11px] cursor-pointer">
                        <FileDown size={11} /> PDF
                      </button>
                    ) : (
                      <span className="text-[11px] text-amber-600 flex items-center gap-1">
                        <AlertTriangle size={10} /> Mancante
                      </span>
                    )}
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

// ─── Tab 2: Rapporto Danni ────────────────────────────────────────────────────

const DAMAGE_STATUS = {
  aperto:        { cls: "bg-red-500/10 text-red-600", label: "Aperto" },
  in_riparazione:{ cls: "bg-amber-500/10 text-amber-700", label: "In riparazione" },
  risolto:       { cls: "bg-emerald-500/10 text-emerald-700", label: "Risolto" },
}

function TabDanni() {
  const openCount = mockDamageReports.filter(d => d.status === "aperto").length
  const totalCost = mockDamageReports.reduce((s, d) => s + (d.cost ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Danni Aperti", value: openCount },
          { label: "Costo Totale", value: `€${totalCost.toLocaleString("it-IT")}` },
          { label: "Rapporti Totali", value: mockDamageReports.length },
        ].map(k => (
          <div key={k.label} className="relative overflow-hidden rounded-[12px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-3.5">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-35" />
            <p className="text-[8px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-1.5">{k.label}</p>
            <span className="text-[22px] font-light text-[#0D2440] leading-none">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#2E5E99] text-white text-[12px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer">
          <Plus size={12} /> Nuovo Rapporto
        </button>
      </div>

      <div className="space-y-2.5">
        {mockDamageReports.map(d => {
          const st = DAMAGE_STATUS[d.status]
          return (
            <div key={d.id} className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-[10px] bg-red-500/[0.08] flex items-center justify-center shrink-0">
                    <Truck size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#0D2440]">{d.vehicle}</p>
                    <p className="text-[11px] text-[#7BA4D0]">{d.date} · {d.damageType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", st.cls)}>{st.label}</span>
                  {d.cost && <span className="text-[12px] font-semibold text-[#0D2440]">€{d.cost}</span>}
                </div>
              </div>
              <p className="mt-2 text-[12px] text-[#0D2440]/70">{d.description}</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1 text-[11px] text-[#7BA4D0]">
                  <Camera size={11} /> {d.photos} foto
                </div>
                <button className="text-[11px] text-[#2E5E99] hover:underline cursor-pointer">Visualizza foto</button>
                <button className="text-[11px] text-[#2E5E99] hover:underline cursor-pointer">Aggiorna stato</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab 3: Checklist Veicoli ────────────────────────────────────────────────

const CHECKLIST_ITEMS = ["Luci", "Gomme", "Olio", "Barella", "Ossigeno", "Defibrillatore", "Radio", "Estintore"]

function TabChecklist() {
  const anomalie = mockChecklists.filter(c => c.result === "anomalie")

  return (
    <div className="space-y-3">
      {anomalie.length > 0 && (
        <div className="rounded-[12px] bg-amber-500/[0.06] border border-amber-500/15 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={13} className="text-amber-600" />
            <span className="text-[12px] font-semibold text-amber-700">{anomalie.length} checklist con anomalie</span>
          </div>
          {anomalie.map(c => (
            <p key={c.id} className="text-[11px] text-amber-600 ml-5">• {c.vehicle} ({c.date}) — {c.notes}</p>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#2E5E99] text-white text-[12px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer">
          <Plus size={12} /> Nuova Checklist
        </button>
      </div>

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#2E5E99]/[0.08]">
                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">Data</th>
                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">Veicolo</th>
                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">Operatore</th>
                {CHECKLIST_ITEMS.map(item => (
                  <th key={item} className="px-2 py-2.5 text-center text-[9px] font-bold tracking-[0.10em] text-[#7BA4D0] whitespace-nowrap">{item}</th>
                ))}
                <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">Esito</th>
              </tr>
            </thead>
            <tbody>
              {mockChecklists.map((c, i) => (
                <tr key={c.id} className={cn("border-b border-[#2E5E99]/[0.05]", i % 2 === 0 && "bg-white/20", c.result === "anomalie" && "bg-amber-500/[0.02]")}>
                  <td className="px-3 py-2 text-[#0D2440]">{c.date}</td>
                  <td className="px-3 py-2 font-semibold text-[#0D2440]">{c.vehicle}</td>
                  <td className="px-3 py-2 text-[#0D2440]/70">{c.completedBy}</td>
                  {CHECKLIST_ITEMS.map(item => (
                    <td key={item} className="px-2 py-2 text-center">
                      {c.items[item]
                        ? <CheckCircle2 size={12} className="text-emerald-500 mx-auto" />
                        : <XCircle size={12} className="text-red-500 mx-auto" />
                      }
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
                      c.result === "ok" ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
                    )}>
                      {c.result === "ok" ? "OK" : "Anomalie"}
                    </span>
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

// ─── Tab 4: Note di Viaggio ───────────────────────────────────────────────────

function TabNoteViaggio() {
  const unsigned = mockTripNotes.filter(n => !n.signed)

  return (
    <div className="space-y-3">
      {unsigned.length > 0 && (
        <div className="rounded-[12px] bg-amber-500/[0.06] border border-amber-500/15 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-600" />
            <span className="text-[12px] font-semibold text-amber-700">{unsigned.length} note non firmate</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <select className="h-8 px-2.5 rounded-[8px] border border-white/60 bg-white/55 text-[12px] text-[#0D2440] focus:outline-none cursor-pointer">
            {["Tutti i veicoli", "J54", "J55", "J56", "J57", "J58"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#2E5E99]/20 bg-white/55 text-[12px] text-[#0D2440] hover:bg-white/70 transition-colors cursor-pointer">
          <Download size={12} className="text-[#7BA4D0]" /> Export UTIF
        </button>
      </div>

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#2E5E99]/[0.08]">
              {["Data", "Servizio", "Veicolo", "KM Partenza", "KM Arrivo", "KM Totali", "Autista", "Firma"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockTripNotes.map((n, i) => (
              <tr key={n.id} className={cn("border-b border-[#2E5E99]/[0.05]", i % 2 === 0 && "bg-white/20")}>
                <td className="px-3 py-2 text-[#0D2440]">{n.date}</td>
                <td className="px-3 py-2 text-[#7BA4D0] font-mono text-[10px]">{n.serviceId}</td>
                <td className="px-3 py-2 font-medium text-[#0D2440]">{n.vehicle}</td>
                <td className="px-3 py-2 text-[#0D2440]/70">{n.kmStart.toLocaleString("it-IT")}</td>
                <td className="px-3 py-2 text-[#0D2440]/70">{n.kmEnd.toLocaleString("it-IT")}</td>
                <td className="px-3 py-2 font-semibold text-[#2E5E99]">{(n.kmEnd - n.kmStart)} km</td>
                <td className="px-3 py-2 text-[#0D2440]/70">{n.driver}</td>
                <td className="px-3 py-2">
                  {n.signed
                    ? <CheckCircle2 size={13} className="text-emerald-500" />
                    : <AlertTriangle size={13} className="text-amber-500" />
                  }
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#2E5E99]/15 bg-[#2E5E99]/[0.03]">
              <td colSpan={5} className="px-3 py-2 text-[11px] font-bold text-[#0D2440]">KM Totali Periodo</td>
              <td className="px-3 py-2 font-bold text-[#2E5E99]">
                {mockTripNotes.reduce((s, n) => s + (n.kmEnd - n.kmStart), 0)} km
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Tab 5: Documenti Generali ────────────────────────────────────────────────

const DOC_CAT_COLORS = {
  contratto: "bg-[#2E5E99]/10 text-[#2E5E99]",
  polizza: "bg-emerald-500/10 text-emerald-700",
  certificato: "bg-purple-500/10 text-purple-700",
  manuale: "bg-amber-500/10 text-amber-700",
  altro: "bg-gray-400/10 text-gray-500",
}

function TabDocumenti() {
  const [search, setSearch] = React.useState("")
  const filtered = mockDocuments.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7BA4D0]" />
          <input className="w-full h-8 pl-8 pr-3 rounded-[8px] border border-white/60 bg-white/55 backdrop-blur-xl text-[12px] text-[#0D2440] placeholder:text-[#7BA4D0]/60 focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30" placeholder="Cerca documento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#2E5E99] text-white text-[12px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer">
          <Upload size={12} /> Carica Documento
        </button>
      </div>

      <div className="space-y-2">
        {filtered.map(doc => (
          <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.04)] hover:bg-white/65 transition-colors">
            <div className="w-9 h-9 rounded-[10px] bg-[#2E5E99]/[0.07] flex items-center justify-center shrink-0">
              <FileText size={16} className="text-[#2E5E99]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#0D2440] truncate">{doc.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize", DOC_CAT_COLORS[doc.category])}>
                  {doc.category}
                </span>
                <span className="text-[10px] text-[#7BA4D0]">{doc.size}</span>
                <span className="text-[10px] text-[#7BA4D0]">Caricato {doc.uploadDate}</span>
              </div>
            </div>
            {doc.expiry && (
              <div className="text-right shrink-0">
                <p className={cn("text-[11px] font-medium",
                  doc.daysToExpiry !== undefined && doc.daysToExpiry < 90 ? "text-amber-600" : "text-emerald-600"
                )}>
                  Scad. {doc.expiry}
                </p>
                {doc.daysToExpiry !== undefined && (
                  <p className="text-[10px] text-[#7BA4D0]">{doc.daysToExpiry}gg</p>
                )}
              </div>
            )}
            <div className="flex gap-1.5 shrink-0">
              <button className="w-7 h-7 flex items-center justify-center rounded-[7px] hover:bg-[#2E5E99]/10 transition-colors cursor-pointer">
                <Download size={12} className="text-[#7BA4D0]" />
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded-[7px] hover:bg-[#2E5E99]/10 transition-colors cursor-pointer">
                <MoreHorizontal size={12} className="text-[#7BA4D0]" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentiPage() {
  const [activeTab, setActiveTab] = React.useState<Tab>("Consegne Digitali")

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-[18px] font-bold text-[#0D2440] leading-tight">Documenti &amp; Operatività</h1>
        <p className="text-[12px] text-[#7BA4D0] mt-0.5">Consegne digitali, danni, checklist veicoli e archivio documenti</p>
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

      {activeTab === "Consegne Digitali" && <TabConsegne />}
      {activeTab === "Rapporto Danni" && <TabDanni />}
      {activeTab === "Checklist Veicoli" && <TabChecklist />}
      {activeTab === "Note di Viaggio" && <TabNoteViaggio />}
      {activeTab === "Documenti" && <TabDocumenti />}
    </div>
  )
}
