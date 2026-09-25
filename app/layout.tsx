import { Analytics } from "@vercel/analytics/next"
import type {
  Metadata,
  Viewport,
} from "next"

import "./globals.css"

import { ContabilidadProvider } from "@/components/contabilidad-provider"
import { AppShell } from "@/components/app-shell"

export const metadata: Metadata = {
  title: {
    default: "Finexa | Sistema Contable",
    template: "%s | Finexa",
  },

  description:
    "Finexa es un sistema de gestión contable para el registro del Libro Diario, mayorización automática, catálogo de cuentas y generación dinámica de Estados Financieros.",

  generator: "Finexa",
}

export const viewport: Viewport = {
  colorScheme: "light dark",

  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "white",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "black",
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
    >
      <body className="antialiased">
        <ContabilidadProvider>
          <AppShell>
            {children}
          </AppShell>
        </ContabilidadProvider>

        {process.env.NODE_ENV === "production" && (
          <Analytics />
        )}
      </body>
    </html>
  )
}