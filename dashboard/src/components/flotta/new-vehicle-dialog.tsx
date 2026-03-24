"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import type { VehicleType } from "@/lib/mock-fleet"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const TYPE_OPTIONS: Array<{ value: VehicleType; label: string }> = [
  { value: "ambulanza",    label: "Ambulanza" },
  { value: "mezzo_leggero", label: "Mezzo Leggero" },
  { value: "pulmino",      label: "Pulmino" },
]

const SEDE_OPTIONS = ["Legnago", "Bovolone", "Cerea", "Nogara"]

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-[#0D2440]">
        {label}
        {required && <span className="text-[#2E5E99] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function StyledSelect({ value, onChange, children }: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full h-9 px-3 rounded-[9px] border border-[#2E5E99]/[0.12] bg-white/60",
        "text-[13px] text-[#0D2440] appearance-none cursor-pointer",
        "focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30 focus:border-[#2E5E99]/30 transition-colors"
      )}
    >
      {children}
    </select>
  )
}

const EMPTY_FORM = {
  code: "",
  name: "",
  plate: "",
  year: String(new Date().getFullYear()),
  type: "ambulanza" as VehicleType,
  sede: "Legnago",
  km: "",
  insurance: "",
  revision: "",
  nextServiceKm: "",
  notes: "",
}

interface NewVehicleDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit?: (data: typeof EMPTY_FORM) => void
}

export function NewVehicleDialog({ open, onOpenChange, onSubmit }: NewVehicleDialogProps) {
  const [form, setForm] = React.useState(EMPTY_FORM)
  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const canSubmit = form.code.trim() && form.name.trim() && form.plate.trim()

  function handleSubmit() {
    onSubmit?.(form)
    onOpenChange(false)
    setForm(EMPTY_FORM)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Veicolo</DialogTitle>
          <DialogDescription>
            Aggiungi un veicolo alla flotta. I campi con * sono obbligatori.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">
          {/* Row 1: Code + Type */}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Codice Interno" required>
              <Input placeholder="J59" value={form.code} onChange={(e) => set("code", e.target.value)} />
            </FormRow>
            <FormRow label="Tipo">
              <StyledSelect value={form.type} onChange={(v) => set("type", v)}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </StyledSelect>
            </FormRow>
          </div>

          {/* Row 2: Name + Plate */}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Marca / Modello" required>
              <Input placeholder="Fiat Ducato" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </FormRow>
            <FormRow label="Targa" required>
              <Input placeholder="AB123CD" value={form.plate} onChange={(e) => set("plate", e.target.value)} className="uppercase" />
            </FormRow>
          </div>

          {/* Row 3: Year + Sede */}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Anno">
              <Input type="number" placeholder="2024" value={form.year} onChange={(e) => set("year", e.target.value)} />
            </FormRow>
            <FormRow label="Sede">
              <StyledSelect value={form.sede} onChange={(v) => set("sede", v)}>
                {SEDE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </StyledSelect>
            </FormRow>
          </div>

          <div className="h-px bg-[#2E5E99]/[0.06]" />

          {/* Row 4: KM + Next service KM */}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="KM Attuali">
              <Input type="number" placeholder="0" value={form.km} onChange={(e) => set("km", e.target.value)} />
            </FormRow>
            <FormRow label="Tagliando a (km)">
              <Input type="number" placeholder="15000" value={form.nextServiceKm} onChange={(e) => set("nextServiceKm", e.target.value)} />
            </FormRow>
          </div>

          {/* Row 5: Insurance + Revision */}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Scad. Assicurazione">
              <Input type="date" value={form.insurance} onChange={(e) => set("insurance", e.target.value)} />
            </FormRow>
            <FormRow label="Scad. Revisione">
              <Input type="date" value={form.revision} onChange={(e) => set("revision", e.target.value)} />
            </FormRow>
          </div>

          <FormRow label="Note">
            <Textarea
              placeholder="Note aggiuntive..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="min-h-[56px]"
            />
          </FormRow>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-[9px] text-[13px] font-medium text-[#0D2440] bg-white/50 border border-white/60 hover:bg-white/70 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "h-9 px-5 rounded-[9px] text-[13px] font-semibold text-white transition-all",
              canSubmit
                ? "bg-[#2E5E99] hover:bg-[#254E82] shadow-sm shadow-[#2E5E99]/20"
                : "bg-[#2E5E99]/40 cursor-not-allowed"
            )}
          >
            Aggiungi Veicolo
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
