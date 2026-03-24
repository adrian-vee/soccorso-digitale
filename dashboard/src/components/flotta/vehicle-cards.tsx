"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight } from "lucide-react"
import type { Vehicle, VehicleStatus } from "@/lib/mock-fleet"

const STATUS_CONFIG: Record<VehicleStatus, { badge: string; label: string; gradient: string }> = {
  in_servizio:  {
    badge:    "bg-[#2E5E99]/[0.08] text-[#2E5E99] border-[#2E5E99]/15",
    label:    "In Servizio",
    gradient: "from-[#2E5E99] to-[#7BA4D0]",
  },
  attivo: {
    badge:    "bg-emerald-500/10 text-emerald-700 border-emerald-200/60",
    label:    "Attivo",
    gradient: "from-emerald-500 to-emerald-400",
  },
  manutenzione: {
    badge:    "bg-amber-500/10 text-amber-700 border-amber-200/60",
    label:    "Manutenzione",
    gradient: "from-amber-500 to-amber-400",
  },
  fermo: {
    badge:    "bg-gray-400/10 text-gray-500 border-gray-300/40",
    label:    "Fermo",
    gradient: "from-gray-400 to-gray-300",
  },
}

function ExpiryLine({ label, expiry, daysLeft }: { label: string; expiry: string; daysLeft: number | null }) {
  const color =
    daysLeft === null
      ? "text-[#0D2440]"
      : daysLeft > 60
      ? "text-emerald-600"
      : daysLeft > 15
      ? "text-amber-600"
      : "text-red-500"

  const icon =
    daysLeft === null ? null : daysLeft > 60 ? (
      <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
    ) : daysLeft > 15 ? (
      <AlertTriangle size={10} className="text-amber-500 shrink-0" />
    ) : (
      <XCircle size={10} className="text-red-500 shrink-0" />
    )

  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-[#7BA4D0]">{label}</span>
      <span className={cn("flex items-center gap-1 text-[10px] font-semibold", color)}>
        {icon}
        {expiry}
      </span>
    </div>
  )
}

interface VehicleCardsProps {
  fleet: Vehicle[]
  onSelect?: (id: string) => void
}

export function VehicleCards({ fleet, onSelect }: VehicleCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {fleet.map((v) => {
        const cfg = STATUS_CONFIG[v.status]
        return (
          <div
            key={v.id}
            className={cn(
              "relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60",
              "shadow-[0_2px_12px_rgba(46,94,153,0.06)] p-5",
              "hover:shadow-[0_4px_20px_rgba(13,36,64,0.06)] hover:bg-white/65 transition-all cursor-pointer group"
            )}
          >
            {/* Accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-35" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  "text-[11px] font-bold text-white shadow-sm",
                  `bg-gradient-to-br ${cfg.gradient}`
                )}>
                  {v.id}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#0D2440] leading-tight">{v.name}</p>
                  <p className="text-[10px] text-[#7BA4D0] font-mono">{v.plate}</p>
                </div>
              </div>
              <span className={cn("px-2 py-0.5 rounded-full border text-[9.5px] font-semibold shrink-0", cfg.badge)}>
                {cfg.label}
              </span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-[#E7F0FA]/50 rounded-[9px] p-2.5">
                <p className="text-[8.5px] text-[#7BA4D0] uppercase tracking-wide font-semibold mb-1">KM Totali</p>
                <p className="font-mono text-[15px] font-semibold text-[#0D2440] leading-none">{v.km.toLocaleString("it-IT")}</p>
              </div>
              <div className="bg-[#E7F0FA]/50 rounded-[9px] p-2.5">
                <p className="text-[8.5px] text-[#7BA4D0] uppercase tracking-wide font-semibold mb-1">Servizi Mese</p>
                <p className="font-mono text-[15px] font-semibold text-[#0D2440] leading-none">{v.servicesThisMonth}</p>
              </div>
            </div>

            {/* Scadenze */}
            <div className="space-y-2 mb-4">
              <ExpiryLine label="Assicurazione" expiry={v.insurance.expiry} daysLeft={v.insurance.daysLeft} />
              <ExpiryLine label="Revisione" expiry={v.revision.expiry} daysLeft={v.revision.daysLeft} />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#7BA4D0]">Prossimo Tagliando</span>
                <span className="text-[10px] font-semibold text-[#0D2440]">
                  {v.nextService.km.toLocaleString("it-IT")} km
                  <span className="text-[#7BA4D0] font-normal"> (−{v.nextService.remaining.toLocaleString("it-IT")} km)</span>
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-[#2E5E99]/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-[#7BA4D0]">Sede</span>
                <span className="text-[9px] font-semibold text-[#0D2440]">{v.sede}</span>
                <span className="text-[9px] text-[#7BA4D0]">· {v.year}</span>
              </div>
              <button
                onClick={() => onSelect?.(v.id)}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#2E5E99] hover:text-[#0D2440] transition-colors group-hover:gap-1.5"
              >
                Dettagli
                <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
