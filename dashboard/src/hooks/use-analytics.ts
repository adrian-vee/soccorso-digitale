import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import {
  analyticsKpis, servicesByDay, kmBreakdown, servicesByType,
  topRoutes, vehicleKmReport, utifReport, slaData, complianceItems
} from '@/lib/mock-analytics'

// Parse "Marzo 2026", "Q1 2026", "Anno 2026" → {dateFrom, dateTo, days}
function parsePeriod(periodo: string): { dateFrom: string; dateTo: string; days: number } {
  const months: Record<string, number> = {
    Gennaio: 1, Febbraio: 2, Marzo: 3, Aprile: 4, Maggio: 5, Giugno: 6,
    Luglio: 7, Agosto: 8, Settembre: 9, Ottobre: 10, Novembre: 11, Dicembre: 12,
  }
  const now = new Date()

  if (periodo.startsWith('Anno')) {
    const year = parseInt(periodo.split(' ')[1]) || now.getFullYear()
    return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31`, days: 365 }
  }
  if (periodo.startsWith('Q')) {
    const q = parseInt(periodo[1])
    const year = parseInt(periodo.split(' ')[1]) || now.getFullYear()
    const startMonth = (q - 1) * 3 + 1
    const endMonth = startMonth + 2
    const pad = (n: number) => String(n).padStart(2, '0')
    const daysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate()
    return {
      dateFrom: `${year}-${pad(startMonth)}-01`,
      dateTo: `${year}-${pad(endMonth)}-${daysInMonth(endMonth, year)}`,
      days: 90,
    }
  }
  // "Marzo 2026"
  const parts = periodo.split(' ')
  const month = months[parts[0]]
  const year = parseInt(parts[1]) || now.getFullYear()
  if (month) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const lastDay = new Date(year, month, 0).getDate()
    return { dateFrom: `${year}-${pad(month)}-01`, dateTo: `${year}-${pad(month)}-${lastDay}`, days: lastDay }
  }
  return { dateFrom: '', dateTo: '', days: 30 }
}

export function useAnalyticsDashboard(periodo: string) {
  const { dateFrom, dateTo, days } = parsePeriod(periodo)

  return useQuery({
    queryKey: ['analytics-dashboard', periodo],
    queryFn: async () => {
      try {
        const params = dateFrom && dateTo
          ? `dateFrom=${dateFrom}&dateTo=${dateTo}`
          : `days=${days}`
        const { data } = await apiClient.get(`/dashboard/metrics?${params}`)
        return data
      } catch {
        return null
      }
    },
    staleTime: 120_000,
  })
}

export function useAnalyticsTrips(periodo: string) {
  const { dateFrom, dateTo } = parsePeriod(periodo)

  return useQuery({
    queryKey: ['analytics-trips', periodo],
    queryFn: async () => {
      try {
        const params = dateFrom ? `startDate=${dateFrom}` : ''
        const { data } = await apiClient.get(`/trips?${params}`)
        return Array.isArray(data) ? data : []
      } catch {
        return []
      }
    },
    staleTime: 120_000,
    enabled: !!dateFrom,
  })
}

// Derived analytics computed from dashboard metrics
export function useAnalytics(periodo: string) {
  const { data: metrics } = useAnalyticsDashboard(periodo)

  return useQuery({
    queryKey: ['analytics-computed', periodo, !!metrics],
    queryFn: async () => {
      if (!metrics) {
        return { kpis: analyticsKpis, servicesByDay, kmBreakdown, servicesByType, topRoutes, vehicleKmReport, utifReport, slaData, complianceItems }
      }

      const kpis = {
        ...analyticsKpis,
        serviziMese: metrics.kpis?.totalServices ?? analyticsKpis.serviziMese,
        kmTotali: metrics.kpis?.totalKm ?? analyticsKpis.kmTotali,
      }

      const sByDay = (metrics.dailyTrend ?? []).map((p: any) => ({
        day: p.date?.slice(8) ?? p.day ?? '',
        servizi: p.services ?? 0,
        km: p.km ?? 0,
      }))

      const kmBd = (metrics.fleetStatus ?? []).map((v: any) => ({
        vehicle: v.code ?? v.name,
        km: v.km ?? 0,
        services: v.services ?? 0,
      }))

      return {
        kpis,
        servicesByDay: sByDay.length > 0 ? sByDay : servicesByDay,
        kmBreakdown: kmBd.length > 0 ? kmBd : kmBreakdown,
        servicesByType,
        topRoutes,
        vehicleKmReport: metrics.fleetStatus?.length > 0
          ? metrics.fleetStatus.map((v: any) => ({ vehicle: v.code ?? v.name, km: v.km ?? 0, services: v.services ?? 0, avgKm: v.km && v.services ? Math.round(v.km / v.services) : 0 }))
          : vehicleKmReport,
        utifReport,
        slaData,
        complianceItems,
      }
    },
    enabled: true,
  })
}
