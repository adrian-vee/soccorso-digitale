import { KpiCard } from './KpiCard'
import type { SaasMetrics, Organization } from '@/types/saas'

interface KpiGridProps {
  metrics: SaasMetrics | null | undefined
  orgs: Organization[]
  loading: boolean
}

export function KpiGrid({ metrics, orgs, loading }: KpiGridProps) {
  const activeOrgs = metrics?.activeOrgs
    ?? orgs.filter((o) => !o.isSuspended && !o.isDemo).length

  const trialOrgs = metrics?.trialOrgs
    ?? orgs.filter((o) => o.isDemo || o.planId === 'trial').length

  // MRR: from metrics or estimate €99/org
  const mrr = metrics?.mrr ?? activeOrgs * 99

  const churn = metrics?.churnRate ?? 2.1

  const ltv = metrics?.avgLtv
    ?? (mrr > 0 ? Math.round(mrr / Math.max(churn / 100, 0.01) / 12) : 0)

  const newThisMonth = orgs.filter((o) => {
    if (!o.createdAt) return false
    return Date.now() - new Date(o.createdAt).getTime() < 30 * 86_400_000
  }).length

  return (
    <div
      className="grid grid-cols-5 gap-4"
      role="region"
      aria-label="KPI principali della piattaforma"
    >
      <KpiCard
        label="MRR Stimato"
        value={`€\u00A0${mrr.toLocaleString('it-IT')}`}
        subtitle="mensile ricorrente"
        accent
        loading={loading}
      />
      <KpiCard
        label="Org Attive"
        value={activeOrgs}
        subtitle="abbonamenti attivi"
        trend={newThisMonth > 0 ? `+${newThisMonth} questo mese` : undefined}
        trendDirection="up"
        loading={loading}
      />
      <KpiCard
        label="Churn Rate"
        value={`${churn}%`}
        subtitle="mensile"
        trendDirection={churn > 5 ? 'down' : 'flat'}
        loading={loading}
      />
      <KpiCard
        label="LTV Medio"
        value={`€\u00A0${ltv.toLocaleString('it-IT')}`}
        subtitle="per organizzazione"
        loading={loading}
      />
      <KpiCard
        label="In Trial"
        value={trialOrgs}
        subtitle="da convertire"
        trendDirection={trialOrgs > 0 ? 'up' : 'flat'}
        loading={loading}
      />
    </div>
  )
}
