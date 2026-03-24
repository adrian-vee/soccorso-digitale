"use client"
import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { servicesByType } from "@/lib/mock-analytics"

type ServiceType = (typeof servicesByType)[number]

interface ServicesByTypeChartProps {
  data: ServiceType[]
}

const COLORS = ["#2E5E99", "#4A7EC0", "#7BA4D0", "#A8C3E4", "#C9DDED"]

export function ServicesByTypeChart({ data }: ServicesByTypeChartProps) {
  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-4">Servizi per Tipo</h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 9, fill: "#7BA4D0" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: "#0D2440" }} width={88} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "rgba(255,255,255,0.9)", border: "1px solid rgba(46,94,153,0.12)", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [v, "Servizi"]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={14}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
