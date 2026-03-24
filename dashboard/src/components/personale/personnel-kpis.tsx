import * as React from "react"
import { Users, UserCheck, Clock, Timer, AlertTriangle } from "lucide-react"
import type { Volunteer } from "@/lib/mock-personnel"

interface PersonnelKpisProps {
  personnel: Volunteer[]
}

export function PersonnelKpis({ personnel }: PersonnelKpisProps) {
  const total = personnel.length
  const attivi = personnel.filter(v => v.status === "attivo").length
  const inTurno = 12
  const oreMese = personnel.reduce((s, v) => s + v.hoursThisMonth, 0)
  const certScadute = personnel.reduce((s, v) => {
    const certs = [v.certifications.blsd, v.certifications.license, v.certifications.safety626]
    return s + certs.filter(c => c.status === "expired").length
  }, 0)

  const kpis = [
    { label: "Totale Volontari", value: total, unit: "", icon: Users, accent: "#2E5E99" },
    { label: "Attivi", value: attivi, unit: "", icon: UserCheck, accent: "#2E5E99" },
    { label: "In Turno Oggi", value: inTurno, unit: "", icon: Clock, accent: "#2E5E99" },
    { label: "Ore Questo Mese", value: oreMese.toLocaleString("it-IT"), unit: "h", icon: Timer, accent: "#2E5E99" },
    { label: "Cert. Scadute", value: certScadute, unit: "", icon: AlertTriangle, accent: certScadute > 0 ? "#EF4444" : "#2E5E99" },
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
            <div
              className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${kpi.accent}12` }}
            >
              <kpi.icon size={13} style={{ color: kpi.accent }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
