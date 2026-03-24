// 30 giorni di servizi (marzo 2026)
export const servicesByDay = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1
  const base = 10 + Math.round(Math.sin(i * 0.5) * 3)
  return { day: `${String(day).padStart(2, "0")}/03`, servizi: base + Math.round(Math.random() * 4) }
})

export const kmBreakdown = [
  { name: "Con paziente", value: 2948, color: "#2E5E99" },
  { name: "A vuoto", value: 1029, color: "#7BA4D0" },
  { name: "Ritorno", value: 303, color: "#B8D4EF" },
]

export const servicesByType = [
  { type: "Dialisi", count: 156 },
  { type: "Visita", count: 98 },
  { type: "Trasferimento", count: 62 },
  { type: "Dimissione", count: 45 },
  { type: "Altro", count: 0 },
]

export const topRoutes = [
  { route: "Legnago → VR Borgo Roma", count: 48 },
  { route: "Cerea → Legnago", count: 35 },
  { route: "Bovolone → VR Policlinico", count: 28 },
  { route: "Legnago → Mantova", count: 22 },
  { route: "Nogara → VR Borgo Roma", count: 18 },
]

export interface VehicleKm {
  id: string
  plate: string
  kmTotal: number
  kmPaziente: number
  kmVuoto: number
  servizi: number
  costo: number
}

export const vehicleKmReport: VehicleKm[] = [
  { id: "J54", plate: "FM009GB", kmTotal: 1284, kmPaziente: 890, kmVuoto: 394, servizi: 47, costo: 282 },
  { id: "J55", plate: "FM010GB", kmTotal: 956, kmPaziente: 672, kmVuoto: 284, servizi: 38, costo: 210 },
  { id: "J56", plate: "FM011GB", kmTotal: 872, kmPaziente: 598, kmVuoto: 274, servizi: 34, costo: 192 },
  { id: "J57", plate: "FM012GB", kmTotal: 734, kmPaziente: 510, kmVuoto: 224, servizi: 29, costo: 161 },
  { id: "J58", plate: "FM013GB", kmTotal: 434, kmPaziente: 278, kmVuoto: 156, servizi: 18, costo: 95 },
]

export interface UtifRow {
  id: string
  plate: string
  kmMese: number
  litriStimati: number
  accisaDovuta: number
}

export const utifReport: UtifRow[] = vehicleKmReport.map(v => ({
  id: v.id,
  plate: v.plate,
  kmMese: v.kmTotal,
  litriStimati: Math.round(v.kmTotal / 10 * 10) / 10,
  accisaDovuta: Math.round((v.kmTotal / 10) * 0.671 * 100) / 100,
}))

export const slaData = {
  current: 94,
  target: 90,
  lastMonth: 91,
}

export const complianceItems = [
  { label: "Tempi di risposta", value: "95%", target: ">90%", ok: true },
  { label: "Veicoli conformi", value: "5/5", target: "5/5", ok: true },
  { label: "Personale certificato", value: "37/38", target: "38/38", ok: false },
  { label: "Report mensile", value: "Inviato", target: "Inviato", ok: true },
  { label: "Ispezione mezzi", value: "5/5", target: "5/5", ok: true },
]

export const analyticsKpis = {
  serviziMese: 361,
  serviziDelta: "+12%",
  kmTotali: 4280,
  kmVuoto: 1332,
  kmPaziente: 2948,
  costoPerKm: 0.22,
  oreVolontari: 1284,
  slaPercent: 94,
  ricavoPrivati: 2450,
}
