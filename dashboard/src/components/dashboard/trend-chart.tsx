"use client"
import * as React from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const mockData = [
  { day: "Lun", servizi: 32, completati: 30, km: 420 },
  { day: "Mar", servizi: 28, completati: 26, km: 380 },
  { day: "Mer", servizi: 41, completati: 38, km: 560 },
  { day: "Gio", servizi: 35, completati: 34, km: 490 },
  { day: "Ven", servizi: 47, completati: 44, km: 640 },
  { day: "Sab", servizi: 22, completati: 21, km: 310 },
  { day: "Dom", servizi: 18, completati: 18, km: 250 },
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

export function TrendChart() {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="text-sm">Trend Operativo — Settimana</CardTitle>
        <CardDescription>Servizi programmati vs completati</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={mockData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradServizi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2E5E99" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2E5E99" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCompletati" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7BA4D0" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#7BA4D0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E5E99" strokeOpacity={0.06} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#7BA4D0" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#7BA4D0" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="servizi" name="Programmati" stroke="#2E5E99" strokeWidth={2} fill="url(#gradServizi)" dot={false} activeDot={{ r: 4, fill: "#2E5E99" }} />
            <Area type="monotone" dataKey="completati" name="Completati" stroke="#7BA4D0" strokeWidth={1.5} fill="url(#gradCompletati)" dot={false} activeDot={{ r: 4, fill: "#7BA4D0" }} strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
