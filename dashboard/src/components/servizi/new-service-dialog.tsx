"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { mockVehicles, type ServiceType, type ServicePriority } from "@/lib/mock-services"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const TYPE_OPTIONS: Array<{ value: ServiceType; label: string }> = [
  { value: "dialisi",       label: "Dialisi" },
  { value: "visita",        label: "Visita Specialistica" },
  { value: "trasferimento", label: "Trasferimento" },
  { value: "dimissione",    label: "Dimissione" },
  { value: "altro",         label: "Altro" },
]

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

function StyledSelect({ value, onChange, children, className }: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full h-9 px-3 rounded-[9px] border border-[#2E5E99]/[0.12] bg-white/60 backdrop-blur-sm",
        "text-[13px] text-[#0D2440] appearance-none",
        "focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30 focus:border-[#2E5E99]/30",
        "transition-colors cursor-pointer",
        className
      )}
    >
      {children}
    </select>
  )
}

interface NewServiceDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit?: (data: Record<string, string>) => void
}

export function NewServiceDialog({ open, onOpenChange, onSubmit }: NewServiceDialogProps) {
  const [form, setForm] = React.useState({
    type: "dialisi" as ServiceType,
    date: new Date().toISOString().slice(0, 10),
    time: "08:00",
    patient: "",
    phone: "",
    origin: "",
    destination: "",
    vehicle: "",
    priority: "normale" as ServicePriority,
    notes: "",
  })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const availableVehicles = mockVehicles.filter((v) => v.status === "attivo")

  function handleSubmit() {
    onSubmit?.(form as Record<string, string>)
    onOpenChange(false)
    setForm({
      type: "dialisi",
      date: new Date().toISOString().slice(0, 10),
      time: "08:00",
      patient: "",
      phone: "",
      origin: "",
      destination: "",
      vehicle: "",
      priority: "normale",
      notes: "",
    })
  }

  const canSubmit = form.patient.trim() && form.origin.trim() && form.destination.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Servizio</DialogTitle>
          <DialogDescription>Inserisci i dati del servizio. I campi contrassegnati con * sono obbligatori.</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">
          {/* Row 1: Tipo + Priorità */}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Tipo servizio" required>
              <StyledSelect value={form.type} onChange={(v) => set("type", v as ServiceType)}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </StyledSelect>
            </FormRow>
            <FormRow label="Priorità">
              <StyledSelect value={form.priority} onChange={(v) => set("priority", v as ServicePriority)}>
                <option value="normale">Normale</option>
                <option value="urgente">Urgente</option>
              </StyledSelect>
            </FormRow>
          </div>

          {/* Row 2: Data + Ora */}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Data" required>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </FormRow>
            <FormRow label="Ora" required>
              <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
            </FormRow>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#2E5E99]/[0.06]" />

          {/* Row 3: Paziente + Telefono */}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Paziente" required>
              <Input
                placeholder="Nome Cognome"
                value={form.patient}
                onChange={(e) => set("patient", e.target.value)}
              />
            </FormRow>
            <FormRow label="Telefono">
              <Input
                placeholder="+39 000 0000000"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </FormRow>
          </div>

          {/* Row 4: Origine */}
          <FormRow label="Partenza" required>
            <Input
              placeholder="Indirizzo o struttura di partenza"
              value={form.origin}
              onChange={(e) => set("origin", e.target.value)}
            />
          </FormRow>

          {/* Row 5: Destinazione */}
          <FormRow label="Destinazione" required>
            <Input
              placeholder="Indirizzo o struttura di arrivo"
              value={form.destination}
              onChange={(e) => set("destination", e.target.value)}
            />
          </FormRow>

          {/* Row 6: Mezzo */}
          <FormRow label="Mezzo">
            <StyledSelect value={form.vehicle} onChange={(v) => set("vehicle", v)}>
              <option value="">— Non assegnato —</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.id} · {v.name} ({v.plate})</option>
              ))}
            </StyledSelect>
          </FormRow>

          {/* Row 7: Note */}
          <FormRow label="Note">
            <Textarea
              placeholder="Note aggiuntive, istruzioni speciali..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="min-h-[64px]"
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
            Crea Servizio
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
