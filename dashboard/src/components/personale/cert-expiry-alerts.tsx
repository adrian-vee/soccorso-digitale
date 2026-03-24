import * as React from "react"
import { AlertTriangle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Volunteer } from "@/lib/mock-personnel"

interface CertExpiryAlertsProps {
  personnel: Volunteer[]
}

interface Alert {
  name: string
  cert: string
  expiry: string
  daysLeft: number
  expired: boolean
}

export function CertExpiryAlerts({ personnel }: CertExpiryAlertsProps) {
  const alerts: Alert[] = []

  personnel.forEach(v => {
    const name = `${v.firstName} ${v.lastName}`
    const { blsd, license, safety626 } = v.certifications
    if (blsd.status !== "valid") alerts.push({ name, cert: "BLSD", expiry: blsd.expiry, daysLeft: blsd.daysLeft, expired: blsd.status === "expired" })
    if (license.status !== "valid") alerts.push({ name, cert: `Patente ${license.type}`, expiry: license.expiry, daysLeft: license.daysLeft, expired: license.status === "expired" })
    if (safety626.status !== "valid") alerts.push({ name, cert: "Form. 626", expiry: safety626.expiry, daysLeft: safety626.daysLeft, expired: safety626.status === "expired" })
  })

  alerts.sort((a, b) => a.daysLeft - b.daysLeft)

  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-3">Scadenze Certificazioni</h2>
      {alerts.length === 0 ? (
        <p className="text-[12px] text-[#7BA4D0]/70">Nessuna scadenza imminente</p>
      ) : (
        <div className="space-y-1.5">
          {alerts.map((a, i) => (
            <div key={i} className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-[8px]",
              a.expired ? "bg-red-500/[0.07] border border-red-500/15" : "bg-amber-500/[0.07] border border-amber-500/15"
            )}>
              {a.expired
                ? <XCircle size={12} className="text-red-500 shrink-0" />
                : <AlertTriangle size={12} className="text-amber-600 shrink-0" />
              }
              <span className="text-[12px] font-medium text-[#0D2440] flex-1 truncate">{a.name}</span>
              <span className="text-[11px] text-[#7BA4D0]">{a.cert}</span>
              <span className={cn("text-[11px] font-medium", a.expired ? "text-red-500" : "text-amber-600")}>
                {a.expired ? `Scaduto ${a.expiry}` : `${a.daysLeft}gg`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
