"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  value: string        // ISO date string "YYYY-MM-DD"
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  minDate?: Date
  id?: string
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", disabled, minDate, id }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const isValidDate = selected && isValid(selected)

  const handleSelect = (date: Date | undefined) => {
    onChange(date ? format(date, "yyyy-MM-dd") : "")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border border-[var(--border-color)]",
            "bg-[var(--bg-surface)] px-3 py-2 text-sm",
            "text-left font-normal transition-colors",
            "hover:bg-[var(--border-light)]",
            "focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !isValidDate && "text-[var(--text-muted)]"
          )}
        >
          <span>{isValidDate && selected ? format(selected, "dd/MM/yyyy") : placeholder}</span>
          <CalendarIcon className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isValidDate ? selected : undefined}
          onSelect={handleSelect}
          disabled={minDate ? (date) => date < minDate : undefined}
          defaultMonth={isValidDate && selected ? selected : undefined}
        />
      </PopoverContent>
    </Popover>
  )
}
