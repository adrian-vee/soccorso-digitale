"use client"
import * as React from "react"
import { MoreHorizontal, AlertTriangle, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Service, ServiceStatus } from "@/lib/mock-services"
import { mockVehicles } from "@/lib/mock-services"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

/* ── Badge helpers ── */

const TYPE_STYLE: Record<string, string> = {
  dialisi:       "bg-[#2E5E99]/[0.08] text-[#2E5E99] border-[#2E5E99]/10",
  visita:        "bg-[#7BA4D0]/[0.12] text-[#2E5E99] border-[#7BA4D0]/10",
  trasferimento: "bg-amber-500/[0.10] text-amber-700 border-amber-200/60",
  dimissione:    "bg-emerald-500/[0.10] text-emerald-700 border-emerald-200/60",
  altro:         "bg-gray-500/[0.08] text-gray-600 border-gray-200/60",
}

const STATUS_STYLE: Record<ServiceStatus, { cls: string; label: string }> = {
  programmato: { label: "Programmato", cls: "bg-[#0D2440]/[0.06] text-[#7BA4D0] border-[#7BA4D0]/15" },
  in_corso:    { label: "In Corso",    cls: "bg-[#7BA4D0]/[0.12] text-[#2E5E99] border-[#2E5E99]/15" },
  completato:  { label: "Completato",  cls: "bg-emerald-500/[0.10] text-emerald-700 border-emerald-200/60" },
  ritardo:     { label: "Ritardo",     cls: "bg-red-500/[0.10] text-red-600 border-red-200/60" },
  annullato:   { label: "Annullato",   cls: "bg-gray-500/[0.08] text-gray-500 border-gray-200/60 line-through" },
}

/* ── Vehicle selector ── */

function VehicleSelector({
  value,
  onChange,
}: {
  value: string | null
  onChange: (v: string | null) => void
}) {
  const active = mockVehicles.filter((v) => v.status === "attivo")

  if (value) {
    return (
      <button
        onClick={() => onChange(null)}
        className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#2E5E99] bg-[#2E5E99]/[0.07] border border-[#2E5E99]/15 px-2 py-1 rounded-[7px] hover:bg-[#2E5E99]/[0.12] transition-colors group"
      >
        {value}
        <Check size={10} className="text-[#2E5E99]/60 group-hover:hidden" />
        <span className="hidden group-hover:inline text-[#7BA4D0] text-[9px]">×</span>
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 h-7 px-2.5 rounded-[7px] text-[11px] font-medium bg-white/60 border border-[#2E5E99]/[0.12] text-[#7BA4D0] hover:text-[#2E5E99] hover:border-[#2E5E99]/25 transition-colors">
          Assegna
          <ChevronDown size={10} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {active.map((v) => (
          <DropdownMenuItem key={v.id} onClick={() => onChange(v.id)}>
            <span className="font-mono font-bold text-[#2E5E99] w-10">{v.id}</span>
            <span className="text-[#7BA4D0] text-[11px]">{v.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ── Table ── */

const COLS = [
  { key: "n",           label: "N.",         w: "w-10  shrink-0" },
  { key: "time",        label: "Ora",        w: "w-14  shrink-0" },
  { key: "type",        label: "Tipo",       w: "w-32  shrink-0" },
  { key: "patient",     label: "Paziente",   w: "w-36  shrink-0" },
  { key: "origin",      label: "Partenza",   w: "flex-1 min-w-[120px]" },
  { key: "destination", label: "Arrivo",     w: "flex-1 min-w-[120px]" },
  { key: "km",          label: "KM",         w: "w-14  shrink-0 text-right" },
  { key: "vehicle",     label: "Mezzo",      w: "w-24  shrink-0" },
  { key: "status",      label: "Stato",      w: "w-28  shrink-0" },
  { key: "actions",     label: "",           w: "w-10  shrink-0" },
]

const PAGE_SIZE = 10

interface ServiceTableProps {
  services: Service[]
  onServiceUpdate?: (id: number, patch: Partial<Service>) => void
}

export function ServiceTable({ services, onServiceUpdate }: ServiceTableProps) {
  const [selected, setSelected] = React.useState<number | null>(null)
  const [page, setPage] = React.useState(1)
  const totalPages = Math.max(1, Math.ceil(services.length / PAGE_SIZE))
  const visible = services.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  /* Empty state */
  if (services.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#2E5E99]/[0.07] flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-[#7BA4D0]" />
        </div>
        <p className="text-[15px] font-semibold text-[#0D2440]">Nessun servizio programmato</p>
        <p className="text-[12px] text-[#7BA4D0] mt-1">Carica un PDF o crea un nuovo servizio manualmente.</p>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(46,94,153,0.06)]">
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-40" />

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          {/* Header */}
          <thead>
            <tr className="border-b border-[#2E5E99]/[0.06]">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-3 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]",
                    col.key === "km" && "text-right",
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visible.map((s, idx) => {
              const typeStyle = TYPE_STYLE[s.type] ?? TYPE_STYLE.altro
              const statusInfo = STATUS_STYLE[s.status]
              const isSelected = selected === s.id
              const isUrgent = s.priority === "urgente"

              return (
                <tr
                  key={s.id}
                  onClick={() => setSelected(isSelected ? null : s.id)}
                  className={cn(
                    "border-b border-[#2E5E99]/[0.04] cursor-pointer transition-colors",
                    isSelected
                      ? "bg-[#2E5E99]/[0.04] border-l-2 border-l-[#2E5E99]"
                      : isUrgent
                      ? "bg-red-500/[0.025] hover:bg-[#2E5E99]/[0.025]"
                      : "hover:bg-[#2E5E99]/[0.025]",
                    "last:border-b-0"
                  )}
                >
                  {/* N. */}
                  <td className="px-3 py-3">
                    <span className="text-[11px] font-mono text-[#7BA4D0]/60">{(page - 1) * PAGE_SIZE + idx + 1}</span>
                  </td>

                  {/* Ora */}
                  <td className="px-3 py-3">
                    <span className="text-[12px] font-mono font-semibold text-[#2E5E99]">{s.time}</span>
                  </td>

                  {/* Tipo */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-semibold", typeStyle)}>
                        {s.typeLabel}
                      </span>
                      {isUrgent && (
                        <AlertTriangle size={11} className="text-red-500 shrink-0" />
                      )}
                    </div>
                  </td>

                  {/* Paziente */}
                  <td className="px-3 py-3">
                    <p className="text-[13px] font-semibold text-[#0D2440] truncate max-w-[140px]">{s.patient}</p>
                  </td>

                  {/* Origine */}
                  <td className="px-3 py-3">
                    <p className="text-[12px] text-[#0D2440]/70 truncate max-w-[180px]">{s.origin}</p>
                  </td>

                  {/* Destinazione */}
                  <td className="px-3 py-3">
                    <p className="text-[12px] text-[#0D2440]/70 truncate max-w-[180px]">{s.destination}</p>
                  </td>

                  {/* KM */}
                  <td className="px-3 py-3 text-right">
                    <span className="text-[11px] font-mono text-[#7BA4D0]">
                      {s.km > 0 ? `${s.km % 1 === 0 ? s.km : s.km.toFixed(1)}` : "—"}
                    </span>
                  </td>

                  {/* Mezzo */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <VehicleSelector
                      value={s.vehicle}
                      onChange={(v) => onServiceUpdate?.(s.id, { vehicle: v })}
                    />
                  </td>

                  {/* Stato */}
                  <td className="px-3 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full border text-[10px] font-semibold", statusInfo.cls)}>
                      {statusInfo.label}
                    </span>
                  </td>

                  {/* Azioni */}
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[#7BA4D0] hover:text-[#2E5E99] hover:bg-[#2E5E99]/5 transition-colors">
                          <MoreHorizontal size={14} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Modifica</DropdownMenuItem>
                        <DropdownMenuItem>Duplica</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-500 focus:text-red-600">Elimina</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#2E5E99]/[0.06]">
          <span className="text-[11px] text-[#7BA4D0]">
            {services.length} servizi · Pagina {page} di {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-7 px-2.5 rounded-[7px] text-[11px] font-medium bg-white/50 border border-white/60 text-[#0D2440] disabled:opacity-40 hover:bg-white/70 transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "w-7 h-7 rounded-[7px] text-[11px] font-medium transition-colors",
                  p === page
                    ? "bg-[#2E5E99] text-white"
                    : "bg-white/50 border border-white/60 text-[#0D2440] hover:bg-white/70"
                )}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-2.5 rounded-[7px] text-[11px] font-medium bg-white/50 border border-white/60 text-[#0D2440] disabled:opacity-40 hover:bg-white/70 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
