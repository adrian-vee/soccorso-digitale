"use client"
import * as React from "react"
import { Plus } from "lucide-react"
import { mockFleet, mockExpiryAlerts } from "@/lib/mock-fleet"
import { FleetKpis } from "@/components/flotta/fleet-kpis"
import { FleetMap } from "@/components/flotta/fleet-map"
import { FleetStatusList } from "@/components/flotta/fleet-status"
import { VehicleCards } from "@/components/flotta/vehicle-cards"
import { ExpiryAlerts } from "@/components/flotta/expiry-alerts"
import { NewVehicleDialog } from "@/components/flotta/new-vehicle-dialog"

export default function FlottaPage() {
  const [newOpen, setNewOpen] = React.useState(false)

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[#0D2440] leading-tight">Flotta &amp; Veicoli</h1>
          <p className="text-[12px] text-[#7BA4D0] mt-0.5">Gestione veicoli, manutenzioni e scadenze</p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] bg-[#2E5E99] text-white text-[13px] font-semibold hover:bg-[#254E82] transition-colors shadow-sm shadow-[#2E5E99]/20"
        >
          <Plus size={14} />
          Nuovo Veicolo
        </button>
      </div>

      {/* KPI bar */}
      <FleetKpis fleet={mockFleet} />

      {/* Map + Status side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <FleetMap fleet={mockFleet} />
        </div>
        <div className="lg:col-span-2">
          <FleetStatusList fleet={mockFleet} />
        </div>
      </div>

      {/* Vehicle cards grid */}
      <div>
        <h2 className="text-[13px] font-bold text-[#0D2440] mb-3">Dettaglio Veicoli</h2>
        <VehicleCards fleet={mockFleet} />
      </div>

      {/* Expiry alerts */}
      <ExpiryAlerts alerts={mockExpiryAlerts} />

      {/* Dialog */}
      <NewVehicleDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
