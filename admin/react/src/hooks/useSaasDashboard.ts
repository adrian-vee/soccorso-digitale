import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'
import type { SaasMetrics, Organization, MetricsHistory } from '../types/saas'

export function useSaasMetrics() {
  return useQuery({
    queryKey: ['saas-metrics'],
    queryFn: () => fetchApi<SaasMetrics | null>('/api/saas-metrics'),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  })
}

export function useSaasHistory() {
  return useQuery({
    queryKey: ['saas-metrics-history'],
    queryFn: () => fetchApi<MetricsHistory[]>('/api/saas-metrics/history'),
    staleTime: 120_000,
    retry: false,
  })
}

export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: () => fetchApi<Organization[]>('/api/admin/organizations'),
    staleTime: 60_000,
    retry: false,
  })
}
