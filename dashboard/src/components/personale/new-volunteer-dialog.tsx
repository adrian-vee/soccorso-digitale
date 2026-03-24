"use client"
import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface NewVolunteerDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7BA4D0]">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "h-8 px-2.5 rounded-[8px] border border-[#2E5E99]/15 bg-white/60 text-[12px] text-[#0D2440] placeholder:text-[#7BA4D0]/50 focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30"

export function NewVolunteerDialog({ open, onOpenChange }: NewVolunteerDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0D2440]/20 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-lg rounded-[18px] bg-white/80 backdrop-blur-2xl border border-white/70 shadow-[0_24px_64px_rgba(46,94,153,0.18)] p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-[#0D2440]">Nuovo Volontario</h2>
          <button onClick={() => onOpenChange(false)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#2E5E99]/10 transition-colors cursor-pointer">
            <X size={14} className="text-[#7BA4D0]" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome"><input className={inputCls} placeholder="Mario" /></Field>
          <Field label="Cognome"><input className={inputCls} placeholder="Rossi" /></Field>
          <Field label="Email">
            <input className={cn(inputCls, "col-span-2")} placeholder="m.rossi@org.it" type="email" />
          </Field>
          <Field label="Telefono"><input className={inputCls} placeholder="+39 345 000 0000" /></Field>
          <Field label="Ruolo">
            <select className={inputCls}>
              <option>Autista</option>
              <option>Soccorritore</option>
              <option>Centralinista</option>
              <option>Coordinatore</option>
            </select>
          </Field>
          <Field label="Sede">
            <select className={inputCls}>
              <option>Legnago</option>
              <option>Bovolone</option>
            </select>
          </Field>
          <Field label="Patente (tipo)">
            <select className={inputCls}>
              <option>B</option>
              <option>C</option>
              <option>D</option>
            </select>
          </Field>
          <Field label="Scad. Patente"><input className={inputCls} placeholder="gg/mm/aaaa" /></Field>
          <Field label="Scad. BLSD"><input className={inputCls} placeholder="gg/mm/aaaa" /></Field>
          <Field label="Scad. Form. 626"><input className={inputCls} placeholder="gg/mm/aaaa" /></Field>
        </div>

        <Field label="Note">
          <textarea className={cn(inputCls, "h-16 py-2 resize-none mt-3")} placeholder="Note aggiuntive..." />
        </Field>

        <div className="flex gap-2 mt-4">
          <button onClick={() => onOpenChange(false)} className="flex-1 h-9 rounded-[10px] border border-[#2E5E99]/20 text-[13px] text-[#7BA4D0] hover:bg-[#2E5E99]/5 transition-colors cursor-pointer">
            Annulla
          </button>
          <button className="flex-1 h-9 rounded-[10px] bg-[#2E5E99] text-white text-[13px] font-semibold hover:bg-[#254E82] transition-colors shadow-sm shadow-[#2E5E99]/20 cursor-pointer">
            Salva Volontario
          </button>
        </div>
      </div>
    </div>
  )
}
