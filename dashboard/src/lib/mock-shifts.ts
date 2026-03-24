export type ShiftSlot = 'mattina' | 'pomeriggio'

export interface ShiftVolunteer {
  id: number
  name: string
  initials: string
  role: string
}

export interface Shift {
  id: number
  day: string
  dayLabel: string
  slot: ShiftSlot
  slotLabel: string
  volunteers: ShiftVolunteer[]
  required: number
  covered: boolean
}

export interface AvailabilityRow {
  id: number
  name: string
  days: boolean[] // [Lun, Mar, Mer, Gio, Ven, Sab, Dom]
}

export const mockShifts: Shift[] = [
  { id: 1, day: "2026-03-24", dayLabel: "Lun 24/03", slot: "mattina", slotLabel: "06:00–14:00",
    volunteers: [
      { id: 1, name: "Rossi M.", initials: "MR", role: "autista" },
      { id: 2, name: "Bianchi L.", initials: "LB", role: "soccorritore" }
    ], required: 2, covered: true },
  { id: 2, day: "2026-03-24", dayLabel: "Lun 24/03", slot: "pomeriggio", slotLabel: "14:00–22:00",
    volunteers: [
      { id: 3, name: "Ferrari A.", initials: "AF", role: "soccorritore" },
      { id: 7, name: "Moretti L.", initials: "LM", role: "coordinatore" }
    ], required: 2, covered: true },
  { id: 3, day: "2026-03-25", dayLabel: "Mar 25/03", slot: "mattina", slotLabel: "06:00–14:00",
    volunteers: [
      { id: 1, name: "Rossi M.", initials: "MR", role: "autista" },
      { id: 4, name: "Verdi G.", initials: "GV", role: "autista" }
    ], required: 2, covered: true },
  { id: 4, day: "2026-03-25", dayLabel: "Mar 25/03", slot: "pomeriggio", slotLabel: "14:00–22:00",
    volunteers: [
      { id: 6, name: "Gallo P.", initials: "PG", role: "soccorritore" },
      { id: 5, name: "Costa F.", initials: "FC", role: "centralinista" }
    ], required: 2, covered: true },
  { id: 5, day: "2026-03-26", dayLabel: "Mer 26/03", slot: "mattina", slotLabel: "06:00–14:00",
    volunteers: [
      { id: 2, name: "Bianchi L.", initials: "LB", role: "soccorritore" },
      { id: 4, name: "Verdi G.", initials: "GV", role: "autista" }
    ], required: 2, covered: true },
  { id: 6, day: "2026-03-26", dayLabel: "Mer 26/03", slot: "pomeriggio", slotLabel: "14:00–22:00",
    volunteers: [
      { id: 1, name: "Rossi M.", initials: "MR", role: "autista" },
      { id: 6, name: "Gallo P.", initials: "PG", role: "soccorritore" }
    ], required: 2, covered: true },
  { id: 7, day: "2026-03-27", dayLabel: "Gio 27/03", slot: "mattina", slotLabel: "06:00–14:00",
    volunteers: [
      { id: 1, name: "Rossi M.", initials: "MR", role: "autista" },
      { id: 5, name: "Costa F.", initials: "FC", role: "centralinista" }
    ], required: 2, covered: true },
  { id: 8, day: "2026-03-27", dayLabel: "Gio 27/03", slot: "pomeriggio", slotLabel: "14:00–22:00",
    volunteers: [
      { id: 7, name: "Moretti L.", initials: "LM", role: "coordinatore" },
      { id: 2, name: "Bianchi L.", initials: "LB", role: "soccorritore" }
    ], required: 2, covered: true },
  { id: 9, day: "2026-03-28", dayLabel: "Ven 28/03", slot: "mattina", slotLabel: "06:00–14:00",
    volunteers: [
      { id: 3, name: "Ferrari A.", initials: "AF", role: "soccorritore" },
      { id: 6, name: "Gallo P.", initials: "PG", role: "soccorritore" }
    ], required: 2, covered: true },
  { id: 10, day: "2026-03-28", dayLabel: "Ven 28/03", slot: "pomeriggio", slotLabel: "14:00–22:00",
    volunteers: [
      { id: 5, name: "Costa F.", initials: "FC", role: "centralinista" },
      { id: 7, name: "Moretti L.", initials: "LM", role: "coordinatore" }
    ], required: 2, covered: true },
  { id: 11, day: "2026-03-29", dayLabel: "Sab 29/03", slot: "mattina", slotLabel: "06:00–14:00",
    volunteers: [], required: 2, covered: false },
  { id: 12, day: "2026-03-29", dayLabel: "Sab 29/03", slot: "pomeriggio", slotLabel: "14:00–22:00",
    volunteers: [], required: 2, covered: false },
  { id: 13, day: "2026-03-30", dayLabel: "Dom 30/03", slot: "mattina", slotLabel: "06:00–14:00",
    volunteers: [], required: 2, covered: false },
  { id: 14, day: "2026-03-30", dayLabel: "Dom 30/03", slot: "pomeriggio", slotLabel: "14:00–22:00",
    volunteers: [
      { id: 4, name: "Verdi G.", initials: "GV", role: "autista" }
    ], required: 2, covered: false },
]

export const mockAvailability: AvailabilityRow[] = [
  { id: 1, name: "Rossi M.", days: [true, true, true, true, true, false, false] },
  { id: 2, name: "Bianchi L.", days: [true, true, false, true, false, false, false] },
  { id: 3, name: "Ferrari A.", days: [false, false, true, false, true, true, false] },
  { id: 4, name: "Verdi G.", days: [true, true, true, true, false, false, true] },
  { id: 5, name: "Costa F.", days: [true, true, false, true, true, false, false] },
  { id: 6, name: "Gallo P.", days: [true, true, true, false, true, false, false] },
  { id: 7, name: "Moretti L.", days: [true, false, false, true, true, false, false] },
]
