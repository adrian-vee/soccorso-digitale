import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import { mockShifts, mockAvailability } from '@/lib/mock-shifts'
import type { Shift, AvailabilityEntry } from '@/lib/mock-shifts'

function normalizeShift(s: any): Shift {
  return {
    id: typeof s.id === 'number' ? s.id : parseInt(s.id) || 0,
    date: s.date ?? s.shiftDate ?? '',
    startTime: s.startTime ?? '06:00',
    endTime: s.endTime ?? '18:00',
    role: s.role ?? s.shiftType ?? 'soccorritore',
    sede: s.locationName ?? s.sede ?? '',
    vehicle: s.vehicleCode ?? s.vehicle ?? '',
    assignedTo: s.assignments?.map((a: any) => `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()) ?? [],
    status: s.status === 'covered' ? 'coperto' : s.status === 'open' ? 'scoperto' : s.status ?? 'scoperto',
    notes: s.notes ?? '',
  }
}

function getWeekRange(offset = 0) {
  const now = new Date()
  const monday = new Date(now)
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(now.getDate() + diff + offset * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    dateFrom: monday.toISOString().split('T')[0],
    dateTo: sunday.toISOString().split('T')[0],
  }
}

export function useShifts(weekOffset = 0) {
  const { dateFrom, dateTo } = getWeekRange(weekOffset)

  return useQuery<Shift[]>({
    queryKey: ['shift-instances', dateFrom, dateTo],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(
          `/shift-instances?dateFrom=${dateFrom}&dateTo=${dateTo}`
        )
        const arr = Array.isArray(data) ? data : []
        return arr.map(normalizeShift)
      } catch {
        return mockShifts
      }
    },
  })
}

export function useOpenShifts(weekOffset = 0) {
  const { dateFrom, dateTo } = getWeekRange(weekOffset)

  return useQuery<Shift[]>({
    queryKey: ['open-shifts', dateFrom, dateTo],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(
          `/shift-instances/open?dateFrom=${dateFrom}&dateTo=${dateTo}`
        )
        const arr = Array.isArray(data) ? data : []
        return arr.map(normalizeShift)
      } catch {
        return mockShifts.filter(s => s.status === 'scoperto')
      }
    },
  })
}

export function useShiftStats() {
  return useQuery({
    queryKey: ['shift-stats'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/shift-stats')
        return data
      } catch {
        return null
      }
    },
    staleTime: 60_000,
  })
}

export function useAvailability() {
  return useQuery<AvailabilityEntry[]>({
    queryKey: ['shift-availability'],
    queryFn: async () => {
      // No dedicated availability list endpoint — return mock
      return mockAvailability
    },
  })
}

export function useAssignShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ shiftId, staffMemberId, role }: { shiftId: number | string; staffMemberId: string; role?: string }) => {
      const { data } = await apiClient.patch(`/shift-instances/${shiftId}`, {
        staffMemberId,
        assignedRole: role,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift-instances'] })
      qc.invalidateQueries({ queryKey: ['open-shifts'] })
    },
  })
}
