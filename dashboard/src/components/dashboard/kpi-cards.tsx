import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
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

export function KpiCard({ label, value, unit, delta, deltaLabel, accent, className }: KpiCardProps) {
  const positive = delta != null && delta > 0
  const negative = delta != null && delta < 0

  return (
    <Card className={cn("relative overflow-hidden", accent && "bg-[#2E5E99] border-[#2E5E99]", className)}>
      {accent && <div className="absolute inset-0 bg-gradient-to-br from-[#2E5E99] to-[#1A3F6F]" />}
      <CardContent className="relative p-4">
        <p className={cn("text-xs font-medium mb-2", accent ? "text-[#7BA4D0]" : "text-[#7BA4D0]")}>{label}</p>
        <div className="flex items-baseline gap-1 mb-1">
          <span className={cn("text-2xl font-light tracking-tight", accent ? "text-white" : "text-[#0D2440]")}>
            {value}
          </span>
          {unit && (
            <span className={cn("text-xs", accent ? "text-[#7BA4D0]" : "text-[#7BA4D0]")}>{unit}</span>
          )}
        </div>
        {delta != null && (
          <div className="flex items-center gap-1">
            {positive && <TrendingUp size={11} className="text-emerald-500" />}
            {negative && <TrendingDown size={11} className="text-red-400" />}
            {!positive && !negative && <Minus size={11} className="text-[#7BA4D0]" />}
            <span className={cn(
              "text-[10px] font-medium",
              positive ? "text-emerald-600" : negative ? "text-red-500" : "text-[#7BA4D0]"
            )}>
              {delta > 0 ? "+" : ""}{delta}% {deltaLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3", className)}>
      {children}
    </div>
  )
}
