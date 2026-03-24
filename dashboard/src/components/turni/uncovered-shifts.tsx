import * as React from "react"
import { AlertCircle } from "lucide-react"
import type { Shift } from "@/lib/mock-shifts"

interface UncoveredShiftsProps {
  shifts: Shift[]
}

export function UncoveredShifts({ shifts }: UncoveredShiftsProps) {
  const uncovered = shifts.filter(s => !s.covered)

  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-3">Turni Scoperti</h2>
      {uncovered.length === 0 ? (
        <p className="text-[12px] text-emerald-600">Tutti i turni sono coperti</p>
      ) : (
        <div className="space-y-1.5">
          {uncovered.map(s => (
            <div key={s.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] bg-red-500/[0.06] border border-red-500/15">
              <AlertCircle size={12} className="text-red-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-medium text-[#0D2440]">{s.dayLabel}</span>
                <span className="text-[11px] text-[#7BA4D0] ml-2">{s.slotLabel}</span>
              </div>
              <span className="text-[11px] text-red-500 font-medium shrink-0">
                {s.volunteers.length}/{s.required} vol.
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
