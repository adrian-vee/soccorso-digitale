import { Card } from './ui/card'
import { Skeleton } from './ui/skeleton'
import { Activity, Truck, Navigation, AlertTriangle } from 'lucide-react'
import type { SaasMetrics } from '@/types/saas'

interface TodayStatsProps {
  metrics: SaasMetrics | null | undefined
  loading?: boolean
}

const STATS = [
  { key: 'todayServices', label: 'Servizi oggi', icon: Activity, color: 'text-sd-primary' },
  { key: 'todayKm',       label: 'Km percorsi',  icon: Navigation, color: 'text-sd-success' },
  { key: 'todayActiveVehicles', label: 'Mezzi attivi', icon: Truck, color: 'text-sd-amber' },
  { key: 'todayAlerts',   label: 'Alert attivi', icon: AlertTriangle, color: 'text-sd-danger' },
] as const

export function TodayStats({ metrics, loading }: TodayStatsProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-36 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </Card>
    )
  }

  const getValue = (key: string): string => {
    const v = (metrics as Record<string, unknown> | null | undefined)?.[key]
    if (v == null) return '--'
    const n = Number(v)
    if (key === 'todayKm') return isNaN(n) ? '--' : Math.round(n).toLocaleString('it-IT')
    return isNaN(n) ? String(v) : n.toLocaleString('it-IT')
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-sd-text">Piattaforma Oggi</h3>
        {/* Live indicator */}
        <span className="flex h-2 w-2 relative ml-1" aria-label="Aggiornamento in tempo reale">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sd-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-sd-success" />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {STATS.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="flex items-start gap-2.5">
            <div className="mt-0.5 flex-shrink-0">
              <Icon size={16} className={color} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-bold text-sd-text leading-tight">
                {getValue(key)}
              </p>
              <p className="text-[11px] text-sd-muted mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
