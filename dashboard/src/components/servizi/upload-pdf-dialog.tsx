"use client"
import * as React from "react"
import { Upload, FileText, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { mockVehicles } from "@/lib/mock-services"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"

interface UploadPDFDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function UploadPDFDialog({ open, onOpenChange }: UploadPDFDialogProps) {
  const [file, setFile] = React.useState<File | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const [selectedVehicles, setSelectedVehicles] = React.useState<Set<string>>(new Set())
  const inputRef = React.useRef<HTMLInputElement>(null)

  const availableVehicles = mockVehicles.filter((v) => v.status === "attivo")

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type === "application/pdf") setFile(f)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  function toggleVehicle(id: string) {
    setSelectedVehicles((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSubmit() {
    // placeholder — will call actual API
    onOpenChange(false)
    setFile(null)
    setSelectedVehicles(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Carica Programma Giornaliero</DialogTitle>
          <DialogDescription>
            Carica un PDF con i servizi del giorno. Il sistema estrarrà automaticamente i dati e li assegnerà ai veicoli selezionati.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
              dragging
                ? "border-[#2E5E99]/50 bg-[#2E5E99]/[0.04]"
                : file
                ? "border-[#2E5E99]/30 bg-[#2E5E99]/[0.03]"
                : "border-[#2E5E99]/15 hover:border-[#2E5E99]/30 hover:bg-[#2E5E99]/[0.02]"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-[#2E5E99]/[0.08] flex items-center justify-center">
                  <FileText size={22} className="text-[#2E5E99]" />
                </div>
                <p className="text-[13px] font-semibold text-[#0D2440]">{file.name}</p>
                <p className="text-[11px] text-[#7BA4D0]">{(file.size / 1024).toFixed(0)} KB · PDF</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-600 mt-1"
                >
                  <X size={12} /> Rimuovi
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-[#2E5E99]/[0.07] flex items-center justify-center">
                  <Upload size={20} className="text-[#7BA4D0]" />
                </div>
                <p className="text-[13px] font-medium text-[#0D2440]">Trascina il PDF qui</p>
                <p className="text-[11px] text-[#7BA4D0]">oppure clicca per selezionare il file</p>
              </div>
            )}
          </div>

          {/* Vehicle selection */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-[#7BA4D0] mb-2">
              Assegna ai veicoli
            </h4>
            <div className="flex flex-wrap gap-2">
              {availableVehicles.map((v) => {
                const checked = selectedVehicles.has(v.id)
                return (
                  <button
                    key={v.id}
                    onClick={() => toggleVehicle(v.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-[10px] border text-left transition-all",
                      checked
                        ? "bg-[#2E5E99]/[0.08] border-[#2E5E99]/25 text-[#2E5E99]"
                        : "bg-white/50 border-white/60 text-[#0D2440] hover:bg-white/70"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all",
                      checked ? "bg-[#2E5E99] border-[#2E5E99]" : "bg-white border-[#2E5E99]/20"
                    )}>
                      {checked && <Check size={10} className="text-white" />}
                    </div>
                    <span className="font-mono font-bold text-[12px]">{v.id}</span>
                    <span className="text-[11px] text-[#7BA4D0]">{v.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
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
            disabled={!file || selectedVehicles.size === 0}
            className={cn(
              "h-9 px-5 rounded-[9px] text-[13px] font-semibold text-white transition-all",
              file && selectedVehicles.size > 0
                ? "bg-[#2E5E99] hover:bg-[#254E82] shadow-sm shadow-[#2E5E99]/20"
                : "bg-[#2E5E99]/40 cursor-not-allowed"
            )}
          >
            Carica e Assegna
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
