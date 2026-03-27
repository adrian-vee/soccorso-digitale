import { Card } from './ui/card'
import { Skeleton } from './ui/skeleton'
import { Badge } from './ui/badge'
import type { Organization } from '@/types/saas'

interface HealthScoreListProps {
  orgs: Organization[]
  loading?: boolean
}

function scoreColor(score: number): string {
  if (score >= 80) return '#10B981'
  if (score >= 55) return '#F59E0B'
  return '#EF4444'
}

function scoreVariant(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success'
  if (score >= 55) return 'warning'
  return 'danger'
}

export function HealthScoreList({ orgs, loading }: HealthScoreListProps) {
  const displayed = orgs.slice(0, 8)

  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-2 w-24" />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </Card>
    )
  }

  if (!displayed.length) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-sd-text mb-4">
          Health Score per Organizzazione
        </h3>
        <p className="text-sm text-sd-muted text-center py-8">
          Nessuna organizzazione disponibile
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-sd-text mb-4">
        Health Score per Organizzazione
      </h3>
      <ul className="space-y-3" role="list" aria-label="Lista health score organizzazioni">
        {displayed.map((org) => {
          const score = org.healthScore ?? 0
          const color = scoreColor(score)
          const variant = scoreVariant(score)
          return (
            <li key={org.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm font-medium text-sd-text truncate min-w-0">
                {org.name}
              </span>
              {/* Progress bar — accessible with aria-label */}
              <div
                className="w-24 h-1.5 bg-sd-border rounded-full overflow-hidden flex-shrink-0"
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${org.name}: ${score}%`}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, backgroundColor: color }}
                />
              </div>
              <Badge variant={variant} className="flex-shrink-0 min-w-[44px] justify-center">
                {score}%
              </Badge>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
