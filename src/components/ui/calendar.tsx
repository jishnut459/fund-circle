"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col",
        month: "flex flex-col gap-3",
        month_caption: "relative flex items-center justify-center h-9",
        caption_label: "text-sm font-semibold text-[var(--text-primary)]",
        nav: "absolute inset-x-0 flex items-center justify-between px-1",
        button_previous: [
          "h-7 w-7 flex items-center justify-center rounded-lg",
          "border border-[var(--border-color)] bg-[var(--bg-surface)]",
          "text-[var(--text-secondary)] hover:bg-[var(--border-light)] hover:text-[var(--text-primary)]",
          "transition-colors",
        ].join(" "),
        button_next: [
          "h-7 w-7 flex items-center justify-center rounded-lg",
          "border border-[var(--border-color)] bg-[var(--bg-surface)]",
          "text-[var(--text-secondary)] hover:bg-[var(--border-light)] hover:text-[var(--text-primary)]",
          "transition-colors",
        ].join(" "),
        month_grid: "w-full border-collapse",
        weekdays: "flex mb-1",
        weekday: "w-9 text-[0.75rem] font-medium text-[var(--text-muted)] text-center",
        week: "flex",
        day: "relative p-0 text-center",
        day_button: [
          "h-9 w-9 rounded-lg text-sm font-normal transition-colors",
          "text-[var(--text-primary)]",
          "hover:bg-[var(--border-light)]",
          "focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-1",
        ].join(" "),
        selected: "!bg-teal !text-white hover:!bg-teal-dark",
        today: "font-semibold text-teal",
        outside: "opacity-40 text-[var(--text-muted)]",
        disabled: "opacity-30 cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" {...(rest as React.SVGProps<SVGSVGElement>)} />
          ) : (
            <ChevronRight className="h-4 w-4" {...(rest as React.SVGProps<SVGSVGElement>)} />
          ),
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"
export { Calendar }
