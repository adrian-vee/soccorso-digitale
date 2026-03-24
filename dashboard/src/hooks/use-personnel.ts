import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import { mockPersonnel } from '@/lib/mock-personnel'
import type { Personnel } from '@/lib/mock-personnel'

function normalize(s: any): Personnel {
  return {
    id: typeof s.id === 'number' ? s.id : parseInt(s.id) || 0,
    firstName: s.firstName ?? '',
    lastName: s.lastName ?? '',
    email: s.email ?? '',
    phone: s.phone ?? s.phoneNumber ?? '',
    role: s.primaryRole ?? s.role ?? 'soccorritore',
    sede: s.locationName ?? s.sede ?? '',
    status: s.isActive ? 'attivo' : 'inattivo',
    joinDate: s.joinDate ?? s.createdAt?.split('T')[0] ?? '',
    hours: s.totalHours ?? s.hours ?? 0,
    certifications: (s.certifications ?? []).map((c: any) =>
      typeof c === 'string' ? { name: c, expiry: '', status: 'valida' as const }
        : { name: c.name ?? c.certType ?? '', expiry: c.expiryDate ?? c.expiry ?? '', status: c.status ?? 'valida' }
    ),
    avatar: s.avatar ?? '',
    notes: s.notes ?? '',
  }
}

export function usePersonnel() {
  return useQuery<Personnel[]>({
    queryKey: ['staff-members'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/staff-members')
        const arr = Array.isArray(data) ? data : []
        return arr.map(normalize)
      } catch {
        return mockPersonnel
      }
    },
    staleTime: 60_000,
  })
}

export function useCreatePersonnel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/staff-members', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-members'] }),
  })
}
