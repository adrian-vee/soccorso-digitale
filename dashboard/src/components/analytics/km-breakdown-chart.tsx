"use client"
import * as React from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { kmBreakdown } from "@/lib/mock-analytics"

type KmData = (typeof kmBreakdown)[number]

interface KmBreakdownChartProps {
  data: KmData[]
}

export function KmBreakdownChart({ data }: KmBreakdownChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-2">KM Breakdown</h2>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(46,94,153,0.12)", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [`${v.toLocaleString("it-IT")} km (${Math.round(v / total * 100)}%)`, ""]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 mt-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
              <span className="text-[#0D2440]/70">{d.name}</span>
            </div>
            <span className="font-medium text-[#0D2440]">{Math.round(d.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
