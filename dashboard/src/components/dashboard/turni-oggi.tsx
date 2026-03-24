"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { useShifts } from "@/hooks/use-shifts"
import type { Shift } from "@/lib/mock-shifts"

function ShiftRowSkeleton() {
  return (
    <div className="px-3 py-3 rounded-[9px] bg-white/40 border border-white/50 animate-pulse space-y-2">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 bg-[#2E5E99]/10 rounded" />
        <div className="h-3 w-10 bg-[#2E5E99]/10 rounded" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-20 bg-[#2E5E99]/08 rounded-full" />
        <div className="h-5 w-16 bg-[#2E5E99]/08 rounded-full" />
      </div>
    </div>
  )
}

function ShiftCard({ shift }: { shift: Shift }) {
  const covered = shift.covered
  const assigned = shift.volunteers.length
  const needed = shift.required

  return (
    <div className={cn(
      "px-3 py-3 rounded-[9px] border transition-colors",
      covered
        ? "bg-emerald-50/60 border-emerald-100"
        : "bg-amber-50/60 border-amber-100"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-[12px] font-semibold text-[#0D2440] capitalize">{shift.slot}</span>
          <span className="text-[10px] text-[#7BA4D0] ml-2">{shift.slotLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "text-[10px] font-semibold tabular-nums",
            covered ? "text-emerald-600" : "text-amber-600"
          )}>
            {assigned}/{needed}
          </span>
          <span className={cn(
            "w-2 h-2 rounded-full",
            covered ? "bg-emerald-500" : "bg-amber-400"
          )} />
        </div>
      </div>

      {shift.volunteers.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {shift.volunteers.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 border border-[#2E5E99]/10 text-[10px] text-[#0D2440]"
            >
              <span className="w-4 h-4 rounded-full bg-[#2E5E99]/10 flex items-center justify-center text-[8px] font-bold text-[#2E5E99]">
                {v.initials}
              </span>
              {v.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-amber-600 font-medium">Nessun volontario assegnato</p>
      )}
    </div>
  )
}

export function TurniOggi() {
  const { data: shifts = [], isLoading } = useShifts(0)
  const todayStr = React.useMemo(() => new Date().toISOString().split('T')[0], [])

  const todayShifts = React.useMemo(
    () => shifts.filter(s => s.day === todayStr),
    [shifts, todayStr]
  )

  const mattina = todayShifts.find(s => s.slot === 'mattina')
  const pomeriggio = todayShifts.find(s => s.slot === 'pomeriggio')
  const openCount = todayShifts.filter(s => !s.covered).length

  return (
    <div className="relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(46,94,153,0.06)]">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-40" />

      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#0D2440]">Turni di Oggi</p>
          <p className="text-[11px] text-[#7BA4D0]/80 mt-0.5">
            {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {openCount > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-700">
            {openCount} {openCount === 1 ? "scoperto" : "scoperti"}
          </span>
        )}
      </div>

      <div className="px-3 pb-4 space-y-2">
        {isLoading ? (
          <>
            <ShiftRowSkeleton />
            <ShiftRowSkeleton />
          </>
        ) : todayShifts.length === 0 ? (
          <p className="text-[12px] text-[#7BA4D0] text-center py-5">
            Nessun turno configurato per oggi
          </p>
        ) : (
          [mattina, pomeriggio]
            .filter((s): s is Shift => s !== undefined)
            .map((shift) => <ShiftCard key={shift.id} shift={shift} />)
        )}
      </div>
    </div>
  )
}
