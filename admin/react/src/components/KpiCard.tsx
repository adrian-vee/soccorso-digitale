import { Card } from './ui/card'
import { Skeleton } from './ui/skeleton'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string | number
  subtitle?: string
  trend?: string
  trendDirection?: 'up' | 'down' | 'flat'
  loading?: boolean
  accent?: boolean
}

export function KpiCard({
  label,
  value,
  subtitle,
  trend,
  trendDirection = 'flat',
  loading = false,
  accent = false,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-3 w-20 mb-3" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-24" />
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'p-5 transition-shadow hover:shadow-md',
        accent && 'border-sd-primary border-l-4'
      )}
    >
      {/* Label — 11px uppercase WCAG AA: #64748B on #FFF = 4.6:1 ✅ */}
      <p className="text-[11px] font-bold uppercase tracking-wider text-sd-muted mb-1">
        {label}
      </p>
      {/* Value — 32px bold WCAG AA: #0C1A2E on #FFF = 16.9:1 ✅ */}
      <p className="text-[32px] font-bold leading-tight text-sd-text">
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-sd-muted mt-0.5">{subtitle}</p>
      )}
      {trend && (
        <p
          className={cn(
            'text-xs font-semibold mt-1',
            trendDirection === 'up' && 'text-sd-success',
            trendDirection === 'down' && 'text-sd-danger',
            trendDirection === 'flat' && 'text-sd-muted'
          )}
          aria-label={`Trend: ${trend}`}
        >
          {trendDirection === 'up' && '↑ '}
          {trendDirection === 'down' && '↓ '}
          {trend}
        </p>
      )}
    </Card>
  )
}
