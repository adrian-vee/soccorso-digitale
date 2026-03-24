"use client"
import * as React from "react"
import { CheckCircle2, AlertTriangle } from "lucide-react"
import type { slaData, complianceItems } from "@/lib/mock-analytics"

type SlaData = typeof slaData
type ComplianceItems = typeof complianceItems

interface SlaComplianceProps {
  sla: SlaData
  compliance: ComplianceItems
}

function GaugeArc({ value, max = 100 }: { value: number; max?: number }) {
  const pct = value / max
  const r = 56
  const cx = 80
  const cy = 80
  const startAngle = -210
  const sweepAngle = 240
  const toRad = (d: number) => (d * Math.PI) / 180
  const arc = (angle: number) => {
    const rad = toRad(angle)
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
  const start = arc(startAngle)
  const endBg = arc(startAngle + sweepAngle)
  const endFg = arc(startAngle + sweepAngle * pct)
  const largeBg = sweepAngle > 180 ? 1 : 0
  const largeFg = sweepAngle * pct > 180 ? 1 : 0

  return (
    <svg width="160" height="120" className="overflow-visible">
      <path
        d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeBg} 1 ${endBg.x} ${endBg.y}`}
        fill="none" stroke="rgba(46,94,153,0.12)" strokeWidth="10" strokeLinecap="round"
      />
      <path
        d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeFg} 1 ${endFg.x} ${endFg.y}`}
        fill="none" stroke="#2E5E99" strokeWidth="10" strokeLinecap="round"
      />
      <text x={cx} y={cy + 8} textAnchor="middle" className="text-[22px] font-light" fill="#0D2440" fontSize="22" fontWeight="300">{value}%</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="#7BA4D0" fontSize="10">SLA Rispettati</text>
    </svg>
  )
}

export function SlaCompliance({ sla, compliance }: SlaComplianceProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Gauge */}
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-2">SLA Compliance</h2>
        <div className="flex items-center justify-center">
          <GaugeArc value={sla.current} />
        </div>
        <div className="flex justify-around text-center mt-1">
          <div>
            <p className="text-[9px] text-[#7BA4D0] uppercase tracking-wider">Target</p>
            <p className="text-[14px] font-semibold text-[#0D2440]">{sla.target}%</p>
          </div>
          <div>
            <p className="text-[9px] text-[#7BA4D0] uppercase tracking-wider">Mese Scorso</p>
            <p className="text-[14px] font-semibold text-[#0D2440]">{sla.lastMonth}%</p>
          </div>
        </div>
      </div>

      {/* Compliance table */}
      <div className="rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_8px_rgba(46,94,153,0.05)] p-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.10em] text-[#7BA4D0] mb-3">Conformità Appalto</h2>
        <div className="space-y-1.5">
          {compliance.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {item.ok
                ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                : <AlertTriangle size={13} className="text-amber-600 shrink-0" />
              }
              <span className="flex-1 text-[12px] text-[#0D2440]">{item.label}</span>
              <span className={`text-[11px] font-medium ${item.ok ? "text-emerald-600" : "text-amber-600"}`}>{item.value}</span>
              <span className="text-[10px] text-[#7BA4D0]">/{item.target}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
