"use client"
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Ambulance, Calendar, Users, BarChart3, Settings,
  FileText, MapPin, Bell, ChevronLeft, ChevronRight, Building2,
  Briefcase, Clock
} from "lucide-react"
import { Separator } from "@/components/ui/separator"

const NAV_SECTIONS = [
  {
    label: "OPERATIVO",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/dashboard/servizi", icon: Calendar, label: "Servizi" },
      { href: "/dashboard/mappa", icon: MapPin, label: "Mappa Live" },
    ],
  },
  {
    label: "FLOTTA",
    items: [
      { href: "/dashboard/flotta", icon: Ambulance, label: "Veicoli" },
      { href: "/dashboard/turni", icon: Clock, label: "Turni" },
    ],
  },
  {
    label: "PERSONALE",
    items: [
      { href: "/dashboard/personale", icon: Users, label: "Volontari" },
      { href: "/dashboard/appalti", icon: Briefcase, label: "Appalti" },
    ],
  },
  {
    label: "REPORT",
    items: [
      { href: "/dashboard/report", icon: BarChart3, label: "Analytics" },
      { href: "/dashboard/documenti", icon: FileText, label: "Documenti" },
    ],
  },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed: externalCollapsed, onToggle }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false)
  const pathname = usePathname()

  const isCollapsed = externalCollapsed ?? collapsed
  const handleToggle = onToggle ?? (() => setCollapsed((c) => !c))

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen transition-all duration-300 ease-in-out",
        "bg-white/60 backdrop-blur-xl border-r border-[#2E5E99]/8",
        "shadow-[1px_0_0_rgba(46,94,153,0.06)]",
        isCollapsed ? "w-16" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-16 px-4 shrink-0", isCollapsed && "justify-center px-2")}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#2E5E99] shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        {!isCollapsed && (
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-semibold text-[#0D2440] truncate">Soccorso Digitale</p>
            <p className="text-[10px] text-[#7BA4D0] truncate">v2.0 BETA</p>
          </div>
        )}
      </div>

      <Separator className="bg-[#2E5E99]/8" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-3">
            {!isCollapsed && (
              <p className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-[#7BA4D0]/60 uppercase">
                {section.label}
              </p>
            )}
            {isCollapsed && <div className="h-px bg-[#2E5E99]/8 mx-1 my-2" />}
            {section.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                    active
                      ? "bg-[#2E5E99]/10 text-[#2E5E99]"
                      : "text-[#0D2440]/60 hover:text-[#0D2440] hover:bg-[#2E5E99]/5",
                    isCollapsed && "justify-center px-2"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#2E5E99] rounded-r-full" />
                  )}
                  <item.icon
                    size={16}
                    className={cn("shrink-0", active ? "text-[#2E5E99]" : "text-[#7BA4D0]")}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <Separator className="bg-[#2E5E99]/8" />

      {/* Footer: settings + user */}
      <div className="px-2 py-3 space-y-1">
        <Link
          href="/dashboard/impostazioni"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
            "text-[#0D2440]/60 hover:text-[#0D2440] hover:bg-[#2E5E99]/5",
            isCollapsed && "justify-center px-2"
          )}
          title={isCollapsed ? "Impostazioni" : undefined}
        >
          <Settings size={16} className="text-[#7BA4D0] shrink-0" />
          {!isCollapsed && <span>Impostazioni</span>}
        </Link>

        {!isCollapsed && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#2E5E99]/5">
            <div className="w-7 h-7 rounded-full bg-[#2E5E99] flex items-center justify-center text-white text-xs font-bold shrink-0">
              A
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#0D2440] truncate">Admin</p>
              <p className="text-[10px] text-[#7BA4D0] truncate">admin@org.it</p>
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={handleToggle}
        aria-label={isCollapsed ? "Espandi sidebar" : "Comprimi sidebar"}
        className={cn(
          "absolute -right-3 top-20 z-10",
          "w-6 h-6 rounded-full bg-white border border-[#2E5E99]/15 shadow-md",
          "flex items-center justify-center",
          "text-[#7BA4D0] hover:text-[#2E5E99] transition-colors"
        )}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
