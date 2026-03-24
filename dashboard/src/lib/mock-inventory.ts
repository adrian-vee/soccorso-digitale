export type ItemCategory = 'dpi' | 'farmaco' | 'dispositivo' | 'consumabile'
export type ItemStatus = 'ok' | 'low' | 'critical' | 'expired'

export interface InventoryItem {
  id: number
  code: string
  name: string
  category: ItemCategory
  quantity: number
  minStock: number
  location: string
  expiry?: string
  daysToExpiry?: number
  status: ItemStatus
  unitValue: number
}

export interface Sanification {
  id: number
  date: string
  vehicle: string
  type: 'ordinaria' | 'straordinaria'
  operator: string
  products: string
  nextDate: string
  daysToNext: number
  overdue: boolean
}

export const mockInventory: InventoryItem[] = [
  { id: 1, code: "DPI-001", name: "Guanti nitrile L (box 100)", category: "dpi", quantity: 8, minStock: 10, location: "Armadio A1", status: "low", unitValue: 12 },
  { id: 2, code: "DPI-002", name: "Mascherine FFP2", category: "dpi", quantity: 45, minStock: 20, location: "Armadio A1", status: "ok", unitValue: 0.9 },
  { id: 3, code: "DPI-003", name: "Camici monouso", category: "dpi", quantity: 3, minStock: 15, location: "Armadio A2", status: "critical", unitValue: 3 },
  { id: 4, code: "FAR-001", name: "Soluzione fisiologica 500ml", category: "farmaco", quantity: 24, minStock: 12, location: "Frigorifero F1", expiry: "15/06/2026", daysToExpiry: 83, status: "ok", unitValue: 2.5 },
  { id: 5, code: "FAR-002", name: "Adrenalina 1mg/ml", category: "farmaco", quantity: 6, minStock: 4, location: "Cassetta emergenza J54", expiry: "01/05/2026", daysToExpiry: 38, status: "ok", unitValue: 4.2 },
  { id: 6, code: "FAR-003", name: "Nitroglicerina spray", category: "farmaco", quantity: 2, minStock: 3, location: "Cassetta emergenza J55", expiry: "20/04/2026", daysToExpiry: 27, status: "low", unitValue: 8.5 },
  { id: 7, code: "FAR-004", name: "Glucosio 5% 250ml", category: "farmaco", quantity: 0, minStock: 6, location: "Frigorifero F1", expiry: "05/04/2026", daysToExpiry: 12, status: "critical", unitValue: 1.8 },
  { id: 8, code: "DIS-001", name: "Defibrillatore Zoll AED Plus", category: "dispositivo", quantity: 5, minStock: 5, location: "Veicoli", status: "ok", unitValue: 1200 },
  { id: 9, code: "DIS-002", name: "Ossimetro portatile", category: "dispositivo", quantity: 4, minStock: 3, location: "Veicoli", status: "ok", unitValue: 45 },
  { id: 10, code: "DIS-003", name: "Sfigmomanometro manuale", category: "dispositivo", quantity: 2, minStock: 3, location: "Deposito", status: "low", unitValue: 35 },
  { id: 11, code: "DIS-004", name: "Barella spinale KED", category: "dispositivo", quantity: 5, minStock: 5, location: "Veicoli", status: "ok", unitValue: 180 },
  { id: 12, code: "CON-001", name: "Cerotti medicati assortiti", category: "consumabile", quantity: 12, minStock: 5, location: "Kit primo soccorso", expiry: "01/01/2028", daysToExpiry: 648, status: "ok", unitValue: 3.5 },
  { id: 13, code: "CON-002", name: "Bende elastiche 10cm", category: "consumabile", quantity: 30, minStock: 10, location: "Magazzino M1", status: "ok", unitValue: 1.2 },
  { id: 14, code: "CON-003", name: "Siringhe sterili 10ml", category: "consumabile", quantity: 4, minStock: 20, location: "Armadio A3", expiry: "10/04/2026", daysToExpiry: 17, status: "critical", unitValue: 0.4 },
  { id: 15, code: "CON-004", name: "Cannule orofaringee set", category: "consumabile", quantity: 8, minStock: 5, location: "Kit emergenza", status: "ok", unitValue: 12 },
  { id: 16, code: "FAR-005", name: "Eparina sodica 5000 UI", category: "farmaco", quantity: 1, minStock: 4, location: "Frigorifero F1", expiry: "28/03/2026", daysToExpiry: 4, status: "critical", unitValue: 6.8 },
]

export const mockSanifications: Sanification[] = [
  { id: 1, date: "22/03/2026", vehicle: "J54 — FM009GB", type: "ordinaria", operator: "Rossi M.", products: "Amuchina spray, panno microfibra", nextDate: "29/03/2026", daysToNext: 5, overdue: false },
  { id: 2, date: "20/03/2026", vehicle: "J55 — FM010GB", type: "ordinaria", operator: "Bianchi L.", products: "Amuchina spray", nextDate: "27/03/2026", daysToNext: 3, overdue: false },
  { id: 3, date: "15/03/2026", vehicle: "J56 — FM011GB", type: "straordinaria", operator: "Ferrari A.", products: "Cloro 0.5%, Bomboletta ozono", nextDate: "22/03/2026", daysToNext: -2, overdue: true },
  { id: 4, date: "21/03/2026", vehicle: "J57 — FM012GB", type: "ordinaria", operator: "Gallo P.", products: "Amuchina spray", nextDate: "28/03/2026", daysToNext: 4, overdue: false },
  { id: 5, date: "10/03/2026", vehicle: "J58 — FM013GB", type: "ordinaria", operator: "Verdi G.", products: "Amuchina spray", nextDate: "17/03/2026", daysToNext: -7, overdue: true },
]

export const inventoryKpis = {
  total: 16,
  lowStock: 3,
  expiringSoon: 4,
  totalValue: 9847,
}
