import * as React from "react"
import { KpiCard, KpiGrid } from "@/components/dashboard/kpi-cards"
import { TrendChart } from "@/components/dashboard/trend-chart"
import { ServiceList } from "@/components/dashboard/service-list"
import { FleetStatus } from "@/components/dashboard/fleet-status"

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPI Bar */}
      <KpiGrid>
        <KpiCard label="Servizi Oggi" value={47} unit="servizi" delta={12} deltaLabel="vs ieri" />
        <KpiCard label="Completati" value={34} unit="" delta={5} deltaLabel="questa settimana" />
        <KpiCard label="In Corso" value={8} unit="" />
        <KpiCard label="KM Oggi" value="1.284" unit="km" delta={-3} deltaLabel="vs media" />
        <KpiCard label="Veicoli Attivi" value="3/5" unit="" />
        <KpiCard label="SLA Rispettati" value="94" unit="%" delta={16} deltaLabel="vs mese scorso" />
      </KpiGrid>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Trend chart — spans 2 cols */}
        <TrendChart />

        {/* Fleet status */}
        <FleetStatus />

        {/* Service list — spans full width on xl */}
        <div className="xl:col-span-3">
          <ServiceList />
        </div>
      </div>

    </div>
  )
}
