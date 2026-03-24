"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import type { Shift } from "@/lib/mock-shifts"

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
const DAYS_FULL = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]
const DATES = ["24/03", "25/03", "26/03", "27/03", "28/03", "29/03", "30/03"]
const DAYS_ISO = ["2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30"]
const TODAY = "2026-03-24"

interface WeeklyGridProps {
  shifts: Shift[]
  onAssign?: (shiftId: number) => void
}

function VolunteerChip({ initials, name }: { initials: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-[#2E5E99]/[0.07] rounded-md px-1.5 py-1 mb-0.5">
      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] text-[8px] text-white flex items-center justify-center font-bold shrink-0">
        {initials}
      </div>
      <span className="text-[10px] text-[#0D2440] font-medium truncate">{name}</span>
    </div>
  )
}

function ShiftCell({ shift, isToday, onAssign }: { shift: Shift | undefined; isToday: boolean; onAssign?: () => void }) {
  if (!shift) return <div className="min-h-[70px] rounded-lg bg-white/10 border border-white/20" />

  const covered = shift.covered
  return (
    <div className={cn(
      "min-h-[70px] rounded-lg p-1.5 border transition-all",
      isToday && covered ? "bg-[#2E5E99]/[0.06] border-[#2E5E99]/20 border-2" :
      isToday && !covered ? "bg-red-500/[0.06] border-red-500/25 border-2" :
      covered ? "bg-white/40 border-white/50" :
      "bg-red-500/[0.04] border-red-500/15"
    )}>
      {shift.volunteers.map(v => (
        <VolunteerChip key={v.id} initials={v.initials} name={v.name} />
      ))}
      {!covered && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[9px] text-red-500 font-medium">Scoperto</span>
          <span className="text-[9px] text-red-400">({shift.volunteers.length}/{shift.required})</span>
        </div>
      )}
      {covered && shift.volunteers.length < shift.required && (
        <span className="text-[9px] text-amber-600">Parziale</span>
      )}
      <button
        onClick={onAssign}
        className="mt-0.5 w-full flex items-center justify-center gap-0.5 h-5 rounded bg-[#2E5E99]/[0.06] hover:bg-[#2E5E99]/15 transition-colors cursor-pointer"
      >
        <Plus size={9} className="text-[#7BA4D0]" />
        <span className="text-[9px] text-[#7BA4D0]">Assegna</span>
      </button>
    </div>
  )
}

export function WeeklyGrid({ shifts, onAssign }: WeeklyGridProps) {
  const [weekOffset, setWeekOffset] = React.useState(0)

  const getShift = (day: string, slot: "mattina" | "pomeriggio") =>
    shifts.find(s => s.day === day && s.slot === slot)

  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
      {/* Week nav */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-bold text-[#0D2440]">Settimana 24 — 30 Marzo 2026</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="w-7 h-7 rounded-[7px] flex items-center justify-center hover:bg-[#2E5E99]/10 transition-colors cursor-pointer"
          >
            <ChevronLeft size={14} className="text-[#7BA4D0]" />
          </button>
          <span className="text-[11px] text-[#7BA4D0] px-2">Settimana</span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="w-7 h-7 rounded-[7px] flex items-center justify-center hover:bg-[#2E5E99]/10 transition-colors cursor-pointer"
          >
            <ChevronRight size={14} className="text-[#7BA4D0]" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {DAYS.map((d, i) => (
              <div key={d} className={cn(
                "text-center py-1.5 rounded-lg",
                DAYS_ISO[i] === TODAY ? "bg-[#2E5E99]/10" : ""
              )}>
                <div className={cn("text-[10px] font-bold", DAYS_ISO[i] === TODAY ? "text-[#2E5E99]" : "text-[#0D2440]/60")}>{d}</div>
                <div className={cn("text-[11px] font-semibold", DAYS_ISO[i] === TODAY ? "text-[#2E5E99]" : "text-[#0D2440]")}>{DATES[i]}</div>
              </div>
            ))}
          </div>

          {/* Slot label + row: Mattina */}
          <div className="flex items-start gap-1.5 mb-1.5">
            <div className="w-14 shrink-0 pt-1 text-[9px] font-bold uppercase tracking-wider text-[#7BA4D0] text-right pr-1">
              Mattina<br />06–14
            </div>
            <div className="grid grid-cols-7 gap-1.5 flex-1">
              {DAYS_ISO.map((day, i) => (
                <ShiftCell
                  key={day}
                  shift={getShift(day, "mattina")}
                  isToday={day === TODAY}
                  onAssign={() => onAssign?.(getShift(day, "mattina")?.id ?? 0)}
                />
              ))}
            </div>
          </div>

          {/* Slot label + row: Pomeriggio */}
          <div className="flex items-start gap-1.5">
            <div className="w-14 shrink-0 pt-1 text-[9px] font-bold uppercase tracking-wider text-[#7BA4D0] text-right pr-1">
              Pom.<br />14–22
            </div>
            <div className="grid grid-cols-7 gap-1.5 flex-1">
              {DAYS_ISO.map((day, i) => (
                <ShiftCell
                  key={day}
                  shift={getShift(day, "pomeriggio")}
                  isToday={day === TODAY}
                  onAssign={() => onAssign?.(getShift(day, "pomeriggio")?.id ?? 0)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
