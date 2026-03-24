import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import { mockFleet, mockExpiryAlerts } from '@/lib/mock-fleet'
import type { Vehicle, VehicleStatus, ExpiryAlert } from '@/lib/mock-fleet'

function normalizeVehicle(v: any): Vehicle {
  const statusMap: Record<string, VehicleStatus> = {
    active: 'attivo',
    in_service: 'in_servizio',
    maintenance: 'manutenzione',
    inactive: 'fermo',
    available: 'attivo',
  }
  const dummyExpiry = { expiry: '', daysLeft: 0 }
  return {
    id: v.id ?? '',
    name: v.name ?? v.code ?? '',
    plate: v.licensePlate ?? v.plate ?? '',
    type: v.vehicleType ?? v.type ?? 'ambulanza',
    status: statusMap[v.status] ?? (v.status as VehicleStatus) ?? 'attivo',
    year: v.year ?? v.productionYear ?? 0,
    km: v.currentKm ?? v.km ?? 0,
    kmThisMonth: v.kmThisMonth ?? 0,
    servicesThisMonth: v.servicesThisMonth ?? v.services ?? 0,
    sede: v.locationName ?? v.sede ?? '',
    insurance: v.insurance ?? dummyExpiry,
    revision: v.revision ?? dummyExpiry,
    nextService: v.nextService ?? { km: 0, remaining: 0 },
    lastPosition: v.lastPosition ?? { lat: 0, lng: 0 },
    mapX: v.mapX ?? '50%',
    mapY: v.mapY ?? '50%',
  }
}

function normalizeExpiry(a: any): ExpiryAlert {
  return {
    vehicle: a.vehicleCode ?? a.code ?? a.vehicle ?? '',
    type: a.type ?? 'assicurazione',
    date: a.expiryDate ?? a.date ?? '',
    daysLeft: a.daysLeft ?? null,
    urgent: a.urgent ?? (typeof a.daysLeft === 'number' && a.daysLeft <= 7),
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
