import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../components/PageHeader'
import { KpiGrid } from '../components/KpiGrid'
import { RevenueTrend } from '../components/RevenueTrend'
import { HealthScoreList } from '../components/HealthScoreList'
import { TodayStats } from '../components/TodayStats'
import { useSaasMetrics, useSaasHistory, useOrganizations } from '../hooks/useSaasDashboard'

export function SaasDashboard() {
  const queryClient = useQueryClient()
  const { data: metrics, isLoading: metricsLoading, dataUpdatedAt } = useSaasMetrics()
  const { data: history = [], isLoading: historyLoading } = useSaasHistory()
  const { data: orgs = [], isLoading: orgsLoading } = useOrganizations()

  const isLoading = metricsLoading || orgsLoading

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--'

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries()
  }, [queryClient])

  return (
    /* APHRODITE: sfondo #F0F4FF, padding 24px, space-y-4 */
    <div className="p-6 bg-sd-bg min-h-full space-y-4">
      <PageHeader
        lastUpdate={lastUpdate}
        onRefresh={handleRefresh}
        isRefetching={isLoading}
      />

      {/* KPI Row — 5 colonne su desktop */}
      <KpiGrid metrics={metrics} orgs={orgs} loading={isLoading} />

      {/* Charts Row — 2 colonne */}
      <div className="grid grid-cols-2 gap-4">
        <RevenueTrend
          history={history}
          loading={historyLoading}
          activeOrgsNow={metrics?.activeOrgs ?? orgs.length}
        />
        <HealthScoreList orgs={orgs} loading={orgsLoading} />
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-2 gap-4">
        <TodayStats metrics={metrics} loading={metricsLoading} />
      </div>
    </div>
  )
}
