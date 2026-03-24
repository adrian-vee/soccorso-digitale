"use client"
import * as React from "react"
import { type Service, type ServiceStatus, type ServiceType } from "@/lib/mock-services"
import { ServiceHeader } from "@/components/servizi/service-header"
import { ServiceKpis } from "@/components/servizi/service-kpis"
import { ServiceToolbar } from "@/components/servizi/service-toolbar"
import { ServiceTable } from "@/components/servizi/service-table"
import { UploadPDFDialog } from "@/components/servizi/upload-pdf-dialog"
import { NewServiceDialog } from "@/components/servizi/new-service-dialog"
import { useServices } from "@/hooks/use-services"

interface Filters {
  search: string
  status: ServiceStatus | "tutti"
  tipo: ServiceType | "tutti"
  sede: string
  vehicle: string
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "tutti",
  tipo: "tutti",
  sede: "Tutte le sedi",
  vehicle: "Tutti i mezzi",
}

export default function ServiziPage() {
  const [date, setDate] = React.useState<Date>(new Date())
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS)
  const { data: apiServices = [] } = useServices(date)
  const [overrides, setOverrides] = React.useState<Record<number, Partial<Service>>>({})

  // Merge API data with local overrides
  const services: Service[] = apiServices.map(s => ({ ...s, ...overrides[s.id] }))
  const [view, setView] = React.useState<"list" | "grid">("list")
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [newOpen, setNewOpen] = React.useState(false)

  /* Filter logic */
  const filtered = services.filter((s) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !s.patient.toLowerCase().includes(q) &&
        !s.origin.toLowerCase().includes(q) &&
        !s.destination.toLowerCase().includes(q)
      ) return false
    }
    if (filters.status !== "tutti" && s.status !== filters.status) return false
    if (filters.tipo !== "tutti" && s.type !== filters.tipo) return false
    if (filters.sede !== "Tutte le sedi" && s.sede !== filters.sede) return false
    if (filters.vehicle !== "Tutti i mezzi" && s.vehicle !== filters.vehicle) return false
    return true
  })

  function handleServiceUpdate(id: number, patch: Partial<Service>) {
    setOverrides(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Date navigation header */}
      <ServiceHeader date={date} onDateChange={setDate} />

      {/* KPI bar */}
      <ServiceKpis services={filtered} />

      {/* Toolbar */}
      <ServiceToolbar
        filters={filters}
        onFiltersChange={setFilters}
        view={view}
        onViewChange={setView}
        onUploadClick={() => setUploadOpen(true)}
        onNewClick={() => setNewOpen(true)}
      />

      {/* Table */}
      <ServiceTable services={filtered} onServiceUpdate={handleServiceUpdate} />

      {/* Dialogs */}
      <UploadPDFDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <NewServiceDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
