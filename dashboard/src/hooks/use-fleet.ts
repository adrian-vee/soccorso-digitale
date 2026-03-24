import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import { mockFleet, mockExpiryAlerts } from '@/lib/mock-fleet'
import type { Vehicle, VehicleStatus, ExpiryAlert } from '@/lib/mock-fleet'

function normalizeVehicle(v: any): Vehicle {
  const statusMap: Record<string, VehicleStatus> = {
    active: 'disponibile',
    in_service: 'in_servizio',
    maintenance: 'manutenzione',
    inactive: 'fuori_servizio',
    available: 'disponibile',
  }

  return {
    id: v.id ?? '',
    code: v.code ?? '',
    name: v.natoName ?? v.name ?? v.code ?? '',
    plate: v.licensePlate ?? v.plate ?? '',
    type: v.vehicleType ?? v.type ?? 'ambulanza',
    status: statusMap[v.status] ?? (v.status as VehicleStatus) ?? 'disponibile',
    year: v.year ?? v.productionYear ?? 0,
    km: v.currentKm ?? v.km ?? 0,
    kmLastService: v.kmLastService ?? 0,
    nextServiceKm: v.nextServiceKm ?? 0,
    insurance: v.insuranceExpiry ?? v.insurance ?? '',
    revision: v.revisionExpiry ?? v.revision ?? '',
    sede: v.locationName ?? v.sede ?? '',
    services: v.services ?? 0,
    mapPosition: v.mapPosition ?? undefined,
    notes: v.notes ?? '',
  }
}

function normalizeExpiry(a: any): ExpiryAlert {
  return {
    id: a.id ?? Math.random(),
    vehicleId: a.vehicleId ?? '',
    vehicleCode: a.vehicleCode ?? a.code ?? '',
    type: a.type ?? 'assicurazione',
    expiry: a.expiryDate ?? a.expiry ?? '',
    daysLeft: a.daysLeft ?? 0,
    severity: a.severity ?? (a.daysLeft <= 7 ? 'critical' : a.daysLeft <= 30 ? 'warning' : 'info'),
  }
}

export function useFleet() {
  return useQuery<Vehicle[]>({
    queryKey: ['vehicles'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/vehicles')
        const arr = Array.isArray(data) ? data : []
        return arr.map(normalizeVehicle)
      } catch {
        return mockFleet
      }
    },
    staleTime: 60_000,
  })
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: ['vehicle', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/vehicles/${id}`)
      return normalizeVehicle(data)
    },
    enabled: !!id,
  })
}

export function useExpiryAlerts() {
  return useQuery<ExpiryAlert[]>({
    queryKey: ['expiry-alerts'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/scadenze/status')
        if (Array.isArray(data?.alerts)) return data.alerts.map(normalizeExpiry)
        if (Array.isArray(data)) return data.map(normalizeExpiry)
        return mockExpiryAlerts
      } catch {
        return mockExpiryAlerts
      }
    },
    staleTime: 120_000,
  })
}

export function useCreateVehicle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/vehicles', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}
