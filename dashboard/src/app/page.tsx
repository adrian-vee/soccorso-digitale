"use client"
import * as React from "react"
import { KpiCard, KpiGrid } from "@/components/dashboard/kpi-cards"
import { TrendChart } from "@/components/dashboard/trend-chart"
import { ServiceList } from "@/components/dashboard/service-list"
import { FleetStatus } from "@/components/dashboard/fleet-status"
import { useDashboard } from "@/hooks/use-dashboard"
import { useServices } from "@/hooks/use-services"

export default function DashboardPage() {
  const { data: metrics } = useDashboard(7)
  const { data: todayServices } = useServices(new Date())

  const kpis = metrics?.kpis
  const inCorso = todayServices?.filter(s => s.status === 'in_corso').length ?? kpis?.activeCrews ?? 0
  const completati = todayServices?.filter(s => s.status === 'completato').length ?? 0

  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPI Bar */}
      <KpiGrid>
        <KpiCard
          label="Servizi (7gg)"
          value={kpis?.totalServices ?? 47}
          unit="servizi"
          delta={kpis?.servicesChange}
          deltaLabel="vs periodo prec."
        />
        <KpiCard
          label="Completati Oggi"
          value={completati || (todayServices?.length ?? 34)}
          unit=""
        />
        <KpiCard
          label="In Corso"
          value={inCorso || 8}
          unit=""
        />
        <KpiCard
          label="KM (7gg)"
          value={kpis ? Math.round(kpis.totalKm).toLocaleString("it-IT") : "1.284"}
          unit="km"
          delta={kpis?.kmChange}
          deltaLabel="vs periodo prec."
        />
        <KpiCard
          label="Veicoli Attivi"
          value={kpis?.activeVehicles ?? 3}
          unit=""
        />
        <KpiCard
          label="KM Medi/Servizio"
          value={kpis ? Math.round(kpis.avgKmPerService) : 94}
          unit="km"
          delta={kpis?.avgKmChange}
          deltaLabel="vs periodo prec."
        />
      </KpiGrid>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Trend chart — spans 2 cols */}
        <TrendChart data={metrics?.dailyTrend} />

        {/* Fleet status */}
        <FleetStatus items={metrics?.fleetStatus} />

        {/* Service list — spans full width on xl */}
        <div className="xl:col-span-3">
          <ServiceList items={todayServices} />
        </div>
      </div>

    </div>
  )
}
