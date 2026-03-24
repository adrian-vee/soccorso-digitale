export type BookingStatus = 'nuova' | 'confermata' | 'assegnata' | 'completata' | 'annullata'
export type BookingType = 'dialisi' | 'visita' | 'trasferimento' | 'dimissione' | 'privato'

export interface Booking {
  id: number
  date: string
  time: string
  patient: string
  structure: string
  type: BookingType
  status: BookingStatus
  vehicle?: string
  notes?: string
}

export interface Structure {
  id: number
  name: string
  type: 'ospedale' | 'rsa' | 'clinica' | 'privato'
  address: string
  referente: string
  phone: string
  servicesThisMonth: number
}

export interface SpecialEvent {
  id: number
  date: string
  event: string
  location: string
  assistanceType: string
  vehicles: number
  staff: number
  status: 'pianificato' | 'confermato' | 'completato'
}

export interface PrivateRequest {
  id: number
  date: string
  patient: string
  from: string
  to: string
  type: string
  phone: string
  status: 'nuova' | 'confermata' | 'completata'
  price?: number
}

export const mockBookings: Booking[] = [
  { id: 1, date: "24/03/2026", time: "07:00", patient: "Bortoli Giuseppe", structure: "ULSS 9 Legnago", type: "dialisi", status: "assegnata", vehicle: "J54" },
  { id: 2, date: "24/03/2026", time: "08:30", patient: "Zanetti Maria", structure: "Casa di Cura Dott. Rossi", type: "visita", status: "confermata" },
  { id: 3, date: "24/03/2026", time: "10:00", patient: "Ferretti Luigi", structure: "RSA Villa Verde", type: "trasferimento", status: "confermata", vehicle: "J55" },
  { id: 4, date: "24/03/2026", time: "14:00", patient: "Damiani Rosa", structure: "Ospedale Civile Legnago", type: "dimissione", status: "nuova" },
  { id: 5, date: "25/03/2026", time: "07:30", patient: "Alberti Gino", structure: "ULSS 9 Legnago", type: "dialisi", status: "confermata" },
  { id: 6, date: "25/03/2026", time: "09:00", patient: "Crema Paolo", structure: "Clinica Privata Veronese", type: "visita", status: "confermata" },
  { id: 7, date: "25/03/2026", time: "11:30", patient: "Merlin Sandra", structure: "RSA Villa Verde", type: "trasferimento", status: "nuova" },
  { id: 8, date: "26/03/2026", time: "08:00", patient: "Tosi Marco", structure: "ULSS 9 Legnago", type: "dialisi", status: "assegnata", vehicle: "J56" },
  { id: 9, date: "26/03/2026", time: "15:00", patient: "Giraldo Franca", structure: "Casa di Cura Dott. Rossi", type: "visita", status: "completata" },
  { id: 10, date: "23/03/2026", time: "07:00", patient: "Vedovato Aldo", structure: "ULSS 9 Legnago", type: "dialisi", status: "completata", vehicle: "J54" },
]

export const mockStructures: Structure[] = [
  { id: 1, name: "ULSS 9 Scaligera — Legnago", type: "ospedale", address: "Via Gianella 1, Legnago", referente: "Dott.ssa Conti", phone: "045 7370111", servicesThisMonth: 156 },
  { id: 2, name: "RSA Villa Verde", type: "rsa", address: "Via Roma 45, Bovolone", referente: "Sig. Trevisan", phone: "045 6971234", servicesThisMonth: 48 },
  { id: 3, name: "Casa di Cura Dott. Rossi", type: "clinica", address: "Via Mazzini 12, Legnago", referente: "Dott. Rossi", phone: "045 7371122", servicesThisMonth: 32 },
  { id: 4, name: "Clinica Privata Veronese", type: "clinica", address: "Via Verdi 8, Verona", referente: "Sig.ra Neri", phone: "045 8001234", servicesThisMonth: 18 },
  { id: 5, name: "RSA San Francesco", type: "rsa", address: "Via S. Francesco 3, Cerea", referente: "Sig. Bettini", phone: "045 7381111", servicesThisMonth: 24 },
]

export const mockSpecialEvents: SpecialEvent[] = [
  { id: 1, date: "01/04/2026", event: "Maratona Legnago", location: "Piazza Risorgimento, Legnago", assistanceType: "Presidio ambulanza", vehicles: 2, staff: 4, status: "confermato" },
  { id: 2, date: "15/04/2026", event: "Fiera Agricola Bovolone", location: "Area Fiera, Bovolone", assistanceType: "Presidio MSB", vehicles: 1, staff: 2, status: "pianificato" },
  { id: 3, date: "20/03/2026", event: "Concerto Comunale", location: "Palazzetto Sport, Legnago", assistanceType: "Presidio di base", vehicles: 1, staff: 2, status: "completato" },
]

export const mockPrivateRequests: PrivateRequest[] = [
  { id: 1, date: "24/03/2026", patient: "Manzini Carlo", from: "Legnago", to: "VR Borgo Roma", type: "Trasporto medico", phone: "+39 345 1234567", status: "confermata", price: 85 },
  { id: 2, date: "25/03/2026", patient: "Lupo Anna", from: "Cerea", to: "Mantova Policlinico", type: "Trasporto medico", phone: "+39 333 7654321", status: "nuova", price: 120 },
  { id: 3, date: "22/03/2026", patient: "Ferretti Bruno", from: "Bovolone", to: "VR Policlinico", type: "Barellato", phone: "+39 347 0001111", status: "completata", price: 95 },
]

export const bookingKpis = {
  oggi: 4,
  inAttesa: 3,
  confermate: 5,
  revenueMese: 2450,
}

export const privateServiceConfig = {
  active: true,
  shareUrl: "https://app.soccorsodigitale.it/prenota/croce-europa-legnago",
  services: ["Trasporto medico", "Barellato", "Accompagnamento", "Dialisi privata"],
  priceFrom: 65,
  hoursFrom: "06:00",
  hoursTo: "22:00",
  requestsMonth: 18,
  revenueMonth: 2450,
  conversionRate: 78,
}
