"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Package, Plus, AlertTriangle, XCircle, CheckCircle2,
  Trash2, ShoppingCart, ClipboardList, MoreHorizontal, Search
} from "lucide-react"
import {
  mockInventory, mockSanifications, inventoryKpis,
  type ItemCategory, type ItemStatus
} from "@/lib/mock-inventory"

// ─── shared ───────────────────────────────────────────────────────────────────

const TABS = ["Magazzino", "Scadenze Materiali", "Sanificazioni"] as const
type Tab = (typeof TABS)[number]

const inputCls = "h-8 px-2.5 rounded-[8px] border border-[#2E5E99]/15 bg-white/60 text-[12px] text-[#0D2440] placeholder:text-[#7BA4D0]/50 focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30"

// ─── KPI bar ─────────────────────────────────────────────────────────────────

function InventoryKpis() {
  const kpis = [
    { label: "Articoli Totali", value: inventoryKpis.total, icon: Package, color: "#2E5E99" },
    { label: "Sotto Scorta", value: inventoryKpis.lowStock, icon: AlertTriangle, color: "#EF4444" },
    { label: "In Scadenza (<30gg)", value: inventoryKpis.expiringSoon, icon: XCircle, color: "#F59E0B" },
    { label: "Valore Magazzino", value: `€${inventoryKpis.totalValue.toLocaleString("it-IT")}`, icon: Package, color: "#10B981" },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {kpis.map(k => (
        <div key={k.label} className="relative overflow-hidden rounded-[12px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-3.5">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-35" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-1.5">{k.label}</p>
              <span className="text-[20px] font-light tracking-tight text-[#0D2440] leading-none">{k.value}</span>
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

// ─── status helpers ──────────────────────────────────────────────────────────

const STATUS_CFG: Record<ItemStatus, { label: string; cls: string }> = {
  ok:       { label: "OK",       cls: "bg-emerald-500/10 text-emerald-700" },
  low:      { label: "Basso",    cls: "bg-amber-500/10 text-amber-700" },
  critical: { label: "Critico",  cls: "bg-red-500/10 text-red-600" },
  expired:  { label: "Scaduto",  cls: "bg-gray-400/10 text-gray-500" },
}

const CAT_LABELS: Record<ItemCategory, string> = {
  dpi: "DPI", farmaco: "Farmaco", dispositivo: "Dispositivo", consumabile: "Consumabile",
}

const CAT_COLORS: Record<ItemCategory, string> = {
  dpi: "bg-blue-500/10 text-blue-700",
  farmaco: "bg-red-500/10 text-red-700",
  dispositivo: "bg-purple-500/10 text-purple-700",
  consumabile: "bg-amber-500/10 text-amber-700",
}

// ─── Tab 1: Magazzino ─────────────────────────────────────────────────────────

function TabMagazzino() {
  const [search, setSearch] = React.useState("")
  const [catFilter, setCatFilter] = React.useState("Tutti")

  const filtered = mockInventory.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.code.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === "Tutti" || CAT_LABELS[item.category] === catFilter
    return matchSearch && matchCat
  })

  const lowItems = mockInventory.filter(i => i.quantity <= i.minStock)

  return (
    <div className="space-y-3">
      <InventoryKpis />

      {/* Alerts */}
      {lowItems.length > 0 && (
        <div className="rounded-[12px] bg-red-500/[0.06] border border-red-500/15 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} className="text-red-500" />
            <span className="text-[12px] font-semibold text-red-600">{lowItems.length} articoli sotto scorta minima</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lowItems.map(i => (
              <span key={i.id} className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 text-[10px] font-medium">
                {i.name.substring(0, 24)}… ({i.quantity}/{i.minStock})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7BA4D0]" />
          <input className="w-full h-8 pl-8 pr-3 rounded-[8px] border border-white/60 bg-white/55 backdrop-blur-xl text-[12px] text-[#0D2440] placeholder:text-[#7BA4D0]/60 focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30" placeholder="Cerca articolo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="h-8 px-2.5 rounded-[8px] border border-white/60 bg-white/55 text-[12px] text-[#0D2440] focus:outline-none cursor-pointer">
          {["Tutti", "DPI", "Farmaco", "Dispositivo", "Consumabile"].map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#2E5E99] text-white text-[12px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer">
          <Plus size={12} /> Aggiungi
        </button>
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#2E5E99]/20 bg-white/55 text-[12px] text-[#0D2440] hover:bg-white/70 transition-colors cursor-pointer">
          <ClipboardList size={12} className="text-[#7BA4D0]" /> Inventario
        </button>
      </div>

      {/* Table */}
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#2E5E99]/[0.08]">
                {["Codice", "Articolo", "Categoria", "Q.tà", "Min", "Ubicazione", "Scadenza", "Stato", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} className={cn("border-b border-[#2E5E99]/[0.05] hover:bg-[#2E5E99]/[0.02]", i % 2 === 0 && "bg-white/20",
                  item.status === "critical" && "bg-red-500/[0.02]"
                )}>
                  <td className="px-3 py-2 text-[#7BA4D0] font-mono text-[10px]">{item.code}</td>
                  <td className="px-3 py-2 font-medium text-[#0D2440] max-w-[180px] truncate">{item.name}</td>
                  <td className="px-3 py-2">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", CAT_COLORS[item.category])}>
                      {CAT_LABELS[item.category]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("font-semibold", item.quantity <= item.minStock ? "text-red-500" : "text-[#0D2440]")}>
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#0D2440]/50">{item.minStock}</td>
                  <td className="px-3 py-2 text-[#0D2440]/60 text-[11px] whitespace-nowrap">{item.location}</td>
                  <td className="px-3 py-2">
                    {item.expiry ? (
                      <span className={cn("text-[11px]",
                        item.daysToExpiry !== undefined && item.daysToExpiry < 0 ? "text-gray-400 line-through" :
                        item.daysToExpiry !== undefined && item.daysToExpiry < 30 ? "text-red-500 font-medium" :
                        item.daysToExpiry !== undefined && item.daysToExpiry < 90 ? "text-amber-600" : "text-emerald-600"
                      )}>
                        {item.expiry}
                      </span>
                    ) : <span className="text-[#7BA4D0]/40">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", STATUS_CFG[item.status].cls)}>
                      {STATUS_CFG[item.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#2E5E99]/10 cursor-pointer">
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

// ─── Tab 2: Scadenze Materiali ───────────────────────────────────────────────

function TabScadenze() {
  const items = mockInventory
    .filter(i => i.expiry && i.daysToExpiry !== undefined)
    .sort((a, b) => (a.daysToExpiry ?? 999) - (b.daysToExpiry ?? 999))

  const urgency = (days: number | undefined) => {
    if (days === undefined) return "ok"
    if (days < 0) return "expired"
    if (days < 7) return "critical"
    if (days < 30) return "warning"
    return "ok"
  }

  const urgCfg = {
    expired:  { cls: "bg-gray-100 border-gray-200", badge: "bg-gray-400/20 text-gray-600", text: "Scaduto" },
    critical: { cls: "bg-red-500/[0.05] border-red-500/20", badge: "bg-red-500/15 text-red-600", text: "Critico" },
    warning:  { cls: "bg-amber-500/[0.05] border-amber-500/20", badge: "bg-amber-500/15 text-amber-700", text: "In scadenza" },
    ok:       { cls: "bg-emerald-500/[0.03] border-emerald-500/15", badge: "bg-emerald-500/15 text-emerald-700", text: "OK" },
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-[#7BA4D0]">{items.length} articoli con data di scadenza</p>
      {items.map(item => {
        const urg = urgency(item.daysToExpiry)
        const cfg = urgCfg[urg]
        return (
          <div key={item.id} className={cn("flex items-center gap-3 px-4 py-3 rounded-[12px] border", cfg.cls)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-semibold text-[#0D2440]">{item.name}</span>
                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", cfg.badge)}>{cfg.text}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[11px] text-[#7BA4D0]">{item.code} · {item.location}</span>
                <span className="text-[11px] text-[#7BA4D0]">Q.tà: {item.quantity}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={cn("text-[13px] font-semibold",
                urg === "critical" ? "text-red-500" :
                urg === "warning" ? "text-amber-600" :
                urg === "expired" ? "text-gray-400" : "text-emerald-600"
              )}>
                {item.daysToExpiry !== undefined && item.daysToExpiry < 0
                  ? `Scaduto ${Math.abs(item.daysToExpiry)}gg fa`
                  : `${item.daysToExpiry}gg`
                }
              </p>
              <p className="text-[10px] text-[#7BA4D0]">{item.expiry}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button className="h-7 px-2.5 rounded-[7px] text-[10px] font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1">
                <Trash2 size={10} /> Smaltisci
              </button>
              <button className="h-7 px-2.5 rounded-[7px] text-[10px] font-medium bg-[#2E5E99]/10 text-[#2E5E99] hover:bg-[#2E5E99]/20 transition-colors cursor-pointer flex items-center gap-1">
                <ShoppingCart size={10} /> Ordina
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab 3: Sanificazioni ─────────────────────────────────────────────────────

function TabSanificazioni() {
  const overdue = mockSanifications.filter(s => s.overdue)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] text-[#7BA4D0]">{mockSanifications.length} veicoli registrati</p>
          {overdue.length > 0 && (
            <p className="text-[12px] text-red-500 font-medium">{overdue.length} sanificazioni scadute</p>
          )}
        </div>
        <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#2E5E99] text-white text-[12px] font-semibold hover:bg-[#254E82] transition-colors cursor-pointer">
          <Plus size={12} /> Registra Sanificazione
        </button>
      </div>

      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#2E5E99]/[0.08]">
              {["Data", "Veicolo", "Tipo", "Operatore", "Prodotti", "Prossima", "Stato"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockSanifications.map((s, i) => (
              <tr key={s.id} className={cn("border-b border-[#2E5E99]/[0.05]", i % 2 === 0 && "bg-white/20", s.overdue && "bg-red-500/[0.02]")}>
                <td className="px-4 py-2.5 text-[#0D2440]">{s.date}</td>
                <td className="px-4 py-2.5 font-medium text-[#0D2440]">{s.vehicle}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium",
                    s.type === "straordinaria" ? "bg-purple-500/10 text-purple-700" : "bg-[#2E5E99]/10 text-[#2E5E99]"
                  )}>
                    {s.type.charAt(0).toUpperCase() + s.type.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[#0D2440]/70">{s.operator}</td>
                <td className="px-4 py-2.5 text-[#0D2440]/60 max-w-[160px] truncate text-[11px]">{s.products}</td>
                <td className="px-4 py-2.5">
                  <span className={s.overdue ? "text-red-500 font-semibold" : "text-[#0D2440]"}>{s.nextDate}</span>
                </td>
                <td className="px-4 py-2.5">
                  {s.overdue ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-red-500">
                      <XCircle size={10} /> Scaduta
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                      <CheckCircle2 size={10} /> {s.daysToNext}gg
                    </span>
                  )}
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

export default function InventarioPage() {
  const [activeTab, setActiveTab] = React.useState<Tab>("Magazzino")

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[#0D2440] leading-tight">Inventario &amp; Magazzino</h1>
          <p className="text-[12px] text-[#7BA4D0] mt-0.5">DPI, farmaci, dispositivi medici e sanificazioni</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-[12px] bg-white/40 backdrop-blur-xl border border-white/50">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-[9px] text-[12px] font-medium whitespace-nowrap transition-all cursor-pointer",
              activeTab === tab ? "bg-white/80 text-[#2E5E99] shadow-sm" : "text-[#0D2440]/55 hover:text-[#0D2440] hover:bg-white/30"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Magazzino" && <TabMagazzino />}
      {activeTab === "Scadenze Materiali" && <TabScadenze />}
      {activeTab === "Sanificazioni" && <TabSanificazioni />}
    </div>
  )
}
