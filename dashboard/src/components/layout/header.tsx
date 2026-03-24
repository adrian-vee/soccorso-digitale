"use client"
import * as React from "react"
import { usePathname } from "next/navigation"
import { Bell, Search, ChevronDown, User, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { Theme } from "@/components/ui/theme"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/":              { title: "Dashboard",    subtitle: "Panoramica operativa di oggi" },
  "/servizi":       { title: "Servizi",      subtitle: "Programma giornaliero" },
  "/flotta":        { title: "Flotta",       subtitle: "Gestione veicoli e scadenze" },
  "/personale":     { title: "Personale",    subtitle: "Volontari e turni" },
  "/turni":         { title: "Turni",        subtitle: "Gestione turni" },
  "/prenotazioni":  { title: "Prenotazioni", subtitle: "Prenotazioni servizi" },
  "/documenti":     { title: "Documenti",    subtitle: "Archivio documenti" },
  "/analytics":     { title: "Analytics",    subtitle: "Report e statistiche" },
  "/inventario":    { title: "Inventario",   subtitle: "Gestione materiali" },
  "/mappa":         { title: "Mappa Live",   subtitle: "Posizioni GPS veicoli" },
  "/impostazioni":  { title: "Impostazioni", subtitle: "Configurazione account" },
}

const TIME_FILTERS = ["7G", "30G", "90G"] as const

export function Header() {
  const pathname = usePathname()
  const { displayName, initials, email, signOut } = useAuth()
  const page = PAGE_TITLES[pathname] ?? { title: "Dashboard", subtitle: "" }
  const [activeFilter, setActiveFilter] = React.useState<string>("30G")

  return (
    <header className="h-[60px] shrink-0 flex items-center justify-between px-5 border-b border-[#2E5E99]/[0.07] bg-white/40 backdrop-blur-xl">
      <div>
        <h1 className="text-[15px] font-semibold text-[#0D2440] leading-tight">{page.title}</h1>
        {page.subtitle && <p className="text-[11px] text-[#7BA4D0]/80 leading-tight">{page.subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* Time filter pills */}
        <div className="flex items-center gap-0.5 bg-[#2E5E99]/[0.06] border border-[#2E5E99]/[0.09] rounded-[9px] p-0.5 mr-1">
          {TIME_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-[7px] text-[11px] font-medium transition-all",
                activeFilter === f
                  ? "bg-white text-[#2E5E99] shadow-sm"
                  : "text-[#7BA4D0] hover:text-[#0D2440]"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <button
          className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center bg-white/50 border border-white/60 text-[#7BA4D0] hover:text-[#2E5E99] hover:bg-white/70 transition-all"
          aria-label="Cerca"
        >
          <Search size={14} />
        </button>

        {/* Notifications */}
        <button
          className="relative w-[34px] h-[34px] rounded-[9px] flex items-center justify-center bg-white/50 border border-white/60 text-[#7BA4D0] hover:text-[#2E5E99] hover:bg-white/70 transition-all"
          aria-label="Notifiche"
        >
          <Bell size={14} />
          <span className="absolute top-[7px] right-[7px] w-1.5 h-1.5 rounded-full bg-[#2E5E99]" />
        </button>

        {/* Theme toggle */}
        <Theme variant="tabs" size="sm" themes={["light", "dark", "system"]} />

        {/* Divider */}
        <div className="w-px h-5 bg-[#2E5E99]/[0.10] mx-0.5" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-[10px] hover:bg-white/50 transition-colors group">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
                {initials}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-[12px] font-semibold text-[#0D2440] leading-tight max-w-[100px] truncate">{displayName}</p>
              </div>
              <ChevronDown size={12} className="text-[#7BA4D0] group-hover:text-[#2E5E99] transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuLabel>
              <div>
                <p className="text-[12px] font-semibold text-[#0D2440]">{displayName}</p>
                <p className="text-[10px] text-[#7BA4D0] font-normal">{email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/personale" className="flex items-center gap-2">
                <User size={13} className="text-[#7BA4D0]" />
                Profilo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/impostazioni" className="flex items-center gap-2">
                <Settings size={13} className="text-[#7BA4D0]" />
                Impostazioni
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-red-500 focus:text-red-600 focus:bg-red-500/5"
            >
              <LogOut size={13} className="mr-2" />
              Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
