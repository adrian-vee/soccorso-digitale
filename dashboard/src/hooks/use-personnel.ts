import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import { mockPersonnel } from '@/lib/mock-personnel'
import type { Volunteer, VolunteerRole, VolunteerStatus, CertStatus } from '@/lib/mock-personnel'

function normalize(s: any): Volunteer {
  const certStatus = (v: any): CertStatus =>
    v?.status === 'expired' ? 'expired' : v?.status === 'expiring' ? 'expiring' : 'valid'

  return {
    id: typeof s.id === 'number' ? s.id : parseInt(s.id) || 0,
    firstName: s.firstName ?? '',
    lastName: s.lastName ?? '',
    email: s.email ?? '',
    phone: s.phone ?? s.phoneNumber ?? '',
    role: (s.primaryRole ?? s.role ?? 'soccorritore') as VolunteerRole,
    sede: s.locationName ?? s.sede ?? '',
    status: (s.isActive === false ? 'inattivo' : s.status ?? 'attivo') as VolunteerStatus,
    hoursThisMonth: s.hoursThisMonth ?? s.totalHours ?? s.hours ?? 0,
    certifications: {
      blsd: {
        expiry: s.certifications?.blsd?.expiryDate ?? s.certifications?.blsd?.expiry ?? '',
        daysLeft: s.certifications?.blsd?.daysLeft ?? 0,
        status: certStatus(s.certifications?.blsd),
      },
      license: {
        type: s.certifications?.license?.type ?? 'B',
        expiry: s.certifications?.license?.expiryDate ?? s.certifications?.license?.expiry ?? '',
        daysLeft: s.certifications?.license?.daysLeft ?? 0,
        status: certStatus(s.certifications?.license),
      },
      safety626: {
        expiry: s.certifications?.safety626?.expiryDate ?? s.certifications?.safety626?.expiry ?? '',
        daysLeft: s.certifications?.safety626?.daysLeft ?? 0,
        status: certStatus(s.certifications?.safety626),
      },
    },
  }
}

export function usePersonnel() {
  return useQuery<Volunteer[]>({
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
