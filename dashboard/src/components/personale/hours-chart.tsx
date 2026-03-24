"use client"
import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { Volunteer } from "@/lib/mock-personnel"

interface HoursChartProps {
  personnel: Volunteer[]
}

export function HoursChart({ personnel }: HoursChartProps) {
  const data = [...personnel]
    .sort((a, b) => b.hoursThisMonth - a.hoursThisMonth)
    .slice(0, 10)
    .map(v => ({
      name: `${v.lastName} ${v.firstName[0]}.`,
      ore: v.hoursThisMonth,
    }))

  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-4">Ore Volontari — Top 10</h2>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: "#7BA4D0" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#0D2440" }} width={80} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(46,94,153,0.12)", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [`${v}h`, "Ore"]}
          />
          <Bar dataKey="ore" radius={[0, 4, 4, 0]} maxBarSize={16}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#2E5E99" : `rgba(46,94,153,${0.75 - i * 0.06})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
