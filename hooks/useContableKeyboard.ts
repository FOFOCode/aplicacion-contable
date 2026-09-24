import { useEffect } from "react"

interface ContableKeyboardOptions {
  onAddRow?: () => void
  onAutoBalance?: () => void
  onSave?: () => void
  onClear?: () => void
  onOpenHistorial?: () => void
  onCancel?: () => void
  disabled?: boolean
}

export function useContableKeyboard({
  onAddRow,
  onAutoBalance,
  onSave,
  onClear,
  onOpenHistorial,
  onCancel,
  disabled = false,
}: ContableKeyboardOptions) {
  useEffect(() => {
    if (disabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isAlt = e.altKey
      const isCtrlOrMeta = e.ctrlKey || e.metaKey

      // Alt + A o Ctrl + Enter: Agregar fila
      if ((isAlt && (e.key === "a" || e.key === "A")) || (isCtrlOrMeta && e.key === "Enter")) {
        e.preventDefault()
        onAddRow?.()
        return
      }

      // Alt + C o Alt + B: Auto-balancear
      if (isAlt && (e.key === "c" || e.key === "C" || e.key === "b" || e.key === "B")) {
        e.preventDefault()
        onAutoBalance?.()
        return
      }

      // Alt + G o Ctrl + S: Guardar partida
      if ((isAlt && (e.key === "g" || e.key === "G")) || (isCtrlOrMeta && (e.key === "s" || e.key === "S"))) {
        e.preventDefault()
        onSave?.()
        return
      }

      // Alt + L: Limpiar mesa de trabajo
      if (isAlt && (e.key === "l" || e.key === "L")) {
        e.preventDefault()
        onClear?.()
        return
      }

      // Alt + H: Historial de folios
      if (isAlt && (e.key === "h" || e.key === "H")) {
        e.preventDefault()
        onOpenHistorial?.()
        return
      }

      // Escape: Cancelar o cerrar
      if (e.key === "Escape") {
        onCancel?.()
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onAddRow, onAutoBalance, onSave, onClear, onOpenHistorial, onCancel, disabled])
}
