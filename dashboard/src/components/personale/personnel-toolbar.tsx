"use client"
import * as React from "react"
import { Search, Download } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PersonnelFilters {
  search: string
  role: string
  sede: string
  certStatus: string
}

interface PersonnelToolbarProps {
  filters: PersonnelFilters
  onChange: (f: PersonnelFilters) => void
}

const ROLES = ["Tutti", "Autista", "Soccorritore", "Centralinista", "Coordinatore"]
const SEDI = ["Tutte", "Legnago", "Bovolone"]
const CERT_STATUSES = ["Tutti", "Tutto OK", "In Scadenza", "Scadute"]

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-8 rounded-[8px] border border-white/60 bg-white/55 backdrop-blur-xl px-2.5 text-[12px] text-[#0D2440] focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30 cursor-pointer"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export function PersonnelToolbar({ filters, onChange }: PersonnelToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[180px]">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7BA4D0]" />
        <input
          type="text"
          placeholder="Cerca volontario..."
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          className="w-full h-8 pl-8 pr-3 rounded-[8px] border border-white/60 bg-white/55 backdrop-blur-xl text-[12px] text-[#0D2440] placeholder:text-[#7BA4D0]/60 focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30"
        />
      </div>
      <Select value={filters.role} options={ROLES} onChange={v => onChange({ ...filters, role: v })} />
      <Select value={filters.sede} options={SEDI} onChange={v => onChange({ ...filters, sede: v })} />
      <Select value={filters.certStatus} options={CERT_STATUSES} onChange={v => onChange({ ...filters, certStatus: v })} />
      <button className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-white/60 bg-white/55 backdrop-blur-xl text-[12px] text-[#0D2440] hover:bg-white/70 transition-colors cursor-pointer">
        <Download size={12} className="text-[#7BA4D0]" />
        Export
      </button>
    </div>
  )
}
