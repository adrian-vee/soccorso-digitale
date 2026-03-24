import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'

export interface DashboardKpis {
  totalServices: number
  servicesChange: number
  totalKm: number
  kmChange: number
  avgDuration: number
  durationChange: number
  avgKmPerService: number
  avgKmChange: number
  activeVehicles: number
  activeCrews: number
}

export interface DailyTrendPoint {
  date: string
  services: number
  km: number
}

export interface FleetStatusItem {
  id: string
  code: string
  name?: string
  location: string
  services: number
  km: number
  usage: number
}

export interface DashboardMetrics {
  kpis: DashboardKpis
  dailyTrend: DailyTrendPoint[]
  fleetStatus: FleetStatusItem[]
}

const DAYS_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function dayLabel(dateStr: string) {
  const d = new Date(dateStr)
  // getDay() returns 0=Sun..6=Sat, remap to 0=Mon..6=Sun
  const idx = d.getDay() === 0 ? 6 : d.getDay() - 1
  return DAYS_LABELS[idx] ?? dateStr.slice(5)
}

export function useDashboard(days: 7 | 30 | 90 = 7) {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics', days],
    queryFn: async () => {
      const { data } = await apiClient.get(`/dashboard/metrics?days=${days}`)
      return data
    },
    select: (data) => ({
      ...data,
      dailyTrend: (data.dailyTrend ?? []).map((p) => ({
        ...p,
        day: dayLabel(p.date),
      })),
    }),
  })
}
