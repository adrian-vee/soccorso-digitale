"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { MoreHorizontal, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import type { Volunteer, CertStatus } from "@/lib/mock-personnel"
import type { PersonnelFilters } from "./personnel-toolbar"

interface PersonnelTableProps {
  personnel: Volunteer[]
  filters: PersonnelFilters
}

const ROLE_LABELS: Record<string, string> = {
  autista: "Autista",
  soccorritore: "Soccorritore",
  centralinista: "Centralinista",
  coordinatore: "Coordinatore",
}

const ROLE_COLORS: Record<string, string> = {
  autista: "bg-[#2E5E99]/10 text-[#2E5E99]",
  soccorritore: "bg-emerald-500/10 text-emerald-700",
  centralinista: "bg-amber-500/10 text-amber-700",
  coordinatore: "bg-purple-500/10 text-purple-700",
}

const STATUS_COLORS: Record<string, string> = {
  attivo: "bg-emerald-500/10 text-emerald-700",
  inattivo: "bg-gray-400/10 text-gray-500",
  sospeso: "bg-red-500/10 text-red-600",
}

function CertBadge({ status, expiry }: { status: CertStatus; expiry: string }) {
  if (status === "valid") return (
    <span className="flex items-center gap-1 text-emerald-600 text-[11px]">
      <CheckCircle2 size={11} /> {expiry}
    </span>
  )
  if (status === "expiring") return (
    <span className="flex items-center gap-1 text-amber-600 text-[11px]">
      <AlertTriangle size={11} /> {expiry}
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-red-500 text-[11px]">
      <XCircle size={11} /> {expiry}
    </span>
  )
}

function matchesFilters(v: Volunteer, f: PersonnelFilters): boolean {
  const name = `${v.firstName} ${v.lastName}`.toLowerCase()
  if (f.search && !name.includes(f.search.toLowerCase())) return false
  if (f.role !== "Tutti" && ROLE_LABELS[v.role] !== f.role) return false
  if (f.sede !== "Tutte" && v.sede !== f.sede) return false
  if (f.certStatus !== "Tutti") {
    const certs = [v.certifications.blsd.status, v.certifications.license.status, v.certifications.safety626.status]
    if (f.certStatus === "Tutto OK" && certs.some(c => c !== "valid")) return false
    if (f.certStatus === "In Scadenza" && !certs.some(c => c === "expiring")) return false
    if (f.certStatus === "Scadute" && !certs.some(c => c === "expired")) return false
  }
  return true
}

export function PersonnelTable({ personnel, filters }: PersonnelTableProps) {
  const filtered = personnel.filter(v => matchesFilters(v, filters))
  const maxHours = Math.max(...personnel.map(v => v.hoursThisMonth), 1)

  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#2E5E99]/[0.08]">
              {["Nome", "Ruolo", "Telefono", "Ore Mese", "BLSD", "Patente", "626", "Stato", ""].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={v.id} className={cn("border-b border-[#2E5E99]/[0.05] hover:bg-[#2E5E99]/[0.02] transition-colors", i % 2 === 0 && "bg-white/20")}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                      {v.firstName[0]}{v.lastName[0]}
                    </div>
                    <span className="font-medium text-[#0D2440] whitespace-nowrap">{v.firstName} {v.lastName}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", ROLE_COLORS[v.role])}>
                    {ROLE_LABELS[v.role]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[#0D2440]/60 whitespace-nowrap">{v.phone}</td>
                <td className="px-3 py-2.5 min-w-[90px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[#0D2440] w-6 text-right shrink-0">{v.hoursThisMonth}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#2E5E99]/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0]"
                        style={{ width: `${(v.hoursThisMonth / maxHours) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <CertBadge status={v.certifications.blsd.status} expiry={v.certifications.blsd.expiry} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <CertBadge status={v.certifications.license.status} expiry={`${v.certifications.license.type} · ${v.certifications.license.expiry}`} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <CertBadge status={v.certifications.safety626.status} expiry={v.certifications.safety626.expiry} />
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", STATUS_COLORS[v.status])}>
                    {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <button className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#2E5E99]/10 transition-colors cursor-pointer">
                    <MoreHorizontal size={13} className="text-[#7BA4D0]" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-[13px] text-[#7BA4D0]">Nessun volontario trovato</div>
        )}
      </div>
    </div>
  )
}
