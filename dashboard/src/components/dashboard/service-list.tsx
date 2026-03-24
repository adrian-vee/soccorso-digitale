import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const MOCK_SERVICES = [
  { id: "SD-001", time: "07:30", patient: "Rossi Mario", type: "Dialisi", vehicle: "AZ-001", status: "completato" },
  { id: "SD-002", time: "08:15", patient: "Bianchi Anna", type: "Visita", vehicle: "AZ-003", status: "in-corso" },
  { id: "SD-003", time: "09:00", patient: "Ferrari Luigi", type: "Dialisi", vehicle: "AZ-002", status: "programmato" },
  { id: "SD-004", time: "10:30", patient: "Russo Carla", type: "Dimissioni", vehicle: "AZ-005", status: "programmato" },
  { id: "SD-005", time: "11:00", patient: "Gallo Pietro", type: "Trasferimento", vehicle: "AZ-001", status: "ritardo" },
]

const STATUS_MAP = {
  completato:  { label: "Completato",  variant: "success"  as const },
  "in-corso":  { label: "In Corso",    variant: "default"  as const },
  programmato: { label: "Programmato", variant: "secondary" as const },
  ritardo:     { label: "Ritardo",     variant: "warning"  as const },
}

export function ServiceList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Programma Odierno</CardTitle>
        <CardDescription>{new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[#2E5E99]/6">
          {MOCK_SERVICES.map((s) => {
            const status = STATUS_MAP[s.status as keyof typeof STATUS_MAP]
            return (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#2E5E99]/3 transition-colors">
                <span className="text-xs font-mono text-[#7BA4D0] w-10 shrink-0">{s.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0D2440] truncate">{s.patient}</p>
                  <p className="text-xs text-[#7BA4D0]">{s.type} · {s.vehicle}</p>
                </div>
                <Badge variant={status.variant} className="shrink-0 text-[10px]">{status.label}</Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
