import * as React from "react"
import { AlertTriangle, Clock, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExpiryAlert } from "@/lib/mock-fleet"

interface ExpiryAlertsProps {
  alerts: ExpiryAlert[]
}

function alertIcon(type: string) {
  if (type === "Tagliando") return Wrench
  if (type === "Revisione" || type === "Assicurazione") return AlertTriangle
  return Clock
}

function alertStyle(alert: ExpiryAlert) {
  if (alert.urgent) {
    return {
      wrap: "bg-red-500/[0.05] border border-red-500/[0.12]",
      icon: "bg-red-500/10",
      iconColor: "text-red-500",
      dot: "bg-red-500",
    }
  }
  if (alert.daysLeft !== null && alert.daysLeft <= 30) {
    return {
      wrap: "bg-amber-500/[0.05] border border-amber-500/[0.12]",
      icon: "bg-amber-500/10",
      iconColor: "text-amber-500",
      dot: "bg-amber-500",
    }
  }
  return {
    wrap: "bg-[#2E5E99]/[0.04] border border-[#2E5E99]/[0.08]",
    icon: "bg-[#2E5E99]/[0.07]",
    iconColor: "text-[#7BA4D0]",
    dot: "bg-[#7BA4D0]",
  }
}

export function ExpiryAlerts({ alerts }: ExpiryAlertsProps) {
  if (alerts.length === 0) return null

  return (
    <div className="relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(46,94,153,0.06)]">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-40" />

      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#0D2440]">Scadenze Prossime</p>
          <span className="px-2 py-0.5 rounded-full bg-red-500/[0.08] border border-red-500/[0.12] text-[10px] font-bold text-red-500">
            {alerts.filter((a) => a.urgent).length} urgenti
          </span>
        </div>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {alerts.map((alert, i) => {
          const style = alertStyle(alert)
          const Icon = alertIcon(alert.type)
          return (
            <div key={i} className={cn("flex items-center gap-3 p-3 rounded-[10px]", style.wrap)}>
              <div className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0", style.icon)}>
                <Icon size={14} className={style.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#0D2440]">
                  <span className="font-mono text-[#2E5E99]">{alert.vehicle}</span>
                  {" "}— {alert.type}
                </p>
                <p className="text-[10px] text-[#7BA4D0] mt-0.5">
                  {alert.daysLeft !== null
                    ? `Scade il ${alert.date} · ${alert.daysLeft} giorni`
                    : alert.date}
                </p>
              </div>
              <button className="shrink-0 h-7 px-2.5 rounded-[7px] text-[10px] font-medium text-[#2E5E99] bg-white/50 border border-white/60 hover:bg-white/80 transition-colors">
                Gestisci
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
