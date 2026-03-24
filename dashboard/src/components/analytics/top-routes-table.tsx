import * as React from "react"
import type { topRoutes } from "@/lib/mock-analytics"

type RouteRow = (typeof topRoutes)[number]

interface TopRoutesTableProps {
  data: RouteRow[]
}

export function TopRoutesTable({ data }: TopRoutesTableProps) {
  const max = Math.max(...data.map(r => r.count))
  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-3">Top 5 Tratte</h2>
      <div className="space-y-2">
        {data.map((r, i) => (
          <div key={i} className="space-y-0.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-[#0D2440] font-medium">{i + 1}. {r.route}</span>
              <span className="text-[#7BA4D0] font-semibold">{r.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#2E5E99]/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0]"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
