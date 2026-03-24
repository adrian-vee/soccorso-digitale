import * as React from "react"
import type { VehicleKm } from "@/lib/mock-analytics"

interface KmDetailTableProps {
  data: VehicleKm[]
}

export function KmDetailTable({ data }: KmDetailTableProps) {
  const totKm = data.reduce((s, v) => s + v.kmTotal, 0)
  const totPaz = data.reduce((s, v) => s + v.kmPaziente, 0)
  const totVuoto = data.reduce((s, v) => s + v.kmVuoto, 0)
  const totServ = data.reduce((s, v) => s + v.servizi, 0)
  const totCosto = data.reduce((s, v) => s + v.costo, 0)

  return (
    <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">Report KM Dettagliato — Per Veicolo</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#2E5E99]/[0.08]">
              {["Veicolo", "Targa", "KM Totali", "KM Paziente", "KM Vuoto", "Servizi", "Costo"].map(h => (
                <th key={h} className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((v, i) => (
              <tr key={v.id} className={`border-b border-[#2E5E99]/[0.05] ${i % 2 === 0 ? "bg-white/20" : ""}`}>
                <td className="px-4 py-2 font-semibold text-[#0D2440]">{v.id}</td>
                <td className="px-4 py-2 text-[#0D2440]/60">{v.plate}</td>
                <td className="px-4 py-2 font-medium text-[#0D2440]">{v.kmTotal.toLocaleString("it-IT")}</td>
                <td className="px-4 py-2 text-emerald-700">{v.kmPaziente.toLocaleString("it-IT")}</td>
                <td className="px-4 py-2 text-amber-600">{v.kmVuoto.toLocaleString("it-IT")}</td>
                <td className="px-4 py-2 text-[#0D2440]">{v.servizi}</td>
                <td className="px-4 py-2 text-[#0D2440]">€{v.costo}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#2E5E99]/15 bg-[#2E5E99]/[0.03]">
              <td colSpan={2} className="px-4 py-2 text-[11px] font-bold text-[#0D2440] uppercase tracking-wider">Totale</td>
              <td className="px-4 py-2 font-bold text-[#0D2440]">{totKm.toLocaleString("it-IT")}</td>
              <td className="px-4 py-2 font-bold text-emerald-700">{totPaz.toLocaleString("it-IT")}</td>
              <td className="px-4 py-2 font-bold text-amber-600">{totVuoto.toLocaleString("it-IT")}</td>
              <td className="px-4 py-2 font-bold text-[#0D2440]">{totServ}</td>
              <td className="px-4 py-2 font-bold text-[#0D2440]">€{totCosto}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
