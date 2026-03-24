import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import { mockServices } from '@/lib/mock-services'
import type { Service, ServiceStatus, ServiceType } from '@/lib/mock-services'

// Normalize API scheduled-service → local Service shape
function normalize(s: any): Service {
  const statusMap: Record<string, ServiceStatus> = {
    completed: 'completato',
    in_progress: 'in_corso',
    scheduled: 'programmato',
    cancelled: 'annullato',
    pending: 'programmato',
  }
  const typeMap: Record<string, ServiceType> = {
    dialysis: 'dialisi',
    visit: 'visita',
    discharge: 'dimissione',
    transfer: 'trasferimento',
    emergency: 'emergenza',
  }

  return {
    id: typeof s.id === 'number' ? s.id : parseInt(s.id) || 0,
    date: s.date ?? s.serviceDate ?? '',
    time: s.departureTime ?? s.time ?? '--:--',
    patient: s.patientName ?? s.patient ?? 'N/D',
    phone: s.patientPhone ?? s.phone ?? '',
    origin: s.originAddress ?? s.origin ?? '',
    destination: s.destinationAddress ?? s.destination ?? '',
    vehicle: s.vehicleLabel ?? s.vehicleCode ?? s.vehicle ?? '',
    status: statusMap[s.status] ?? (s.status as ServiceStatus) ?? 'programmato',
    type: typeMap[s.serviceType] ?? (s.serviceType as ServiceType) ?? 'visita',
    priority: s.priority ?? 'normale',
    sede: s.locationName ?? s.sede ?? '',
    notes: s.notes ?? '',
  }
}

export function useServices(date: Date) {
  const dateStr = date.toISOString().split('T')[0]

  return useQuery<Service[]>({
    queryKey: ['scheduled-services', dateStr],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/scheduled-services?date=${dateStr}`)
        const arr = Array.isArray(data) ? data : []
        return arr.map(normalize)
      } catch {
        return mockServices.filter((s) => s.date === dateStr || s.date === undefined)
      }
    },
  })
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles-list'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/vehicles')
        return Array.isArray(data) ? data : []
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })
}

export function useUpdateServiceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: number | string; status: string }) => {
      const { data } = await apiClient.patch(`/scheduled-services/${id}/status`, { status })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-services'] }),
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/scheduled-services', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-services'] }),
  })
}
