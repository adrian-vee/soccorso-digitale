import * as React from "react"
import { cn } from "@/lib/utils"

const FLEET = [
  { id: "AZ-001", name: "Ambulanza 1", status: "in-servizio", fuel: 78, km: 124300 },
  { id: "AZ-002", name: "Ambulanza 2", status: "disponibile", fuel: 92, km: 98700 },
  { id: "AZ-003", name: "Ambulanza 3", status: "in-servizio", fuel: 45, km: 156200 },
  { id: "AZ-004", name: "Mezzo Leggero", status: "manutenzione", fuel: 30, km: 67400 },
  { id: "AZ-005", name: "Ambulanza 5", status: "disponibile", fuel: 85, km: 43100 },
]

const STATUS_DOT: Record<string, string> = {
  "in-servizio":    "bg-[#2E5E99]",
  disponibile:      "bg-emerald-500",
  manutenzione:     "bg-amber-500",
  "fuori-servizio": "bg-red-400",
}

interface FleetItem { id?: string; code?: string; name?: string; status?: string; usage?: number; km?: number; services?: number }

export function FleetStatus({ items }: { items?: FleetItem[] }) {
  const fleet = (items && items.length > 0
    ? items.map(v => ({
        id: v.code ?? v.id ?? '',
        name: v.name ?? v.code ?? '',
        status: v.status ?? 'disponibile',
        fuel: v.usage ?? 50,
        km: v.km ?? 0,
      }))
    : FLEET)

  return (
    <div className="relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(46,94,153,0.06)]">
      {/* Accent line top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-40" />

      <div className="px-4 pt-5 pb-2">
        <p className="text-[13px] font-semibold text-[#0D2440]">Stato Flotta</p>
        <p className="text-[11px] text-[#7BA4D0]/80 mt-0.5">{fleet.length} veicoli</p>
      </div>

      <div className="px-4 pb-4 space-y-3 mt-1">
        {fleet.map((v) => (
          <div key={v.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[v.status] ?? "bg-gray-400")} />
                <span className="text-[12px] font-medium text-[#0D2440]">{v.name}</span>
                <span className="text-[10px] font-mono text-[#2E5E99]/70">{v.id}</span>
              </div>
              <span className="text-[10px] text-[#7BA4D0]">{v.fuel}%</span>
            </div>
            <div className="h-[5px] rounded-full bg-[#2E5E99]/[0.08] overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0]"
                style={{
                  width: `${v.fuel}%`,
                  opacity: v.fuel > 60 ? 1 : v.fuel > 30 ? 0.7 : 0.5,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
