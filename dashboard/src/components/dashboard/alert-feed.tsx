"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { useLowStockAlerts, useExpiringInventory } from "@/hooks/use-inventory"
import { AlertTriangle, Package, Clock, CheckCircle } from "lucide-react"

function AlertSkeleton() {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-[9px] bg-white/40 border border-white/50 animate-pulse">
      <div className="w-5 h-5 bg-[#2E5E99]/10 rounded-full shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-[#2E5E99]/10 rounded w-3/4" />
        <div className="h-2 bg-[#2E5E99]/06 rounded w-1/2" />
      </div>
    </div>
  )
}

interface AlertItem {
  id: string
  type: 'low-stock' | 'expiring'
  title: string
  detail: string
  severity: 'critical' | 'warning'
}

function buildAlerts(lowStock: any[], expiring: any[]): AlertItem[] {
  const stockAlerts: AlertItem[] = lowStock.slice(0, 3).map((item) => ({
    id: `stock-${item.id ?? item.itemId ?? Math.random()}`,
    type: 'low-stock',
    title: item.name ?? item.itemName ?? 'Articolo',
    detail: `Scorta: ${item.currentQuantity ?? item.quantity ?? 0} rimasti`,
    severity: (item.currentQuantity ?? item.quantity ?? 0) === 0 ? 'critical' : 'warning',
  }))

  const expiryAlerts: AlertItem[] = expiring.slice(0, 2).map((item) => ({
    id: `exp-${item.id ?? item.itemId ?? Math.random()}`,
    type: 'expiring',
    title: item.name ?? item.itemName ?? 'Articolo',
    detail: item.expiryDate
      ? `Scade il ${new Date(item.expiryDate).toLocaleDateString('it-IT')}`
      : 'Data scadenza non disponibile',
    severity: 'warning',
  }))

  return [...stockAlerts, ...expiryAlerts].slice(0, 5)
}

export function AlertFeed() {
  const { data: lowStock = [], isLoading: loadingStock } = useLowStockAlerts()
  const { data: expiring = [], isLoading: loadingExpiry } = useExpiringInventory()
  const isLoading = loadingStock || loadingExpiry

  const alerts = React.useMemo(
    () => buildAlerts(lowStock, expiring),
    [lowStock, expiring]
  )

  return (
    <div className="relative overflow-hidden rounded-[14px] bg-white/55 backdrop-blur-xl border border-white/60 shadow-[0_2px_12px_rgba(46,94,153,0.06)]">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#2E5E99] to-[#7BA4D0] opacity-40" />

      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#0D2440]">Alert Operativi</p>
          <p className="text-[11px] text-[#7BA4D0]/80 mt-0.5">Scorte e scadenze</p>
        </div>
        {!isLoading && alerts.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-100 text-[10px] font-semibold text-red-600">
            {alerts.length} alert
          </span>
        )}
      </div>

      <div className="px-3 pb-4 space-y-1.5">
        {isLoading ? (
          <>
            <AlertSkeleton />
            <AlertSkeleton />
            <AlertSkeleton />
          </>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <CheckCircle size={16} className="text-emerald-500" />
            </div>
            <p className="text-[12px] text-[#7BA4D0]">Nessun alert attivo</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 px-3 py-2.5 rounded-[9px] border",
                alert.severity === 'critical'
                  ? "bg-red-50/70 border-red-100"
                  : "bg-amber-50/60 border-amber-100"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                alert.severity === 'critical' ? "bg-red-100" : "bg-amber-100"
              )}>
                {alert.type === 'expiring'
                  ? <Clock size={10} className={cn(alert.severity === 'critical' ? "text-red-600" : "text-amber-600")} />
                  : <Package size={10} className={cn(alert.severity === 'critical' ? "text-red-600" : "text-amber-600")} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#0D2440] truncate">{alert.title}</p>
                <p className={cn(
                  "text-[10px] mt-0.5",
                  alert.severity === 'critical' ? "text-red-500" : "text-amber-600"
                )}>
                  {alert.detail}
                </p>
              </div>
              {alert.severity === 'critical' && (
                <AlertTriangle size={12} className="text-red-500 shrink-0 mt-1" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
