import * as React from "react"
import { cn } from "@/lib/utils"
import type { Vehicle, VehicleStatus } from "@/lib/mock-fleet"

const STATUS_CONFIG: Record<VehicleStatus, { dot: string; badge: string; label: string }> = {
  in_servizio:  { dot: "bg-[#2E5E99]",   badge: "bg-[#2E5E99]/[0.08] text-[#2E5E99] border-[#2E5E99]/15",           label: "In Servizio" },
  attivo:       { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 border-emerald-200/60",           label: "Attivo" },
  manutenzione: { dot: "bg-amber-500",   badge: "bg-amber-500/10 text-amber-700 border-amber-200/60",                 label: "Manutenzione" },
  fermo:        { dot: "bg-gray-400",    badge: "bg-gray-400/10 text-gray-500 border-gray-300/40",                    label: "Fermo" },
}

interface FleetStatusProps {
  fleet: Vehicle[]
}

export function FleetStatusList({ fleet }: FleetStatusProps) {
  return (
    <div className="relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(46,94,153,0.06)]">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-40" />
      <div className="px-4 pt-5 pb-2">
        <p className="text-[13px] font-semibold text-[#0D2440]">Stato Veicoli</p>
        <p className="text-[11px] text-[#7BA4D0]/80 mt-0.5">Aggiornato ora</p>
      </div>
      <div className="px-2 pb-3 space-y-0.5">
        {fleet.map((v) => {
          const cfg = STATUS_CONFIG[v.status]
          return (
            <div
              key={v.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[#2E5E99]/[0.025] transition-colors cursor-pointer"
            >
              {/* Dot */}
              <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dot)} />

              {/* ID + info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-bold text-[#2E5E99]">{v.id}</span>
                  <span className="text-[11px] text-[#0D2440] truncate">{v.name}</span>
                </div>
                <span className="text-[9.5px] text-[#7BA4D0]">{v.plate} · {v.sede}</span>
              </div>

              {/* KM */}
              <div className="text-right shrink-0">
                <div className="font-mono text-[12px] font-semibold text-[#0D2440]">{v.km.toLocaleString("it-IT")}</div>
                <div className="text-[9px] text-[#7BA4D0]">km tot.</div>
              </div>

              {/* Badge */}
              <span className={cn("shrink-0 px-2 py-0.5 rounded-full border text-[9.5px] font-semibold", cfg.badge)}>
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
