"use client"
import * as React from "react"
import { usePathname } from "next/navigation"
import { Bell, Search, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Panoramica operativa di oggi" },
  "/dashboard/servizi": { title: "Servizi", subtitle: "Programma giornaliero" },
  "/dashboard/flotta": { title: "Flotta", subtitle: "Stato veicoli" },
  "/dashboard/personale": { title: "Personale", subtitle: "Volontari e turni" },
  "/dashboard/turni": { title: "Turni", subtitle: "Gestione turni" },
  "/dashboard/report": { title: "Report", subtitle: "Analytics e statistiche" },
  "/dashboard/impostazioni": { title: "Impostazioni", subtitle: "Configurazione account" },
  "/dashboard/appalti": { title: "Appalti", subtitle: "Gare e contratti ULSS" },
}

export function Header() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const page = PAGE_TITLES[pathname] ?? { title: "Dashboard", subtitle: "" }

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[#2E5E99]/8 bg-white/40 backdrop-blur-sm">
      <div>
        <h1 className="text-base font-semibold text-[#0D2440]">{page.title}</h1>
        {page.subtitle && <p className="text-xs text-[#7BA4D0]">{page.subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" aria-label="Cerca">
          <Search size={15} className="text-[#7BA4D0]" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 relative" aria-label="Notifiche">
          <Bell size={15} className="text-[#7BA4D0]" />
          <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-[#2E5E99]" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8"
          aria-label="Cambia tema"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={15} className="text-[#7BA4D0]" /> : <Moon size={15} className="text-[#7BA4D0]" />}
        </Button>
      </div>
    </header>
  )
}
