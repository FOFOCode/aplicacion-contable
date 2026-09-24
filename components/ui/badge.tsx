import * as React from "react"
import { cn } from "@/lib/utils"

type Variant =
  | "default"
  | "deudora"
  | "acreedora"
  | "muted"
  | "success"
  | "warning"
  | "outline"
  | "secondary"
  | "destructive"

const styles: Record<Variant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  deudora: "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300",
  acreedora: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  muted: "bg-muted text-muted-foreground border-border",
  success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  warning: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-300",
  outline: "text-foreground border-border bg-transparent",
  secondary: "bg-secondary text-secondary-foreground border-transparent",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      )}
      {...props}
    />
  )
}
