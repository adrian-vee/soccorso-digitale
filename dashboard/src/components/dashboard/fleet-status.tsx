import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const FLEET = [
  { id: "AZ-001", name: "Ambulanza 1", status: "in-servizio", fuel: 78, km: 124300 },
  { id: "AZ-002", name: "Ambulanza 2", status: "disponibile", fuel: 92, km: 98700 },
  { id: "AZ-003", name: "Ambulanza 3", status: "in-servizio", fuel: 45, km: 156200 },
  { id: "AZ-004", name: "Mezzo Leggero", status: "manutenzione", fuel: 30, km: 67400 },
  { id: "AZ-005", name: "Ambulanza 5", status: "disponibile", fuel: 85, km: 43100 },
]

const STATUS_COLORS: Record<string, string> = {
  "in-servizio":    "bg-[#2E5E99]",
  disponibile:      "bg-emerald-500",
  manutenzione:     "bg-amber-500",
  "fuori-servizio": "bg-red-400",
}

export function FleetStatus() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Stato Flotta</CardTitle>
        <CardDescription>5 veicoli · 2 in servizio</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {FLEET.map((v) => (
          <div key={v.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_COLORS[v.status] ?? "bg-gray-400")} />
                <span className="text-xs font-medium text-[#0D2440]">{v.name}</span>
                <span className="text-[10px] text-[#7BA4D0]">{v.id}</span>
              </div>
              <span className="text-[10px] text-[#7BA4D0]">{v.fuel}%</span>
            </div>
            <div className="h-1 rounded-full bg-[#2E5E99]/10 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  v.fuel > 60 ? "bg-[#2E5E99]" : v.fuel > 30 ? "bg-amber-500" : "bg-red-400"
                )}
                style={{ width: `${v.fuel}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
