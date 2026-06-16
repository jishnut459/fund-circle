"use client"

import ReactDatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import "@/styles/datepicker-overrides.css"
import { parse, isValid } from "date-fns"

interface DatePickerProps {
  value: string        // ISO date string "YYYY-MM-DD"
  onChange: (value: string) => void
  placeholder?: string
  minDate?: Date
  id?: string
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", minDate, id }: DatePickerProps) {
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : null
  const selected = parsed && isValid(parsed) ? parsed : null

  const handleChange = (date: Date | null) => {
    if (!date) { onChange(""); return }
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    onChange(`${y}-${m}-${d}`)
  }

  return (
    <ReactDatePicker
      id={id}
      selected={selected}
      onChange={handleChange}
      dateFormat="dd MMMM yyyy"
      placeholderText={placeholder}
      minDate={minDate}
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      className="flex h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2"
      wrapperClassName="w-full"
      popperClassName="z-50"
    />
  )
}
