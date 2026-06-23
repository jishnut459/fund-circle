"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DatePicker } from "@/components/ui/date-picker"
import CycleDueDaySelect, { getDefaultDueDay } from "@/components/fund-circles/CycleDueDaySelect"
import Link from "next/link"

export type Step1Data = {
  name: string
  description: string
  amount: string
  frequency: string
  cycleDueDay: number | null
  plan: string
  startDate: string
  endDate: string
}

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
]

const PLANS = [
  { value: "free", label: "Free · up to 20 members" },
  { value: "pro", label: "Pro · up to 100 members" },
  { value: "premium", label: "Premium · unlimited members" },
]

interface Step1BasicsProps {
  initialData: Step1Data
  onNext: (data: Step1Data) => void
}

export default function Step1Basics({ initialData, onNext }: Step1BasicsProps) {
  const [name, setName] = useState(initialData.name)
  const [description, setDescription] = useState(initialData.description)
  const [amount, setAmount] = useState(initialData.amount)
  const [frequency, setFrequency] = useState(initialData.frequency)
  const [cycleDueDay, setCycleDueDay] = useState<number | null>(initialData.cycleDueDay)
  const [plan, setPlan] = useState(initialData.plan)
  const [startDate, setStartDate] = useState(initialData.startDate)
  const [endDate, setEndDate] = useState(initialData.endDate)
  const [attempted, setAttempted] = useState(false)

  const dateError =
    startDate && endDate && endDate < startDate
      ? "End date must be on or after the start date"
      : ""

  const nameError = attempted && name.trim() === "" ? "Give the circle a name" : ""
  const amountError =
    attempted && (amount === "" || Number(amount) <= 0) ? "Enter a contribution amount greater than ₹0" : ""
  const startError = attempted && startDate === "" ? "Pick a start date" : ""
  const endError = dateError || (attempted && endDate === "" ? "Pick an end date" : "")

  const canProceed =
    name.trim() !== "" &&
    amount !== "" &&
    Number(amount) > 0 &&
    startDate !== "" &&
    endDate !== "" &&
    !dateError

  const handleFrequencyChange = (value: string) => {
    setFrequency(value)
    setCycleDueDay(getDefaultDueDay(value))
  }

  const handleNext = () => {
    if (!canProceed) {
      setAttempted(true)
      return
    }
    onNext({ name: name.trim(), description: description.trim(), amount, frequency, cycleDueDay, plan, startDate, endDate })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="s1-name">Circle Name</Label>
        <Input
          id="s1-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Monthly Savings Fund"
          autoFocus
        />
        {nameError && <p className="text-sm text-red-600">{nameError}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="s1-description">Description <span className="text-[var(--text-muted)] font-normal">(optional)</span></Label>
        <Input
          id="s1-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the circle's purpose"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="s1-amount">Contribution Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)] pointer-events-none">₹</span>
            <Input
              id="s1-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1,000"
              className="pl-7"
            />
          </div>
          {amountError && <p className="text-sm text-red-600">{amountError}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="s1-frequency">Frequency</Label>
          <Select value={frequency} onValueChange={handleFrequencyChange}>
            <SelectTrigger id="s1-frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <CycleDueDaySelect frequency={frequency} value={cycleDueDay} onChange={setCycleDueDay} />

      <div className="space-y-2">
        <Label htmlFor="s1-plan">Plan</Label>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger id="s1-plan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLANS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="s1-start-date">Start Date</Label>
          <DatePicker
            id="s1-start-date"
            value={startDate}
            onChange={setStartDate}
            placeholder="Pick start date"
          />
          {startError && <p className="text-sm text-red-600">{startError}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="s1-end-date">End Date</Label>
          <DatePicker
            id="s1-end-date"
            value={endDate}
            onChange={setEndDate}
            placeholder="Pick end date"
            minDate={startDate ? new Date(startDate + "T00:00:00") : undefined}
          />
          {endError && <p className="text-sm text-red-600">{endError}</p>}
        </div>
      </div>
      <p className="text-xs text-[var(--text-muted)] -mt-2">
        The circle runs for a fixed term — it settles and pays out members on the end date.
      </p>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" asChild>
          <Link href="/circles">Cancel</Link>
        </Button>
        <Button onClick={handleNext} aria-disabled={!canProceed}>
          Next: Loan Settings
        </Button>
      </div>
    </div>
  )
}
