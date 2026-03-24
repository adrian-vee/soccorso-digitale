import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-[9px] border border-[#2E5E99]/[0.12] bg-white/60 backdrop-blur-sm",
        "px-3 py-2 text-[13px] text-[#0D2440] placeholder:text-[#7BA4D0]/60",
        "focus:outline-none focus:ring-1 focus:ring-[#2E5E99]/30 focus:border-[#2E5E99]/30",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

export { Textarea }
