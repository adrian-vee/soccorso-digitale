import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-[9px] border border-[#2E5E99]/[0.12] bg-white/60 backdrop-blur-sm",
        "px-3 py-2 text-[13px] text-[#0D2440] placeholder:text-[#7BA4D0]/60",
        "focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30 focus:border-[#2E5E99]/30",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
