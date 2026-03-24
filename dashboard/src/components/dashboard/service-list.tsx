import * as React from "react"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  completato:  { label: "Completato",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "in-corso":  { label: "In Corso",    cls: "bg-[#2E5E99]/[0.08] text-[#2E5E99] border-[#2E5E99]/20" },
  programmato: { label: "Programmato", cls: "bg-[#7BA4D0]/[0.10] text-[#7BA4D0] border-[#7BA4D0]/20" },
  ritardo:     { label: "Ritardo",     cls: "bg-amber-50 text-amber-700 border-amber-200" },
}

interface ServiceItem { id: string | number; time?: string; departureTime?: string; patient?: string; patientName?: string; type?: string; serviceType?: string; vehicle?: string | null; vehicleLabel?: string | null; vehicleCode?: string | null; status?: string }

const MOCK_SERVICES: ServiceItem[] = [
  { id: "SD-001", time: "07:30", patient: "Rossi Mario", type: "Dialisi", vehicle: "AZ-001", status: "completato" },
  { id: "SD-002", time: "08:15", patient: "Bianchi Anna", type: "Visita", vehicle: "AZ-003", status: "in-corso" },
  { id: "SD-003", time: "09:00", patient: "Ferrari Luigi", type: "Dialisi", vehicle: "AZ-002", status: "programmato" },
  { id: "SD-004", time: "10:30", patient: "Russo Carla", type: "Dimissioni", vehicle: "AZ-005", status: "programmato" },
  { id: "SD-005", time: "11:00", patient: "Gallo Pietro", type: "Trasferimento", vehicle: "AZ-001", status: "ritardo" },
]

export function ServiceList({ items }: { items?: ServiceItem[] }) {
  const services = (items && items.length > 0 ? items : MOCK_SERVICES).slice(0, 8)

  return (
    <div className="relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(46,94,153,0.06)]">
      {/* Accent line top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-40" />

      <div className="px-5 pt-5 pb-3">
        <p className="text-[13px] font-semibold text-[#0D2440]">Programma Odierno</p>
        <p className="text-[11px] text-[#7BA4D0]/80 mt-0.5">
          {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="px-3 pb-3 space-y-1.5">
        {services.map((s) => {
          const normalized = {
            id: s.id,
            time: s.time ?? s.departureTime ?? '--:--',
            patient: s.patient ?? s.patientName ?? 'N/D',
            type: s.type ?? s.serviceType ?? '',
            vehicle: s.vehicle ?? s.vehicleLabel ?? s.vehicleCode ?? '',
            status: s.status ?? 'programmato',
          }
          const status = STATUS_STYLE[normalized.status] ?? STATUS_STYLE.programmato
          return (
            <div
              key={normalized.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] bg-white/40 border border-white/50 hover:bg-white/60 transition-colors"
            >
              <span className="text-[11px] font-mono text-[#7BA4D0] w-10 shrink-0">{normalized.time}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#0D2440] truncate">{normalized.patient}</p>
                <p className="text-[11px] text-[#7BA4D0]">{normalized.type}</p>
              </div>
              {/* Vehicle badge */}
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#2E5E99]/[0.07] border border-[#2E5E99]/[0.12] text-[10px] font-mono text-[#2E5E99]/80">
                {normalized.vehicle}
              </span>
              {/* Status badge */}
              <span className={cn(
                "shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-medium",
                status.cls
              )}>
                {status.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
