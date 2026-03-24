import * as React from "react"
import { cn } from "@/lib/utils"
import { ClipboardList, Clock, PlayCircle, CheckCircle2, Truck, MapPin } from "lucide-react"
import type { Service } from "@/lib/mock-services"

interface ServiceKpisProps {
  services: Service[]
}

export function ServiceKpis({ services }: ServiceKpisProps) {
  const total = services.length
  const programmati = services.filter((s) => s.status === "programmato").length
  const inCorso = services.filter((s) => s.status === "in_corso").length
  const completati = services.filter((s) => s.status === "completato").length
  const vehiclesUsed = new Set(services.filter((s) => s.vehicle).map((s) => s.vehicle)).size
  const totalKm = services.reduce((sum, s) => sum + s.km, 0)

  const kpis = [
    { label: "Totale Servizi", value: total, unit: "", icon: ClipboardList, color: "#2E5E99" },
    { label: "Programmati", value: programmati, unit: "", icon: Clock, color: "#7BA4D0" },
    { label: "In Corso", value: inCorso, unit: "", icon: PlayCircle, color: "#2E5E99" },
    { label: "Completati", value: completati, unit: "", icon: CheckCircle2, color: "#2E5E99" },
    { label: "Mezzi Impegnati", value: `${vehiclesUsed}/5`, unit: "", icon: Truck, color: "#7BA4D0" },
    { label: "KM Stimati", value: totalKm.toFixed(0), unit: "km", icon: MapPin, color: "#7BA4D0" },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
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
            <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: `rgba(46,94,153,0.07)` }}>
              <kpi.icon size={13} style={{ color: kpi.color }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
