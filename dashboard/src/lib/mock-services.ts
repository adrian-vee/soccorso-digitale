export type ServiceStatus = "completato" | "in_corso" | "programmato" | "ritardo" | "annullato"
export type ServiceType = "dialisi" | "visita" | "trasferimento" | "dimissione" | "altro"
export type ServicePriority = "normale" | "urgente"

export interface Service {
  id: number
  time: string
  type: ServiceType
  typeLabel: string
  patient: string
  patientPhone: string
  origin: string
  destination: string
  vehicle: string | null
  km: number
  status: ServiceStatus
  priority: ServicePriority
  notes: string
  sede: string
}

export interface Vehicle {
  id: string
  name: string
  plate: string
  status: "attivo" | "manutenzione" | "fuori-servizio"
  sede: string
}

export const mockServices: Service[] = [
  {
    id: 1,
    time: "07:30",
    type: "dialisi",
    typeLabel: "Dialisi",
    patient: "Rossi Mario",
    patientPhone: "+39 345 1234567",
    origin: "Via Roma 15, Legnago",
    destination: "Osp. Mater Salutis, Legnago",
    vehicle: "J54",
    km: 8.2,
    status: "completato",
    priority: "normale",
    notes: "",
    sede: "Legnago",
  },
  {
    id: 2,
    time: "08:15",
    type: "visita",
    typeLabel: "Visita Spec.",
    patient: "Bianchi Anna",
    patientPhone: "+39 333 7654321",
    origin: "RSA S. Anna, Bovolone",
    destination: "Policlinico G.B. Rossi, Verona",
    vehicle: "J55",
    km: 32.5,
    status: "in_corso",
    priority: "normale",
    notes: "Paziente su sedia a rotelle",
    sede: "Legnago",
  },
  {
    id: 3,
    time: "09:00",
    type: "dialisi",
    typeLabel: "Dialisi",
    patient: "Verdi Giovanni",
    patientPhone: "+39 347 9876543",
    origin: "Via Garibaldi 42, Cerea",
    destination: "Osp. Mater Salutis, Legnago",
    vehicle: "J54",
    km: 12.1,
    status: "programmato",
    priority: "normale",
    notes: "",
    sede: "Legnago",
  },
  {
    id: 4,
    time: "09:45",
    type: "trasferimento",
    typeLabel: "Trasferimento",
    patient: "Neri Alberto",
    patientPhone: "+39 340 1112233",
    origin: "Osp. Mater Salutis, Legnago",
    destination: "Osp. Borgo Trento, Verona",
    vehicle: null,
    km: 48.3,
    status: "programmato",
    priority: "urgente",
    notes: "Trasferimento urgente — reparto cardiologia",
    sede: "Legnago",
  },
  {
    id: 5,
    time: "10:30",
    type: "dimissione",
    typeLabel: "Dimissione",
    patient: "Costa Francesca",
    patientPhone: "+39 349 4445566",
    origin: "Policlinico G.B. Rossi, Verona",
    destination: "Via Mazzini 8, Bovolone",
    vehicle: "J55",
    km: 35.0,
    status: "programmato",
    priority: "normale",
    notes: "",
    sede: "Bovolone",
  },
  {
    id: 6,
    time: "11:00",
    type: "trasferimento",
    typeLabel: "Trasferimento",
    patient: "Gallo Pietro",
    patientPhone: "+39 338 7778899",
    origin: "RSA Villa Maria, Cerea",
    destination: "Osp. Mater Salutis, Legnago",
    vehicle: "J56",
    km: 15.7,
    status: "ritardo",
    priority: "normale",
    notes: "Ritardo 15 minuti — traffico",
    sede: "Legnago",
  },
  {
    id: 7,
    time: "13:00",
    type: "dialisi",
    typeLabel: "Dialisi",
    patient: "Moretti Laura",
    patientPhone: "+39 342 0001122",
    origin: "Via Dante 22, Legnago",
    destination: "Osp. Mater Salutis, Legnago",
    vehicle: null,
    km: 3.5,
    status: "programmato",
    priority: "normale",
    notes: "",
    sede: "Legnago",
  },
  {
    id: 8,
    time: "14:30",
    type: "visita",
    typeLabel: "Visita Spec.",
    patient: "Colombo Marco",
    patientPhone: "+39 335 3334455",
    origin: "Domicilio — Nogara",
    destination: "Osp. Borgo Roma, Verona",
    vehicle: null,
    km: 45.0,
    status: "programmato",
    priority: "normale",
    notes: "Visita oncologica",
    sede: "Legnago",
  },
]

export const mockVehicles: Vehicle[] = [
  { id: "J54", name: "Fiat Ducato", plate: "FM009GB", status: "attivo", sede: "Legnago" },
  { id: "J55", name: "Fiat Ducato", plate: "GH123AB", status: "attivo", sede: "Legnago" },
  { id: "J56", name: "Mercedes Sprinter", plate: "KL456CD", status: "attivo", sede: "Bovolone" },
  { id: "J57", name: "Fiat Doblò", plate: "MN789EF", status: "manutenzione", sede: "Legnago" },
  { id: "J58", name: "Peugeot Expert", plate: "OP012GH", status: "attivo", sede: "Legnago" },
]
