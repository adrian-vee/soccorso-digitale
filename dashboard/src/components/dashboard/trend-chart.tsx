"use client"
import * as React from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const mockData = [
  { day: "Lun", servizi: 32, completati: 30 },
  { day: "Mar", servizi: 28, completati: 26 },
  { day: "Mer", servizi: 41, completati: 38 },
  { day: "Gio", servizi: 35, completati: 34 },
  { day: "Ven", servizi: 47, completati: 44 },
  { day: "Sab", servizi: 22, completati: 21 },
  { day: "Dom", servizi: 18, completati: 18 },
]

interface CustomTooltipProps { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/90 backdrop-blur-sm border border-[#2E5E99]/10 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-[#0D2440] mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span className="text-[#7BA4D0]">{p.name}</span>
          <span className="font-medium text-[#0D2440]">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

interface TrendPoint { day?: string; date?: string; servizi?: number; services?: number; completati?: number; km?: number }

export function TrendChart({ data }: { data?: TrendPoint[] }) {
  const chartData = (data && data.length > 0 ? data : mockData).map((p) => ({
    day: p.day ?? p.date?.slice(8) ?? '',
    servizi: p.servizi ?? p.services ?? 0,
    completati: p.completati ?? Math.round((p.servizi ?? p.services ?? 0) * 0.92),
  }))

  return (
    <div className="relative col-span-2 overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(46,94,153,0.06)]">
      {/* Accent line top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-40" />

      <div className="px-5 pt-5 pb-2">
        <p className="text-[13px] font-semibold text-[#0D2440]">Trend Operativo — Settimana</p>
        <p className="text-[11px] text-[#7BA4D0]/80 mt-0.5">Servizi programmati vs completati</p>
      </div>

      <div className="px-4 pb-4">
        <ResponsiveContainer width="100%" height={168}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradServizi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2E5E99" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#2E5E99" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCompletati" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7BA4D0" stopOpacity={0.10} />
                <stop offset="95%" stopColor="#7BA4D0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(46,94,153,0.06)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#7BA4D0" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#7BA4D0" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="servizi"
              name="Programmati"
              stroke="#2E5E99"
              strokeWidth={2}
              fill="url(#gradServizi)"
              dot={false}
              activeDot={{ r: 4, fill: "#2E5E99", strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="completati"
              name="Completati"
              stroke="#7BA4D0"
              strokeWidth={1.5}
              fill="url(#gradCompletati)"
              dot={false}
              activeDot={{ r: 4, fill: "#7BA4D0", strokeWidth: 0 }}
              strokeDasharray="4 2"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
