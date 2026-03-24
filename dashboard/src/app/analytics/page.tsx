"use client"
import * as React from "react"
import { FileDown, TableProperties } from "lucide-react"
import {
  analyticsKpis, servicesByDay, kmBreakdown, servicesByType,
  topRoutes, vehicleKmReport, utifReport, slaData, complianceItems
} from "@/lib/mock-analytics"
import { AnalyticsKpis } from "@/components/analytics/analytics-kpis"
import { ServicesByDayChart } from "@/components/analytics/services-by-day-chart"
import { KmBreakdownChart } from "@/components/analytics/km-breakdown-chart"
import { ServicesByTypeChart } from "@/components/analytics/services-by-type-chart"
import { TopRoutesTable } from "@/components/analytics/top-routes-table"
import { KmDetailTable } from "@/components/analytics/km-detail-table"
import { UtifReportTable } from "@/components/analytics/utif-report-table"
import { SlaCompliance } from "@/components/analytics/sla-compliance"

const PERIODI = ["Marzo 2026", "Febbraio 2026", "Q1 2026", "Anno 2026"]

export default function AnalyticsPage() {
  const [periodo, setPeriodo] = React.useState(PERIODI[0])

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-[18px] font-bold text-[#0D2440] leading-tight">Analytics &amp; Report</h1>
          <p className="text-[12px] text-[#7BA4D0] mt-0.5">Statistiche operative, KM, accise UTIF e conformità SLA</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            className="h-8 px-3 rounded-[8px] border border-white/60 bg-white/55 backdrop-blur-xl text-[12px] text-[#0D2440] focus:outline-none cursor-pointer"
          >
            {PERIODI.map(p => <option key={p}>{p}</option>)}
          </select>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#2E5E99]/20 bg-white/55 text-[12px] text-[#0D2440] hover:bg-white/70 transition-colors cursor-pointer">
            <FileDown size={12} className="text-[#7BA4D0]" />
            PDF
          </button>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[#2E5E99]/20 bg-white/55 text-[12px] text-[#0D2440] hover:bg-white/70 transition-colors cursor-pointer">
            <TableProperties size={12} className="text-[#7BA4D0]" />
            Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <AnalyticsKpis data={analyticsKpis} />

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <ServicesByDayChart data={servicesByDay} />
        </div>
        <div className="lg:col-span-2">
          <KmBreakdownChart data={kmBreakdown} />
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ServicesByTypeChart data={servicesByType} />
        <TopRoutesTable data={topRoutes} />
      </div>

      {/* KM detail table */}
      <KmDetailTable data={vehicleKmReport} />

      {/* UTIF report */}
      <UtifReportTable data={utifReport} />

      {/* SLA + compliance */}
      <SlaCompliance sla={slaData} compliance={complianceItems} />
    </div>
  )
}
