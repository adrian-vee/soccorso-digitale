"use client"
import * as React from "react"
import { X, UserPlus } from "lucide-react"
import { mockPersonnel } from "@/lib/mock-personnel"
import type { Shift } from "@/lib/mock-shifts"

interface AssignShiftDialogProps {
  open: boolean
  shift: Shift | null
  onOpenChange: (o: boolean) => void
}

export function AssignShiftDialog({ open, shift, onOpenChange }: AssignShiftDialogProps) {
  const [selected, setSelected] = React.useState<number[]>([])

  if (!open || !shift) return null

  const toggle = (id: number) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0D2440]/20 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-sm rounded-[18px] bg-white/80 backdrop-blur-2xl border border-white/70 shadow-[0_24px_64px_rgba(46,94,153,0.18)] p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[15px] font-bold text-[#0D2440]">Assegna Turno</h2>
          <button onClick={() => onOpenChange(false)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#2E5E99]/10 transition-colors cursor-pointer">
            <X size={14} className="text-[#7BA4D0]" />
          </button>
        </div>
        <p className="text-[11px] text-[#7BA4D0] mb-3">{shift.dayLabel} · {shift.slotLabel}</p>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {mockPersonnel.filter(v => v.status === "attivo").map(v => {
            const already = shift.volunteers.some(sv => sv.id === v.id)
            const isSelected = selected.includes(v.id)
            return (
              <label
                key={v.id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-[8px] cursor-pointer transition-colors ${
                  already ? "bg-[#2E5E99]/[0.06] opacity-60" : isSelected ? "bg-[#2E5E99]/10 border border-[#2E5E99]/20" : "hover:bg-[#2E5E99]/[0.04]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={already || isSelected}
                  disabled={already}
                  onChange={() => !already && toggle(v.id)}
                  className="rounded border-[#2E5E99]/30 text-[#2E5E99] focus:ring-[#2E5E99]/20"
                />
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                  {v.firstName[0]}{v.lastName[0]}
                </div>
                <span className="text-[12px] text-[#0D2440] font-medium flex-1">{v.firstName} {v.lastName}</span>
                <span className="text-[10px] text-[#7BA4D0]">{v.role}</span>
                {already && <span className="text-[9px] text-[#2E5E99]">già assegnato</span>}
              </label>
            )
          })}
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={() => onOpenChange(false)} className="flex-1 h-9 rounded-[10px] border border-[#2E5E99]/20 text-[13px] text-[#7BA4D0] hover:bg-[#2E5E99]/5 transition-colors cursor-pointer">
            Annulla
          </button>
          <button
            onClick={() => { setSelected([]); onOpenChange(false) }}
            className="flex-1 h-9 rounded-[10px] bg-[#2E5E99] text-white text-[13px] font-semibold hover:bg-[#254E82] transition-colors shadow-sm shadow-[#2E5E99]/20 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <UserPlus size={13} />
            Assegna
          </button>
        </div>
      </div>
    </div>
  )
}
