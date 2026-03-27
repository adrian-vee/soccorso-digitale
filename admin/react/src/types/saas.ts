export interface SaasMetrics {
  id?: number
  metricDate?: string
  totalOrgs: number
  activeOrgs: number
  trialOrgs: number
  churnedOrgs: number
  totalUsersAllOrgs: number
  totalVehiclesAllOrgs: number
  totalTripsAllOrgs: number
  avgTripsPerOrg: number
  avgHealthScore: number
  atRiskOrgs: number
  mrr?: number
  mrrGrowth?: number
  churnRate?: number
  mrrTrend?: number[]
  avgLtv?: number
}

export interface Organization {
  id: number
  name: string
  status: string
  healthScore?: number
  planId?: string
  isDemo?: boolean
  isSuspended?: boolean
  enabledModules?: string[]
  createdAt?: string
  mrr?: number
}

export interface MetricsHistory {
  metricDate: string
  activeOrgs: number
  mrr?: number
}
