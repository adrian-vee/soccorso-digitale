export const mockOrgSettings = {
  name: "Croce Europa Legnago",
  legalName: "Croce Europa ODV",
  piva: "04123456789",
  address: "Via Roma 15, 37045 Legnago (VR)",
  phone: "+39 045 7370123",
  email: "info@croceeuropa.it",
  sedi: ["Legnago", "Bovolone"],
  plan: "professional" as const,
  usersCount: 8,
  usersMax: 15,
  vehiclesCount: 5,
  vehiclesMax: 15,
}

export const mockUsers = [
  { id: 1, name: "Marco Rossi", email: "m.rossi@croceeuropa.it", role: "admin" as const, active: true, lastLogin: "Oggi 08:12" },
  { id: 2, name: "Laura Moretti", email: "l.moretti@croceeuropa.it", role: "coordinatore" as const, active: true, lastLogin: "Ieri 14:30" },
  { id: 3, name: "Francesca Costa", email: "f.costa@croceeuropa.it", role: "operatore" as const, active: true, lastLogin: "23/03/2026" },
  { id: 4, name: "Giovanni Verdi", email: "g.verdi@croceeuropa.it", role: "operatore" as const, active: true, lastLogin: "22/03/2026" },
  { id: 5, name: "Luca Bianchi", email: "l.bianchi@croceeuropa.it", role: "viewer" as const, active: false, lastLogin: "10/03/2026" },
]

export type UserRole = 'admin' | 'coordinatore' | 'operatore' | 'viewer'
