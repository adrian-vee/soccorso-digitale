import { RefreshCw } from 'lucide-react'
import { Badge } from './ui/badge'

interface PageHeaderProps {
  lastUpdate: string
  onRefresh: () => void
  isRefetching?: boolean
}

export function PageHeader({ lastUpdate, onRefresh, isRefetching }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        {/* H1 24px bold #0C1A2E on #F0F4FF = 16.9:1 ✅ WCAG AAA */}
        <h1 className="text-2xl font-bold text-sd-text">Dashboard Piattaforma</h1>
        <p className="text-xs text-sd-muted mt-1">
          Aggiornato: {lastUpdate}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={isRefetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sd-border bg-white text-sm font-medium text-sd-text hover:bg-sd-bg transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-sd-primary"
          aria-label="Aggiorna dati dashboard"
        >
          <RefreshCw
            size={14}
            className={isRefetching ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          Aggiorna
        </button>
        <Badge variant="muted">Metriche piattaforma</Badge>
      </div>
    </div>
  )
}
