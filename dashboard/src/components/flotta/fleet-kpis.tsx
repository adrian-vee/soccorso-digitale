import * as React from "react"
import { cn } from "@/lib/utils"
import { Truck, CheckCircle2, PlayCircle, Wrench, MapPin } from "lucide-react"
import type { Vehicle } from "@/lib/mock-fleet"

interface FleetKpisProps {
  fleet: Vehicle[]
}

export function FleetKpis({ fleet }: FleetKpisProps) {
  const total = fleet.length
  const attivi = fleet.filter((v) => v.status === "attivo").length
  const inServizio = fleet.filter((v) => v.status === "in_servizio").length
  const manutenzione = fleet.filter((v) => v.status === "manutenzione").length
  const kmMese = fleet.reduce((sum, v) => sum + v.kmThisMonth, 0)

  const kpis = [
    { label: "Veicoli Totali", value: total, unit: "", icon: Truck },
    { label: "Attivi", value: attivi, unit: "", icon: CheckCircle2 },
    { label: "In Servizio Ora", value: inServizio, unit: "", icon: PlayCircle },
    { label: "In Manutenzione", value: manutenzione, unit: "", icon: Wrench },
    { label: "KM Totali Mese", value: kmMese.toLocaleString("it-IT"), unit: "km", icon: MapPin },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="relative overflow-hidden rounded-[12px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-3.5"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-35" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-1.5">{kpi.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-light tracking-tight text-[#0D2440] leading-none">{kpi.value}</span>
                {kpi.unit && <span className="text-[10px] text-[#7BA4D0]/70">{kpi.unit}</span>}
              </div>
            </div>
            <div className="w-7 h-7 rounded-[8px] bg-[#2E5E99]/[0.07] flex items-center justify-center shrink-0">
              <kpi.icon size={13} className="text-[#2E5E99]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
