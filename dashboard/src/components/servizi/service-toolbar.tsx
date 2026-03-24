"use client"
import * as React from "react"
import { Search, Upload, Plus, LayoutGrid, List, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ServiceStatus, ServiceType } from "@/lib/mock-services"

const STATUS_OPTIONS: Array<{ value: ServiceStatus | "tutti"; label: string }> = [
  { value: "tutti", label: "Tutti gli stati" },
  { value: "programmato", label: "Programmato" },
  { value: "in_corso", label: "In Corso" },
  { value: "completato", label: "Completato" },
  { value: "ritardo", label: "Ritardo" },
  { value: "annullato", label: "Annullato" },
]

const TIPO_OPTIONS: Array<{ value: ServiceType | "tutti"; label: string }> = [
  { value: "tutti", label: "Tutti i tipi" },
  { value: "dialisi", label: "Dialisi" },
  { value: "visita", label: "Visita Spec." },
  { value: "trasferimento", label: "Trasferimento" },
  { value: "dimissione", label: "Dimissione" },
]

const SEDE_OPTIONS = ["Tutte le sedi", "Legnago", "Bovolone"]
const VEHICLE_OPTIONS = ["Tutti i mezzi", "J54", "J55", "J56", "J57", "J58"]

interface Filters {
  search: string
  status: ServiceStatus | "tutti"
  tipo: ServiceType | "tutti"
  sede: string
  vehicle: string
}

interface ServiceToolbarProps {
  filters: Filters
  onFiltersChange: (f: Filters) => void
  view: "list" | "grid"
  onViewChange: (v: "list" | "grid") => void
  onUploadClick: () => void
  onNewClick: () => void
}

function FilterSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string } | string>
  onChange: (v: T) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          "appearance-none h-8 pl-3 pr-7 rounded-[9px] text-[12px] font-medium",
          "bg-white/50 border border-white/60 text-[#0D2440]",
          "focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/20 focus:border-[#2E5E99]/20",
          "cursor-pointer transition-colors hover:bg-white/70"
        )}
      >
        {options.map((opt) => {
          if (typeof opt === "string") {
            return <option key={opt} value={opt}>{opt}</option>
          }
          return <option key={opt.value} value={opt.value}>{opt.label}</option>
        })}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7BA4D0] pointer-events-none" />
    </div>
  )
}

export function ServiceToolbar({ filters, onFiltersChange, view, onViewChange, onUploadClick, onNewClick }: ServiceToolbarProps) {
  const set = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    onFiltersChange({ ...filters, [key]: val })

  return (
    <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-[14px] px-4 py-3 flex items-center gap-2.5 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-[260px]">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7BA4D0]" />
        <input
          type="text"
          placeholder="Cerca paziente, struttura..."
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          className={cn(
            "w-full h-8 pl-8 pr-3 rounded-[9px] text-[12px]",
            "bg-white/60 border border-white/60 text-[#0D2440] placeholder:text-[#7BA4D0]/50",
            "focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/20 focus:border-[#2E5E99]/20",
            "transition-colors"
          )}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-[#2E5E99]/10" />

      {/* Filters */}
      <FilterSelect<ServiceStatus | "tutti">
        value={filters.status}
        options={STATUS_OPTIONS}
        onChange={(v) => set("status", v)}
      />
      <FilterSelect<ServiceType | "tutti">
        value={filters.tipo}
        options={TIPO_OPTIONS}
        onChange={(v) => set("tipo", v)}
      />
      <FilterSelect<string>
        value={filters.vehicle}
        options={VEHICLE_OPTIONS}
        onChange={(v) => set("vehicle", v)}
      />
      <FilterSelect<string>
        value={filters.sede}
        options={SEDE_OPTIONS}
        onChange={(v) => set("sede", v)}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <button
        onClick={onUploadClick}
        className={cn(
          "flex items-center gap-1.5 h-8 px-3 rounded-[9px] text-[12px] font-medium",
          "bg-white/50 border border-white/60 text-[#0D2440] hover:bg-white/70",
          "transition-all"
        )}
      >
        <Upload size={13} className="text-[#7BA4D0]" />
        Upload PDF
      </button>
      <button
        onClick={onNewClick}
        className={cn(
          "flex items-center gap-1.5 h-8 px-3.5 rounded-[9px] text-[12px] font-semibold",
          "bg-[#2E5E99] text-white hover:bg-[#254E82]",
          "transition-colors shadow-sm shadow-[#2E5E99]/20"
        )}
      >
        <Plus size={13} />
        Nuovo Servizio
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-[#2E5E99]/10" />

      {/* View toggle */}
      <div className="flex items-center gap-0.5 bg-white/40 border border-white/50 rounded-[9px] p-0.5">
        <button
          onClick={() => onViewChange("list")}
          className={cn(
            "w-7 h-7 rounded-[7px] flex items-center justify-center transition-all",
            view === "list" ? "bg-white text-[#2E5E99] shadow-sm" : "text-[#7BA4D0] hover:text-[#0D2440]"
          )}
          aria-label="Vista lista"
        >
          <List size={13} />
        </button>
        <button
          onClick={() => onViewChange("grid")}
          className={cn(
            "w-7 h-7 rounded-[7px] flex items-center justify-center transition-all",
            view === "grid" ? "bg-white text-[#2E5E99] shadow-sm" : "text-[#7BA4D0] hover:text-[#0D2440]"
          )}
          aria-label="Vista griglia"
        >
          <LayoutGrid size={13} />
        </button>
      </div>
    </div>
  )
}
