import * as React from "react"
import { Activity, MapPin, Navigation, Car, DollarSign, Clock, TrendingUp, Banknote } from "lucide-react"
import type { analyticsKpis } from "@/lib/mock-analytics"

type AnalyticsKpisData = typeof analyticsKpis

interface AnalyticsKpisProps {
  data: AnalyticsKpisData
}

export function AnalyticsKpis({ data }: AnalyticsKpisProps) {
  const kpis = [
    { label: "Servizi Mese", value: data.serviziMese.toLocaleString("it-IT"), delta: data.serviziDelta, icon: Activity },
    { label: "KM Totali", value: data.kmTotali.toLocaleString("it-IT"), unit: "km", icon: MapPin },
    { label: "KM a Vuoto", value: data.kmVuoto.toLocaleString("it-IT"), unit: "km", icon: Navigation },
    { label: "KM con Paziente", value: data.kmPaziente.toLocaleString("it-IT"), unit: "km", icon: Car },
    { label: "Costo/KM", value: `€${data.costoPerKm.toFixed(2)}`, icon: DollarSign },
    { label: "Ore Volontari", value: data.oreVolontari.toLocaleString("it-IT"), unit: "h", icon: Clock },
    { label: "SLA Rispettati", value: `${data.slaPercent}%`, icon: TrendingUp },
    { label: "Ricavo Privati", value: `€${data.ricavoPrivati.toLocaleString("it-IT")}`, icon: Banknote },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="relative overflow-hidden rounded-[12px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-3.5"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-35" />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-1.5">{kpi.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[20px] font-light tracking-tight text-[#0D2440] leading-none">{kpi.value}</span>
                {kpi.unit && <span className="text-[10px] text-[#7BA4D0]/70">{kpi.unit}</span>}
              </div>
              {kpi.delta && <span className="text-[9px] text-emerald-600 font-medium">{kpi.delta} vs mese prec.</span>}
            </div>
            <div className="w-7 h-7 rounded-[8px] bg-[#2E5E99]/[0.07] flex items-center justify-center shrink-0">
              <kpi.icon size={13} className="text-[#2E5E99]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
