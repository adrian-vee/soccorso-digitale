import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import { mockInventory } from '@/lib/mock-inventory'

export function useInventoryDashboard() {
  return useQuery({
    queryKey: ['inventory-dashboard'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/inventory/dashboard')
        return data
      } catch {
        return null
      }
    },
    staleTime: 60_000,
  })
}

export function useInventoryItems() {
  return useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/inventory/items')
        return Array.isArray(data) ? data : mockInventory
      } catch {
        return mockInventory
      }
    },
    staleTime: 60_000,
  })
}

export function useExpiringInventory() {
  return useQuery({
    queryKey: ['inventory-expiring'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/inventory/alerts/expiring')
        return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
      } catch {
        return []
      }
    },
    staleTime: 120_000,
  })
}

export function useLowStockAlerts() {
  return useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/inventory/alerts/low-stock')
        return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
      } catch {
        return []
      }
    },
    staleTime: 120_000,
  })
}

export function useCreateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/inventory/items', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['inventory-dashboard'] })
    },
  })
}

export function useUpdateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const { data } = await apiClient.patch(`/inventory/items/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] })
      qc.invalidateQueries({ queryKey: ['inventory-dashboard'] })
    },
  })
}
