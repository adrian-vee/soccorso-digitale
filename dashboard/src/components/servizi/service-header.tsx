"use client"
import * as React from "react"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

function formatDate(date: Date): string {
  return date.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

interface ServiceHeaderProps {
  date: Date
  onDateChange: (d: Date) => void
}

export function ServiceHeader({ date, onDateChange }: ServiceHeaderProps) {
  const today = new Date()
  const isToday = isSameDay(date, today)

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      {/* Date nav */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onDateChange(addDays(date, -1))}
          className="w-8 h-8 rounded-[9px] flex items-center justify-center bg-white/50 border border-white/60 text-[#7BA4D0] hover:text-[#2E5E99] hover:bg-white/70 transition-all"
          aria-label="Giorno precedente"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-2 px-4 py-2 bg-white/55 backdrop-blur-xl border border-white/60 rounded-[12px] shadow-sm">
          <Calendar size={14} className="text-[#7BA4D0] shrink-0" />
          <span className="text-[14px] font-semibold text-[#0D2440] capitalize select-none">
            {formatDate(date)}
          </span>
        </div>

        <button
          onClick={() => onDateChange(addDays(date, 1))}
          className="w-8 h-8 rounded-[9px] flex items-center justify-center bg-white/50 border border-white/60 text-[#7BA4D0] hover:text-[#2E5E99] hover:bg-white/70 transition-all"
          aria-label="Giorno successivo"
        >
          <ChevronRight size={16} />
        </button>

        {!isToday && (
          <button
            onClick={() => onDateChange(new Date())}
            className="px-3 py-1.5 rounded-[9px] bg-[#2E5E99] text-white text-[12px] font-medium hover:bg-[#254E82] transition-colors ml-1"
          >
            Oggi
          </button>
        )}
      </div>

      {/* Right: day label */}
      <div className="flex items-center gap-2">
        <span className={cn(
          "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide",
          isToday
            ? "bg-[#2E5E99]/[0.08] text-[#2E5E99]"
            : "bg-[#7BA4D0]/[0.10] text-[#7BA4D0]"
        )}>
          {isToday ? "OGGI" : isSameDay(date, addDays(today, 1)) ? "DOMANI" : isSameDay(date, addDays(today, -1)) ? "IERI" : "ALTRO GIORNO"}
        </span>
      </div>
    </div>
  )
}
