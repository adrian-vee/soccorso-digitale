"use client"
import * as React from "react"
import { Plus } from "lucide-react"
import { usePersonnel } from "@/hooks/use-personnel"
import { PersonnelKpis } from "@/components/personale/personnel-kpis"
import { PersonnelToolbar, type PersonnelFilters } from "@/components/personale/personnel-toolbar"
import { PersonnelTable } from "@/components/personale/personnel-table"
import { CertExpiryAlerts } from "@/components/personale/cert-expiry-alerts"
import { HoursChart } from "@/components/personale/hours-chart"
import { NewVolunteerDialog } from "@/components/personale/new-volunteer-dialog"

export default function PersonalePage() {
  const [newOpen, setNewOpen] = React.useState(false)
  const { data: personnel = [] } = usePersonnel()
  const [filters, setFilters] = React.useState<PersonnelFilters>({
    search: "", role: "Tutti", sede: "Tutte", certStatus: "Tutti",
  })

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[#0D2440] leading-tight">Personale &amp; Volontari</h1>
          <p className="text-[12px] text-[#7BA4D0] mt-0.5">Registro elettronico, certificazioni e ore</p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-[#2E5E99] text-white text-[13px] font-semibold hover:bg-[#254E82] transition-colors shadow-sm shadow-[#2E5E99]/20 cursor-pointer"
        >
          <Plus size={14} />
          Nuovo Volontario
        </button>
      </div>

      {/* KPIs */}
      <PersonnelKpis personnel={personnel} />

      {/* Toolbar */}
      <PersonnelToolbar filters={filters} onChange={setFilters} />

      {/* Table */}
      <PersonnelTable personnel={personnel} filters={filters} />

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CertExpiryAlerts personnel={personnel} />
        <HoursChart personnel={personnel} />
      </div>

      <NewVolunteerDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
