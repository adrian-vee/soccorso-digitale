import * as React from "react"
import { FileDown } from "lucide-react"
import type { UtifRow } from "@/lib/mock-analytics"

interface UtifReportTableProps {
  data: UtifRow[]
}

export function UtifReportTable({ data }: UtifReportTableProps) {
  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">Report Accise UTIF</h2>
        <button className="flex items-center gap-1.5 h-7 px-3 rounded-[7px] bg-[#2E5E99]/10 text-[11px] text-[#2E5E99] font-medium hover:bg-[#2E5E99]/20 transition-colors cursor-pointer">
          <FileDown size={12} />
          Genera Report UTIF
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#2E5E99]/[0.08]">
              {["Veicolo", "Targa", "KM Mese", "Litri Stimati", "Accisa Dovuta"].map(h => (
                <th key={h} className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.id} className={`border-b border-[#2E5E99]/[0.05] ${i % 2 === 0 ? "bg-white/20" : ""}`}>
                <td className="px-4 py-2 font-semibold text-[#0D2440]">{r.id}</td>
                <td className="px-4 py-2 text-[#0D2440]/60">{r.plate}</td>
                <td className="px-4 py-2 text-[#0D2440]">{r.kmMese.toLocaleString("it-IT")}</td>
                <td className="px-4 py-2 text-[#0D2440]">{r.litriStimati.toFixed(1)} L</td>
                <td className="px-4 py-2 font-medium text-[#2E5E99]">€{r.accisaDovuta.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#2E5E99]/15 bg-[#2E5E99]/[0.03]">
              <td colSpan={4} className="px-4 py-2 text-[11px] font-bold text-[#0D2440]">Totale Accise</td>
              <td className="px-4 py-2 font-bold text-[#2E5E99]">
                €{data.reduce((s, r) => s + r.accisaDovuta, 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
