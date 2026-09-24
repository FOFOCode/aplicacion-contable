"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { Search, ChevronDown, Check } from "lucide-react"
import type { Cuenta } from "@/lib/types"
import { formatearCuentaJerarquica } from "@/lib/contabilidad"

interface CuentaComboboxProps {
  cuentas: Cuenta[]
  value: string
  onChange: (codigo: string) => void
  onSelectAndAdvance?: () => void
  autoFocus?: boolean
  className?: string
  placeholder?: string
}

export function CuentaCombobox({
  cuentas,
  value,
  onChange,
  onSelectAndAdvance,
  autoFocus = false,
  className = "",
  placeholder = "Buscar código o cuenta...",
}: CuentaComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Cuenta seleccionada actual
  const selectedCuenta = useMemo(
    () => cuentas.find((c) => c.codigo === value),
    [cuentas, value]
  )

  // Filtrado reactivo en tiempo real por código, subcuenta o cuenta principal
  const filteredCuentas = useMemo(() => {
    if (!search.trim()) return cuentas
    const q = search.toLowerCase().trim()
    return cuentas.filter((c) => {
      const j = formatearCuentaJerarquica(c)
      return (
        c.codigo.toLowerCase().includes(q) ||
        c.nombre.toLowerCase().includes(q) ||
        j.principal.toLowerCase().includes(q)
      )
    })
  }, [cuentas, search])

  // Reset highlighted index cuando cambia el filtro
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredCuentas])

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Auto-scroll del elemento resaltado en la lista
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" })
      }
    }
  }, [highlightedIndex, isOpen])

  const handleSelect = (cuenta: Cuenta) => {
    onChange(cuenta.codigo)
    setIsOpen(false)
    setSearch("")
    if (onSelectAndAdvance) {
      setTimeout(() => onSelectAndAdvance(), 30)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredCuentas.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case "Enter":
        e.preventDefault()
        if (filteredCuentas[highlightedIndex]) {
          handleSelect(filteredCuentas[highlightedIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        setIsOpen(false)
        setSearch("")
        break
      case "Tab":
        // Si hay coincidencia exacta de código con lo que escribió, seleccionar
        const exactMatch = filteredCuentas.find(
          (c) => c.codigo.toLowerCase() === search.trim().toLowerCase()
        )
        if (exactMatch) {
          handleSelect(exactMatch)
        } else if (isOpen && filteredCuentas[highlightedIndex]) {
          handleSelect(filteredCuentas[highlightedIndex])
        }
        setIsOpen(false)
        break
    }
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div
        className="flex items-center h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-within:ring-2 focus-within:ring-ring transition-colors cursor-pointer"
        onClick={() => {
          setIsOpen(true)
          inputRef.current?.focus()
        }}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground mr-1.5 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          autoFocus={autoFocus}
          value={
            isOpen
              ? search
              : selectedCuenta
              ? `${selectedCuenta.codigo} · ${formatearCuentaJerarquica(selectedCuenta).textoCompleto}`
              : ""
          }
          placeholder={
            selectedCuenta
              ? `${selectedCuenta.codigo} · ${formatearCuentaJerarquica(selectedCuenta).textoCompleto}`
              : placeholder
          }
          onChange={(e) => {
            setSearch(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            setIsOpen(true)
            setSearch("")
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none truncate"
        />
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[280px] sm:min-w-[340px] max-w-lg bg-popover text-popover-foreground rounded-md border border-border shadow-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <ul
            ref={listRef}
            className="max-h-56 overflow-y-auto divide-y divide-border text-sm"
          >
            {filteredCuentas.length === 0 ? (
              <li className="p-3 text-center text-muted-foreground italic text-xs">
                No se encontraron cuentas contables
              </li>
            ) : (
              filteredCuentas.map((c, idx) => {
                const jerarquia = formatearCuentaJerarquica(c)
                const isSelected = c.codigo === value
                const isHighlighted = idx === highlightedIndex
                return (
                  <li
                    key={c.codigo}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(c)}
                    className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                      isHighlighted
                        ? "bg-accent text-accent-foreground"
                        : "text-popover-foreground hover:bg-muted"
                    } ${isSelected ? "font-semibold bg-muted" : ""}`}
                  >
                    <div className="flex flex-col truncate pr-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary text-xs shrink-0 w-12">
                          {c.codigo}
                        </span>
                        <span className="truncate font-semibold text-foreground">
                          {jerarquia.subcuenta}
                        </span>
                      </div>
                      {jerarquia.principal &&
                        jerarquia.principal.toLowerCase() !==
                          jerarquia.subcuenta.toLowerCase() && (
                          <span className="text-[10px] text-muted-foreground pl-14 truncate">
                            {jerarquia.principal}
                          </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                          c.naturaleza === "deudora"
                            ? "bg-sky-500/10 text-sky-700 border border-sky-500/20 dark:text-sky-300"
                            : "bg-amber-500/10 text-amber-700 border border-amber-500/20 dark:text-amber-300"
                        }`}
                      >
                        {c.naturaleza === "deudora" ? "Deudora" : "Acreedora"}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
