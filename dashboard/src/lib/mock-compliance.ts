export const mockComplianceScore = 87

export const mockCertifications = [
  { name: "GDPR Data Processing", status: "ok", expiry: null, org: "Tutte", detail: null },
  { name: "Certificazione ISO 9001", status: "ok", expiry: "15/09/2026", org: "Croce Europa", detail: null },
  { name: "Polizza RC Professionale", status: "warning", expiry: "30/04/2026", org: "Croce Europa", detail: "Rinnovo imminente" },
  { name: "Formazione BLSD Staff", status: "error", expiry: "Varie", org: "Tutte", detail: "3 certificazioni scadute" },
  { name: "Revisione Mezzi", status: "warning", expiry: "08/04/2026", org: "Croce Europa", detail: "J56 in scadenza" },
  { name: "Privacy Policy Aggiornata", status: "ok", expiry: "01/01/2027", org: "Tutte", detail: null },
  { name: "DPO Nominato", status: "ok", expiry: null, org: "Croce Europa", detail: null },
  { name: "Registro Trattamenti Dati", status: "ok", expiry: null, org: "Tutte", detail: null },
] as const

export type CertStatus = "ok" | "warning" | "error"

export interface Certification {
  name: string
  status: CertStatus
  expiry: string | null
  org: string
  detail: string | null
}

export const mockAuditTrail = [
  { time: "14:23", user: "Admin", action: "Modificato impostazioni organizzazione", ip: "85.18.xxx.xxx" },
  { time: "13:45", user: "Admin", action: "Upload certificazione ISO 9001", ip: "85.18.xxx.xxx" },
  { time: "11:20", user: "Coordinatore", action: "Aggiunto nuovo volontario: Ferrari Anna", ip: "93.42.xxx.xxx" },
  { time: "09:15", user: "Admin", action: "Login da nuovo dispositivo", ip: "85.18.xxx.xxx" },
  { time: "08:30", user: "Sistema", action: "Backup automatico completato", ip: "—" },
  { time: "07:00", user: "Sistema", action: "Report giornaliero generato", ip: "—" },
]

export const mockOrgCompliance = [
  { name: "Croce Europa Legnago", score: 94, certs: 12, total: 14 },
  { name: "ALS Soccorso Milano", score: 88, certs: 10, total: 12 },
  { name: "FVS Nazionale", score: 76, certs: 8, total: 14 },
]

export const mockUpcomingDeadlines = [
  { label: "Polizza RC Professionale", date: "30/04/2026", urgency: "warning" as const },
  { label: "Revisione J56", date: "08/04/2026", urgency: "warning" as const },
  { label: "Privacy Policy", date: "01/01/2027", urgency: "ok" as const },
  { label: "ISO 9001 — Croce Europa", date: "15/09/2026", urgency: "ok" as const },
]
