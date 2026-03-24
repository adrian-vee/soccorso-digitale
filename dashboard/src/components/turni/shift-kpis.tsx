import * as React from "react"
import { Calendar, CheckCircle2, AlertCircle, Users, Clock } from "lucide-react"
import type { Shift } from "@/lib/mock-shifts"

interface ShiftKpisProps {
  shifts: Shift[]
}

export function ShiftKpis({ shifts }: ShiftKpisProps) {
  const total = shifts.length
  const coperti = shifts.filter(s => s.covered).length
  const scoperti = total - coperti
  const volDisp = 8
  const oreProgrammate = shifts.reduce((s, sh) => s + sh.volunteers.length * 8, 0)

  const kpis = [
    { label: "Turni Settimana", value: total, icon: Calendar },
    { label: "Coperti", value: coperti, icon: CheckCircle2 },
    { label: "Scoperti", value: scoperti, icon: AlertCircle, warn: scoperti > 0 },
    { label: "Vol. Disponibili", value: volDisp, icon: Users },
    { label: "Ore Programmate", value: oreProgrammate, unit: "h", icon: Clock },
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
                <span className={`text-[22px] font-light tracking-tight leading-none ${kpi.warn ? "text-red-500" : "text-[#0D2440]"}`}>{kpi.value}</span>
                {kpi.unit && <span className="text-[10px] text-[#7BA4D0]/70">{kpi.unit}</span>}
              </div>
            </div>
            <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 ${kpi.warn ? "bg-red-500/10" : "bg-[#2E5E99]/[0.07]"}`}>
              <kpi.icon size={13} className={kpi.warn ? "text-red-500" : "text-[#2E5E99]"} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
