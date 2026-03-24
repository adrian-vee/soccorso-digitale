import * as React from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  delta?: number
  deltaLabel?: string
  accent?: boolean
  className?: string
}

export function KpiCard({ label, value, unit, delta, deltaLabel, className }: KpiCardProps) {
  const positive = delta != null && delta > 0
  const negative = delta != null && delta < 0

  return (
    <div className={cn(
      "relative overflow-hidden rounded-[14px]",
      "bg-white/55 backdrop-blur-xl border border-white/60",
      "shadow-[0_2px_12px_rgba(46,94,153,0.06)]",
      className
    )}>
      {/* Accent line top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-40" />

      <div className="p-4 pt-5">
        <p className="text-[8.5px] font-semibold uppercase tracking-[0.10em] text-[#7BA4D0] mb-2.5">{label}</p>
        <div className="flex items-baseline gap-1 mb-1.5">
          <span className="text-[26px] font-light tracking-tight text-[#0D2440] leading-none">
            {value}
          </span>
          {unit && (
            <span className="text-[11px] text-[#7BA4D0]/70 mb-0.5">{unit}</span>
          )}
        </div>
        {delta != null && (
          <div className="flex items-center gap-1">
            {positive && <TrendingUp size={10} className="text-emerald-500" />}
            {negative && <TrendingDown size={10} className="text-red-400" />}
            {!positive && !negative && <Minus size={10} className="text-[#7BA4D0]" />}
            <span className={cn(
              "text-[9.5px] font-medium",
              positive ? "text-emerald-600" : negative ? "text-red-500" : "text-[#7BA4D0]"
            )}>
              {delta > 0 ? "+" : ""}{delta}% {deltaLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3", className)}>
      {children}
    </div>
  )
}
