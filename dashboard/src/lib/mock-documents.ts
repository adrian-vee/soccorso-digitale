export interface DigitalDelivery {
  id: number
  date: string
  serviceId: string
  patient: string
  signedBy: string
  signTime: string
  vehicle: string
  gps: string
  hasPdf: boolean
}

export interface DamageReport {
  id: number
  date: string
  vehicle: string
  damageType: string
  description: string
  photos: number
  status: 'aperto' | 'in_riparazione' | 'risolto'
  cost?: number
}

export interface VehicleChecklist {
  id: number
  date: string
  vehicle: string
  completedBy: string
  result: 'ok' | 'anomalie'
  notes?: string
  items: Record<string, boolean>
}

export interface TripNote {
  id: number
  date: string
  serviceId: string
  vehicle: string
  kmStart: number
  kmEnd: number
  driver: string
  signed: boolean
}

export interface Document {
  id: number
  name: string
  category: 'contratto' | 'polizza' | 'certificato' | 'manuale' | 'altro'
  size: string
  uploadDate: string
  expiry?: string
  daysToExpiry?: number
}

export const mockDeliveries: DigitalDelivery[] = [
  { id: 1, date: "24/03/2026", serviceId: "SRV-2026-0341", patient: "Bortoli Giuseppe", signedBy: "Rossi M.", signTime: "07:48", vehicle: "J54", gps: "45.1923, 11.3012", hasPdf: true },
  { id: 2, date: "24/03/2026", serviceId: "SRV-2026-0342", patient: "Ferretti Luigi", signedBy: "Bianchi L.", signTime: "10:22", vehicle: "J55", gps: "45.2410, 11.1234", hasPdf: true },
  { id: 3, date: "23/03/2026", serviceId: "SRV-2026-0338", patient: "Zanetti Maria", signedBy: "Ferrari A.", signTime: "09:15", vehicle: "J54", gps: "45.1950, 11.3100", hasPdf: true },
  { id: 4, date: "23/03/2026", serviceId: "SRV-2026-0339", patient: "Vedovato Aldo", signedBy: "Gallo P.", signTime: "14:30", vehicle: "J56", gps: "45.2001, 11.2987", hasPdf: true },
  { id: 5, date: "22/03/2026", serviceId: "SRV-2026-0335", patient: "Manzini Carlo", signedBy: "Moretti L.", signTime: "08:05", vehicle: "J54", gps: "45.1900, 11.2890", hasPdf: true },
  { id: 6, date: "22/03/2026", serviceId: "SRV-2026-0336", patient: "Giraldo Franca", signedBy: "Costa F.", signTime: "15:44", vehicle: "J57", gps: "45.1880, 11.3050", hasPdf: false },
]

export const mockDamageReports: DamageReport[] = [
  { id: 1, date: "18/03/2026", vehicle: "J55 — FM010GB", damageType: "Carrozzeria", description: "Ammaccatura paraurti posteriore durante manovra in retromarcia", photos: 3, status: "in_riparazione", cost: 450 },
  { id: 2, date: "10/03/2026", vehicle: "J57 — FM012GB", damageType: "Vetro", description: "Crepa sul parabrezza lato guida, probabilmente sassolino", photos: 2, status: "risolto", cost: 320 },
  { id: 3, date: "24/03/2026", vehicle: "J54 — FM009GB", damageType: "Interno", description: "Maniglia sportello laterale allentata", photos: 1, status: "aperto" },
]

export const mockChecklists: VehicleChecklist[] = [
  { id: 1, date: "24/03/2026", vehicle: "J54", completedBy: "Rossi M.", result: "ok", items: { Luci: true, Gomme: true, Olio: true, Barella: true, Ossigeno: true, Defibrillatore: true, Radio: true, Estintore: true } },
  { id: 2, date: "24/03/2026", vehicle: "J55", completedBy: "Bianchi L.", result: "anomalie", notes: "Ossigeno al 60% — ricarica necessaria", items: { Luci: true, Gomme: true, Olio: true, Barella: true, Ossigeno: false, Defibrillatore: true, Radio: true, Estintore: true } },
  { id: 3, date: "24/03/2026", vehicle: "J56", completedBy: "Ferrari A.", result: "ok", items: { Luci: true, Gomme: true, Olio: true, Barella: true, Ossigeno: true, Defibrillatore: true, Radio: true, Estintore: true } },
  { id: 4, date: "24/03/2026", vehicle: "J57", completedBy: "Verdi G.", result: "ok", items: { Luci: true, Gomme: true, Olio: true, Barella: true, Ossigeno: true, Defibrillatore: true, Radio: true, Estintore: true } },
  { id: 5, date: "23/03/2026", vehicle: "J54", completedBy: "Moretti L.", result: "ok", items: { Luci: true, Gomme: true, Olio: true, Barella: true, Ossigeno: true, Defibrillatore: true, Radio: true, Estintore: true } },
  { id: 6, date: "23/03/2026", vehicle: "J58", completedBy: "Costa F.", result: "anomalie", notes: "Radio non funzionante — segnalato", items: { Luci: true, Gomme: true, Olio: true, Barella: true, Ossigeno: true, Defibrillatore: true, Radio: false, Estintore: true } },
  { id: 7, date: "22/03/2026", vehicle: "J55", completedBy: "Gallo P.", result: "ok", items: { Luci: true, Gomme: true, Olio: true, Barella: true, Ossigeno: true, Defibrillatore: true, Radio: true, Estintore: true } },
  { id: 8, date: "22/03/2026", vehicle: "J56", completedBy: "Rossi M.", result: "ok", items: { Luci: true, Gomme: true, Olio: true, Barella: true, Ossigeno: true, Defibrillatore: true, Radio: true, Estintore: true } },
]

const CHECKLIST_UNCOMPLETED_VEHICLES = ["J58"]

export const checklistUncompleted = CHECKLIST_UNCOMPLETED_VEHICLES

export const mockTripNotes: TripNote[] = [
  { id: 1, date: "24/03/2026", serviceId: "SRV-0341", vehicle: "J54", kmStart: 12430, kmEnd: 12474, driver: "Rossi M.", signed: true },
  { id: 2, date: "24/03/2026", serviceId: "SRV-0342", vehicle: "J55", kmStart: 9870, kmEnd: 9918, driver: "Bianchi L.", signed: true },
  { id: 3, date: "23/03/2026", serviceId: "SRV-0338", vehicle: "J54", kmStart: 12390, kmEnd: 12430, driver: "Moretti L.", signed: true },
  { id: 4, date: "23/03/2026", serviceId: "SRV-0339", vehicle: "J56", kmStart: 8210, kmEnd: 8264, driver: "Gallo P.", signed: false },
  { id: 5, date: "22/03/2026", serviceId: "SRV-0335", vehicle: "J54", kmStart: 12340, kmEnd: 12390, driver: "Rossi M.", signed: true },
  { id: 6, date: "22/03/2026", serviceId: "SRV-0336", vehicle: "J57", kmStart: 5430, kmEnd: 5462, driver: "Verdi G.", signed: true },
  { id: 7, date: "21/03/2026", serviceId: "SRV-0330", vehicle: "J55", kmStart: 9820, kmEnd: 9870, driver: "Ferrari A.", signed: false },
  { id: 8, date: "21/03/2026", serviceId: "SRV-0332", vehicle: "J56", kmStart: 8155, kmEnd: 8210, driver: "Costa F.", signed: true },
  { id: 9, date: "20/03/2026", serviceId: "SRV-0325", vehicle: "J54", kmStart: 12290, kmEnd: 12340, driver: "Moretti L.", signed: true },
  { id: 10, date: "20/03/2026", serviceId: "SRV-0327", vehicle: "J58", kmStart: 1820, kmEnd: 1858, driver: "Bianchi L.", signed: true },
]

export const mockDocuments: Document[] = [
  { id: 1, name: "Contratto ULSS 9 Scaligera 2026", category: "contratto", size: "2.4 MB", uploadDate: "01/01/2026", expiry: "31/12/2026", daysToExpiry: 282 },
  { id: 2, name: "Polizza RCA Flotta — Generali", category: "polizza", size: "1.8 MB", uploadDate: "01/03/2026", expiry: "28/02/2027", daysToExpiry: 341 },
  { id: 3, name: "Certificato ISO 9001:2015", category: "certificato", size: "540 KB", uploadDate: "15/06/2025", expiry: "14/06/2026", daysToExpiry: 82 },
  { id: 4, name: "Manuale Operativo Soccorso", category: "manuale", size: "4.1 MB", uploadDate: "10/01/2026" },
  { id: 5, name: "Autorizzazione Regionale Trasporto", category: "certificato", size: "890 KB", uploadDate: "01/04/2025", expiry: "31/03/2027", daysToExpiry: 372 },
]
