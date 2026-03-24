"use client"
import * as React from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import type { servicesByDay } from "@/lib/mock-analytics"

type DayData = (typeof servicesByDay)[number]

interface ServicesByDayChartProps {
  data: DayData[]
}

export function ServicesByDayChart({ data }: ServicesByDayChartProps) {
  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-4">Servizi per Giorno — Marzo 2026</h2>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-services" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2E5E99" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#2E5E99" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(46,94,153,0.06)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#7BA4D0" }} axisLine={false} tickLine={false} interval={4} />
          <YAxis tick={{ fontSize: 9, fill: "#7BA4D0" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(46,94,153,0.12)", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [v, "Servizi"]}
          />
          <Area type="monotone" dataKey="servizi" stroke="#2E5E99" strokeWidth={2} fill="url(#grad-services)" dot={false} activeDot={{ r: 4, fill: "#2E5E99" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
