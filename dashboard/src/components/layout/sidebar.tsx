"use client"
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, ClipboardList, CalendarClock, MapPin,
  Truck, FileText, Users, Calendar, BarChart3, Package,
  Settings, ChevronLeft, ChevronRight, LogOut
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  comingSoon?: boolean
}

interface NavSection {
  label: string
  bg: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "OPERATIVO",
    bg: "bg-[#2E5E99]/[0.06] border border-[#2E5E99]/[0.09]",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/servizi", icon: ClipboardList, label: "Servizi" },
      { href: "/prenotazioni", icon: CalendarClock, label: "Prenotazioni" },
      { href: "/mappa", icon: MapPin, label: "Mappa Live", comingSoon: true },
    ],
  },
  {
    label: "FLOTTA",
    bg: "bg-[#0D2440]/[0.05] border border-[#0D2440]/[0.07]",
    items: [
      { href: "/flotta", icon: Truck, label: "Veicoli" },
      { href: "/documenti", icon: FileText, label: "Documenti" },
    ],
  },
  {
    label: "PERSONALE",
    bg: "bg-[#7BA4D0]/[0.06] border border-[#7BA4D0]/[0.09]",
    items: [
      { href: "/personale", icon: Users, label: "Volontari" },
      { href: "/turni", icon: Calendar, label: "Turni" },
    ],
  },
  {
    label: "REPORT",
    bg: "bg-[#7BA4D0]/[0.07] border border-[#7BA4D0]/[0.09]",
    items: [
      { href: "/analytics", icon: BarChart3, label: "Analytics" },
      { href: "/inventario", icon: Package, label: "Inventario" },
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
  const { displayName, initials, email, signOut } = useAuth()

  const isCollapsed = externalCollapsed ?? collapsed
  const handleToggle = onToggle ?? (() => setCollapsed((c) => !c))

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen transition-all duration-300 ease-in-out",
        "bg-white/[0.38] backdrop-blur-[28px] border-r border-[#2E5E99]/[0.05]",
        "shadow-[1px_0_0_rgba(46,94,153,0.06)]",
        isCollapsed ? "w-16" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-16 px-4 shrink-0", isCollapsed && "justify-center px-2")}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] shrink-0 shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        {!isCollapsed && (
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-semibold text-[#0D2440] truncate leading-tight">Soccorso Digitale</p>
            <p className="text-[9px] text-[#7BA4D0]/80 truncate leading-tight">Croce Europa Legnago</p>
          </div>
        )}
      </div>

      <Separator className="bg-[#2E5E99]/[0.07]" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1.5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className={cn("mb-1 rounded-xl overflow-hidden", !isCollapsed && section.bg)}>
            {!isCollapsed && (
              <p className="px-3 pt-2 pb-1 text-[9px] font-bold tracking-[0.12em] text-[#7BA4D0]/60 uppercase">
                {section.label}
              </p>
            )}
            {isCollapsed && <div className="h-px bg-[#2E5E99]/8 mx-1 my-2" />}
            <div className="px-1 pb-1 space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                const disabled = item.comingSoon

                if (disabled) {
                  return (
                    <div
                      key={item.href}
                      title={isCollapsed ? `${item.label} — Coming Soon` : undefined}
                      className={cn(
                        "relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium opacity-60 cursor-not-allowed select-none",
                        "text-[#0D2440]/70",
                        isCollapsed && "justify-center px-2"
                      )}
                    >
                      <item.icon size={15} className="shrink-0 text-[#7BA4D0]/60" />
                      {!isCollapsed && (
                        <span className="truncate flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="truncate">{item.label}</span>
                          <span className="shrink-0 text-[8px] font-bold text-[#7BA4D0] bg-[#7BA4D0]/10 px-1.5 py-0.5 rounded-full">SOON</span>
                        </span>
                      )}
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all",
                      active
                        ? "bg-[#2E5E99]/[0.08] text-[#2E5E99] font-semibold shadow-sm"
                        : "font-medium text-[#0D2440]/70 hover:text-[#0D2440] hover:bg-white/40",
                      isCollapsed && "justify-center px-2"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-gradient-to-b from-[#2E5E99] to-[#7BA4D0] rounded-r-full" />
                    )}
                    <item.icon
                      size={15}
                      className={cn(
                        "shrink-0 transition-colors",
                        active ? "text-[#2E5E99]" : "text-[#7BA4D0]/60"
                      )}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <Separator className="bg-[#2E5E99]/[0.07]" />

      {/* Footer: settings + user */}
      <div className="px-2 py-3 space-y-1">
        <Link
          href="/impostazioni"
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all",
            isActive("/impostazioni")
              ? "bg-[#2E5E99]/[0.08] text-[#2E5E99] font-semibold shadow-sm"
              : "font-medium text-[#0D2440]/70 hover:text-[#0D2440] hover:bg-white/40",
            isCollapsed && "justify-center px-2"
          )}
          title={isCollapsed ? "Impostazioni" : undefined}
        >
          <Settings size={15} className={cn("shrink-0", isActive("/impostazioni") ? "text-[#2E5E99]" : "text-[#7BA4D0]/50")} />
          {!isCollapsed && <span>Impostazioni</span>}
        </Link>

        {!isCollapsed && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-[#2E5E99]/[0.06] border border-[#2E5E99]/[0.09] group">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5E99] to-[#7BA4D0] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
              {initials}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#0D2440] truncate leading-tight">{displayName}</p>
              <p className="text-[10px] text-[#7BA4D0] truncate">{email}</p>
            </div>
            <button
              onClick={signOut}
              title="Esci"
              className="shrink-0 w-6 h-6 rounded-[6px] flex items-center justify-center text-[#7BA4D0]/50 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={12} />
            </button>
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
