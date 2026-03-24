"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"
import { Sun, Moon, Monitor } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export type ThemeToggleVariant = "tabs" | "dropdown" | "radio"
export type ThemeToggleSize = "sm" | "md" | "lg"
export type Theme = "light" | "dark" | "system"

export interface ThemeConfig {
  value: Theme
  label: string
  icon: React.ElementType
}

export const themeConfigs: ThemeConfig[] = [
  { value: "light",  label: "Chiaro",  icon: Sun },
  { value: "dark",   label: "Scuro",   icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
]

interface ThemeProps {
  variant?: ThemeToggleVariant
  size?: ThemeToggleSize
  themes?: Theme[]
  className?: string
}

const sizeMap = {
  sm: { pill: "h-[28px]", icon: 12, px: "px-2", gap: "gap-1", text: "text-[10px]" },
  md: { pill: "h-[34px]", icon: 14, px: "px-2.5", gap: "gap-1.5", text: "text-[12px]" },
  lg: { pill: "h-[40px]", icon: 16, px: "px-3", gap: "gap-2", text: "text-[13px]" },
}

export function Theme({
  variant = "tabs",
  size = "md",
  themes = ["light", "dark", "system"],
  className,
}: ThemeProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const configs = themeConfigs.filter((c) => themes.includes(c.value))
  const s = sizeMap[size]

  if (!mounted) {
    if (variant === "tabs") {
      return (
        <div
          className={cn(
            "flex items-center bg-[#2E5E99]/[0.06] border border-[#2E5E99]/[0.09] rounded-[9px] p-0.5",
            className
          )}
          style={{ height: s.pill.replace("h-[", "").replace("]", "") }}
        >
          {configs.map((c) => (
            <div key={c.value} className={cn("relative rounded-[7px]", s.px, s.gap, "flex items-center")}>
              <c.icon size={s.icon} className="shrink-0 text-[#7BA4D0]" />
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const current = configs.find((c) => c.value === theme) ?? configs[0]

  // ── Tabs variant (segmented control) ──────────────────────────────────────
  if (variant === "tabs") {
    return (
      <div
        className={cn(
          "relative flex items-center bg-[#2E5E99]/[0.06] border border-[#2E5E99]/[0.09] rounded-[9px] p-0.5",
          className
        )}
      >
        {configs.map((c) => {
          const active = theme === c.value
          return (
            <button
              key={c.value}
              onClick={() => setTheme(c.value)}
              aria-label={c.label}
              title={c.label}
              className={cn(
                "relative flex items-center justify-center rounded-[7px] transition-colors duration-150 cursor-pointer",
                s.pill, s.px, s.gap,
                active ? "text-[#2E5E99]" : "text-[#7BA4D0] hover:text-[#0D2440]"
              )}
            >
              {active && (
                <motion.span
                  layoutId="segmented-bg"
                  className="absolute inset-0 rounded-[7px] bg-white shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <c.icon size={s.icon} className="relative shrink-0" />
            </button>
          )
        })}
      </div>
    )
  }

  // ── Dropdown variant ───────────────────────────────────────────────────────
  if (variant === "dropdown") {
    const Icon = current.icon
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center justify-center rounded-[9px] bg-white/50 border border-white/60 text-[#7BA4D0] hover:text-[#2E5E99] hover:bg-white/70 transition-all",
              s.pill,
              "aspect-square",
              className
            )}
            aria-label="Cambia tema"
          >
            <Icon size={s.icon} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[140px]">
          {configs.map((c) => (
            <DropdownMenuItem
              key={c.value}
              onClick={() => setTheme(c.value)}
              className={cn("flex items-center gap-2", theme === c.value && "font-semibold text-[#2E5E99]")}
            >
              <c.icon size={13} />
              {c.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // ── Radio variant ──────────────────────────────────────────────────────────
  return (
    <RadioGroup
      value={theme}
      onValueChange={(v) => setTheme(v)}
      className={cn("flex items-center gap-3", className)}
    >
      {configs.map((c) => (
        <label
          key={c.value}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <RadioGroupItem value={c.value} id={`theme-${c.value}`} />
          <c.icon size={s.icon} className="text-[#7BA4D0]" />
          <span className={cn(s.text, "text-[#0D2440]/70")}>{c.label}</span>
        </label>
      ))}
    </RadioGroup>
  )
}
