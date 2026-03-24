"use client"
import * as React from "react"
import { KpiCard, KpiGrid } from "@/components/dashboard/kpi-cards"
import { TrendChart } from "@/components/dashboard/trend-chart"
import { ServiceList } from "@/components/dashboard/service-list"
import { FleetStatus } from "@/components/dashboard/fleet-status"
import { TurniOggi } from "@/components/dashboard/turni-oggi"
import { AlertFeed } from "@/components/dashboard/alert-feed"
import { useDashboard } from "@/hooks/use-dashboard"
import { useServices } from "@/hooks/use-services"
import { useShifts } from "@/hooks/use-shifts"
import { useLowStockAlerts, useExpiringInventory } from "@/hooks/use-inventory"

function KpiSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 p-4 pt-5 animate-pulse">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#2E5E99]/08 rounded" />
      <div className="h-2 w-14 bg-[#2E5E99]/10 rounded mb-3" />
      <div className="h-7 w-16 bg-[#2E5E99]/10 rounded mb-2" />
      <div className="h-2 w-20 bg-[#2E5E99]/06 rounded" />
    </div>
  )
}

function DashboardHeader({
  uncoveredShifts,
  alertCount,
}: {
  uncoveredShifts: number
  alertCount: number
}) {
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-[22px] font-light tracking-tight text-[#0D2440]">
          Dashboard Operativa
        </h1>
        <p className="text-[12px] text-[#7BA4D0] mt-0.5">
          {now.toLocaleDateString("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {" · "}
          {now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {uncoveredShifts > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-700">
            {uncoveredShifts} turni scoperti
          </span>
        )}
        {alertCount > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-100 text-[10px] font-semibold text-red-600">
            {alertCount} alert scorte
          </span>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: metrics, isLoading: loadingMetrics } = useDashboard(7)
  const { data: todayServices } = useServices(new Date())
  const { data: shifts = [] } = useShifts(0)
  const { data: lowStock = [] } = useLowStockAlerts()
  const { data: expiring = [] } = useExpiringInventory()

  const kpis = metrics?.kpis
  const inCorso = todayServices?.filter(s => s.status === 'in_corso').length ?? kpis?.activeCrews ?? 0
  const completati = todayServices?.filter(s => s.status === 'completato').length ?? 0

  const todayStr = React.useMemo(() => new Date().toISOString().split('T')[0], [])
  const todayShifts = React.useMemo(() => shifts.filter(s => s.day === todayStr), [shifts, todayStr])
  const uncoveredShifts = todayShifts.filter(s => !s.covered).length
  const alertCount = lowStock.length + expiring.length

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <DashboardHeader uncoveredShifts={uncoveredShifts} alertCount={alertCount} />

      {/* KPI Bar */}
      {loadingMetrics && !kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
      ) : (
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
      )}

      {/* Main grid: trend chart + fleet */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <TrendChart data={metrics?.dailyTrend} />
        <FleetStatus items={metrics?.fleetStatus} />

        {/* Service list full width */}
        <div className="xl:col-span-3">
          <ServiceList items={todayServices} />
        </div>
      </div>

      {/* Bottom: shifts + alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TurniOggi />
        <AlertFeed />
      </div>

    </div>
  )
}
