"use client"
import * as React from "react"
import { Plus, Send } from "lucide-react"
import { mockShifts, mockAvailability } from "@/lib/mock-shifts"
import { ShiftKpis } from "@/components/turni/shift-kpis"
import { WeeklyGrid } from "@/components/turni/weekly-grid"
import { AvailabilityPanel } from "@/components/turni/availability-panel"
import { UncoveredShifts } from "@/components/turni/uncovered-shifts"
import { AssignShiftDialog } from "@/components/turni/assign-shift-dialog"

export default function TurniPage() {
  const [assignShiftId, setAssignShiftId] = React.useState<number | null>(null)
  const assignShift = assignShiftId !== null ? mockShifts.find(s => s.id === assignShiftId) ?? null : null

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[#0D2440] leading-tight">Pianificazione Turni</h1>
          <p className="text-[12px] text-[#7BA4D0] mt-0.5">Gestione turni settimanali e disponibilità</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] border border-[#2E5E99]/20 text-[13px] text-[#0D2440] hover:bg-white/50 transition-colors cursor-pointer">
            <Plus size={14} className="text-[#7BA4D0]" />
            Nuovo Turno
          </button>
          <button className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-[#2E5E99] text-white text-[13px] font-semibold hover:bg-[#254E82] transition-colors shadow-sm shadow-[#2E5E99]/20 cursor-pointer">
            <Send size={13} />
            Pubblica
          </button>
        </div>
      </div>

      {/* KPIs */}
      <ShiftKpis shifts={mockShifts} />

      {/* Weekly grid */}
      <WeeklyGrid shifts={mockShifts} onAssign={id => setAssignShiftId(id)} />

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AvailabilityPanel availability={mockAvailability} />
        <UncoveredShifts shifts={mockShifts} />
      </div>

      <AssignShiftDialog
        open={assignShiftId !== null}
        shift={assignShift}
        onOpenChange={open => { if (!open) setAssignShiftId(null) }}
      />
    </div>
  )
}
