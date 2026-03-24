export type VolunteerRole = 'autista' | 'soccorritore' | 'centralinista' | 'coordinatore'
export type VolunteerStatus = 'attivo' | 'inattivo' | 'sospeso'
export type CertStatus = 'valid' | 'expiring' | 'expired'

export interface CertEntry {
  expiry: string
  daysLeft: number
  status: CertStatus
}

export interface Volunteer {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string
  role: VolunteerRole
  sede: string
  status: VolunteerStatus
  hoursThisMonth: number
  certifications: {
    blsd: CertEntry
    license: { type: string; expiry: string; daysLeft: number; status: CertStatus }
    safety626: CertEntry
  }
}

export const mockPersonnel: Volunteer[] = [
  {
    id: 1, firstName: "Marco", lastName: "Rossi", email: "m.rossi@croceeuropa.it",
    phone: "+39 345 1234567", role: "autista", sede: "Legnago", status: "attivo",
    hoursThisMonth: 48,
    certifications: {
      blsd: { expiry: "15/03/2027", daysLeft: 356, status: "valid" },
      license: { type: "B", expiry: "20/11/2028", daysLeft: 970, status: "valid" },
      safety626: { expiry: "01/09/2026", daysLeft: 161, status: "valid" }
    }
  },
  {
    id: 2, firstName: "Luca", lastName: "Bianchi", email: "l.bianchi@croceeuropa.it",
    phone: "+39 333 7654321", role: "soccorritore", sede: "Legnago", status: "attivo",
    hoursThisMonth: 36,
    certifications: {
      blsd: { expiry: "08/04/2026", daysLeft: 15, status: "expiring" },
      license: { type: "B", expiry: "05/06/2027", daysLeft: 438, status: "valid" },
      safety626: { expiry: "30/12/2026", daysLeft: 281, status: "valid" }
    }
  },
  {
    id: 3, firstName: "Anna", lastName: "Ferrari", email: "a.ferrari@croceeuropa.it",
    phone: "+39 347 9876543", role: "soccorritore", sede: "Bovolone", status: "attivo",
    hoursThisMonth: 32,
    certifications: {
      blsd: { expiry: "20/08/2026", daysLeft: 149, status: "valid" },
      license: { type: "B", expiry: "15/03/2029", daysLeft: 1087, status: "valid" },
      safety626: { expiry: "10/05/2026", daysLeft: 47, status: "expiring" }
    }
  },
  {
    id: 4, firstName: "Giovanni", lastName: "Verdi", email: "g.verdi@croceeuropa.it",
    phone: "+39 340 1112233", role: "autista", sede: "Legnago", status: "attivo",
    hoursThisMonth: 28,
    certifications: {
      blsd: { expiry: "01/06/2026", daysLeft: 69, status: "expiring" },
      license: { type: "C", expiry: "01/04/2026", daysLeft: 8, status: "expiring" },
      safety626: { expiry: "15/07/2026", daysLeft: 113, status: "valid" }
    }
  },
  {
    id: 5, firstName: "Francesca", lastName: "Costa", email: "f.costa@croceeuropa.it",
    phone: "+39 349 4445566", role: "centralinista", sede: "Legnago", status: "attivo",
    hoursThisMonth: 52,
    certifications: {
      blsd: { expiry: "30/01/2027", daysLeft: 312, status: "valid" },
      license: { type: "B", expiry: "22/09/2027", daysLeft: 547, status: "valid" },
      safety626: { expiry: "05/04/2026", daysLeft: 12, status: "expiring" }
    }
  },
  {
    id: 6, firstName: "Pietro", lastName: "Gallo", email: "p.gallo@croceeuropa.it",
    phone: "+39 338 7778899", role: "soccorritore", sede: "Legnago", status: "attivo",
    hoursThisMonth: 24,
    certifications: {
      blsd: { expiry: "10/02/2026", daysLeft: -42, status: "expired" },
      license: { type: "B", expiry: "18/08/2027", daysLeft: 512, status: "valid" },
      safety626: { expiry: "25/11/2026", daysLeft: 246, status: "valid" }
    }
  },
  {
    id: 7, firstName: "Laura", lastName: "Moretti", email: "l.moretti@croceeuropa.it",
    phone: "+39 342 0001122", role: "coordinatore", sede: "Legnago", status: "attivo",
    hoursThisMonth: 64,
    certifications: {
      blsd: { expiry: "15/09/2026", daysLeft: 175, status: "valid" },
      license: { type: "B", expiry: "30/04/2028", daysLeft: 767, status: "valid" },
      safety626: { expiry: "20/10/2026", daysLeft: 210, status: "valid" }
    }
  },
  {
    id: 8, firstName: "Carla", lastName: "Russo", email: "c.russo@croceeuropa.it",
    phone: "+39 335 3334455", role: "autista", sede: "Bovolone", status: "inattivo",
    hoursThisMonth: 0,
    certifications: {
      blsd: { expiry: "01/01/2026", daysLeft: -83, status: "expired" },
      license: { type: "B", expiry: "12/07/2026", daysLeft: 110, status: "valid" },
      safety626: { expiry: "18/03/2026", daysLeft: -6, status: "expired" }
    }
  },
]
