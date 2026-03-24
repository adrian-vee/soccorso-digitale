export type VehicleStatus = "attivo" | "in_servizio" | "manutenzione" | "fermo"
export type VehicleType = "ambulanza" | "mezzo_leggero" | "pulmino"

export interface Vehicle {
  id: string
  name: string
  plate: string
  type: VehicleType
  year: number
  status: VehicleStatus
  km: number
  kmThisMonth: number
  servicesThisMonth: number
  sede: string
  insurance: { expiry: string; daysLeft: number }
  revision: { expiry: string; daysLeft: number }
  nextService: { km: number; remaining: number }
  lastPosition: { lat: number; lng: number }
  mapX: string
  mapY: string
}

export interface ExpiryAlert {
  vehicle: string
  type: string
  date: string
  daysLeft: number | null
  urgent: boolean
}

export const mockFleet: Vehicle[] = [
  {
    id: "J54",
    name: "Fiat Ducato",
    plate: "FM009GB",
    type: "ambulanza",
    year: 2021,
    status: "in_servizio",
    km: 12430,
    kmThisMonth: 1284,
    servicesThisMonth: 47,
    sede: "Legnago",
    insurance: { expiry: "15/11/2026", daysLeft: 236 },
    revision: { expiry: "20/09/2026", daysLeft: 180 },
    nextService: { km: 15000, remaining: 2570 },
    lastPosition: { lat: 45.19, lng: 11.31 },
    mapX: "35%",
    mapY: "45%",
  },
  {
    id: "J55",
    name: "Fiat Ducato",
    plate: "GH123AB",
    type: "ambulanza",
    year: 2022,
    status: "in_servizio",
    km: 8150,
    kmThisMonth: 956,
    servicesThisMonth: 38,
    sede: "Legnago",
    insurance: { expiry: "01/03/2027", daysLeft: 342 },
    revision: { expiry: "15/06/2026", daysLeft: 83 },
    nextService: { km: 10000, remaining: 1850 },
    lastPosition: { lat: 45.44, lng: 10.99 },
    mapX: "60%",
    mapY: "30%",
  },
  {
    id: "J56",
    name: "Mercedes Sprinter",
    plate: "KL456CD",
    type: "ambulanza",
    year: 2020,
    status: "attivo",
    km: 15200,
    kmThisMonth: 780,
    servicesThisMonth: 28,
    sede: "Bovolone",
    insurance: { expiry: "10/01/2027", daysLeft: 292 },
    revision: { expiry: "08/04/2026", daysLeft: 15 },
    nextService: { km: 18000, remaining: 2800 },
    lastPosition: { lat: 45.26, lng: 11.12 },
    mapX: "45%",
    mapY: "55%",
  },
  {
    id: "J57",
    name: "Fiat Doblò",
    plate: "MN789EF",
    type: "mezzo_leggero",
    year: 2019,
    status: "manutenzione",
    km: 22100,
    kmThisMonth: 0,
    servicesThisMonth: 0,
    sede: "Legnago",
    insurance: { expiry: "23/04/2026", daysLeft: 30 },
    revision: { expiry: "01/08/2026", daysLeft: 130 },
    nextService: { km: 24000, remaining: 1900 },
    lastPosition: { lat: 45.19, lng: 11.3 },
    mapX: "33%",
    mapY: "48%",
  },
  {
    id: "J58",
    name: "Peugeot Expert",
    plate: "OP012GH",
    type: "mezzo_leggero",
    year: 2023,
    status: "attivo",
    km: 6800,
    kmThisMonth: 420,
    servicesThisMonth: 15,
    sede: "Legnago",
    insurance: { expiry: "30/07/2026", daysLeft: 128 },
    revision: { expiry: "15/12/2026", daysLeft: 266 },
    nextService: { km: 10000, remaining: 3200 },
    lastPosition: { lat: 45.2, lng: 11.35 },
    mapX: "55%",
    mapY: "50%",
  },
]

export const mockExpiryAlerts: ExpiryAlert[] = [
  { vehicle: "J56", type: "Revisione", date: "08/04/2026", daysLeft: 15, urgent: true },
  { vehicle: "J57", type: "Assicurazione", date: "23/04/2026", daysLeft: 30, urgent: false },
  { vehicle: "J54", type: "Tagliando", date: "a 13.000 km (mancano 2.570 km)", daysLeft: null, urgent: false },
  { vehicle: "J55", type: "Revisione", date: "15/06/2026", daysLeft: 83, urgent: false },
]
