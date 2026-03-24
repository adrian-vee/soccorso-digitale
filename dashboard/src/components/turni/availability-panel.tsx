import * as React from "react"
import { cn } from "@/lib/utils"
import type { AvailabilityRow } from "@/lib/mock-shifts"

interface AvailabilityPanelProps {
  availability: AvailabilityRow[]
}

const DAY_LABELS = ["L", "M", "M", "G", "V", "S", "D"]

export function AvailabilityPanel({ availability }: AvailabilityPanelProps) {
  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-3">Disponibilità Volontari</h2>
      <div className="space-y-1.5">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2">
          <span className="flex-1 text-[9px] text-transparent">Nome</span>
          {DAY_LABELS.map((d, i) => (
            <span key={i} className="w-6 text-center text-[9px] font-bold text-[#7BA4D0]">{d}</span>
          ))}
        </div>
        {availability.map(row => (
          <div key={row.id} className="flex items-center gap-2">
            <span className="flex-1 text-[12px] text-[#0D2440] font-medium truncate">{row.name}</span>
            {row.days.map((avail, i) => (
              <div
                key={i}
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold",
                  avail
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-[#2E5E99]/[0.04] text-[#7BA4D0]/40"
                )}
              >
                {avail ? "✓" : "–"}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
