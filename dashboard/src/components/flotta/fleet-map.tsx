import * as React from "react"
import { cn } from "@/lib/utils"
import type { Vehicle, VehicleStatus } from "@/lib/mock-fleet"

const STATUS_PIN: Record<VehicleStatus, string> = {
  in_servizio:  "bg-[#2E5E99] shadow-[0_0_0_3px_rgba(46,94,153,0.2)]",
  attivo:       "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]",
  manutenzione: "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.2)]",
  fermo:        "bg-gray-400 shadow-[0_0_0_3px_rgba(156,163,175,0.2)]",
}

const STATUS_LABEL: Record<VehicleStatus, string> = {
  in_servizio:  "In Servizio",
  attivo:       "Attivo",
  manutenzione: "Manutenzione",
  fermo:        "Fermo",
}

interface FleetMapProps {
  fleet: Vehicle[]
}

export function FleetMap({ fleet }: FleetMapProps) {
  return (
    <div className="relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(46,94,153,0.06)] h-[320px]">
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-40 z-10" />

      {/* Map background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#dcedf8] via-[#E7F0FA] to-[#cde2f3]">
        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#2E5E99 1px, transparent 1px), linear-gradient(90deg, #2E5E99 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Road-like diagonals */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="60%" x2="100%" y2="45%" stroke="#2E5E99" strokeWidth="2" />
          <line x1="20%" y1="0" x2="35%" y2="100%" stroke="#2E5E99" strokeWidth="1.5" />
          <line x1="55%" y1="0" x2="70%" y2="100%" stroke="#2E5E99" strokeWidth="1.5" />
          <line x1="0" y1="30%" x2="100%" y2="20%" stroke="#2E5E99" strokeWidth="1" />
          <rect x="28%" y="35%" width="18%" height="12%" rx="4" fill="#2E5E99" fillOpacity="0.04" stroke="#2E5E99" strokeWidth="1" />
          <rect x="52%" y="42%" width="14%" height="10%" rx="4" fill="#2E5E99" fillOpacity="0.04" stroke="#2E5E99" strokeWidth="1" />
        </svg>
      </div>

      {/* Vehicle pins */}
      {fleet.map((v) => (
        <div
          key={v.id}
          className="absolute z-20 group cursor-pointer"
          style={{ left: v.mapX, top: v.mapY, transform: "translate(-50%, -50%)" }}
        >
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            <div className="bg-[#0D2440]/90 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-1 rounded-[6px] shadow-lg">
              <span className="font-mono font-bold">{v.id}</span> · {v.name}
              <br />
              <span className="text-[#7BA4D0]">{STATUS_LABEL[v.status]}</span>
            </div>
            <div className="w-1.5 h-1.5 bg-[#0D2440]/90 rotate-45 mx-auto -mt-[3px]" />
          </div>

          {/* Pin */}
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center",
            "text-[10px] font-bold text-white transition-transform group-hover:scale-110",
            STATUS_PIN[v.status]
          )}>
            {v.id}
          </div>

          {/* Pulse ring for in_servizio */}
          {v.status === "in_servizio" && (
            <span className="absolute inset-0 rounded-full bg-[#2E5E99]/20 animate-ping" />
          )}
        </div>
      ))}

      {/* Header badge */}
      <div className="absolute top-4 left-4 z-20 bg-white/80 backdrop-blur-sm border border-white/60 rounded-[10px] px-3 py-1.5 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-semibold text-[#0D2440]">Posizioni GPS · Live</span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-20 bg-white/80 backdrop-blur-sm border border-white/60 rounded-[10px] px-3 py-2 space-y-1.5">
        {[
          { color: "bg-[#2E5E99]", label: "In Servizio" },
          { color: "bg-emerald-500", label: "Attivo" },
          { color: "bg-amber-500", label: "Manutenzione" },
          { color: "bg-gray-400", label: "Fermo" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", l.color)} />
            <span className="text-[9px] text-[#0D2440] font-medium">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
