"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Crown, Shield, User, UserPlus, X } from "lucide-react"
import { lookupUserByEmail } from "@/lib/actions"
import type { Step3Member } from "./CreateCircleWizard"
import { cn } from "@/lib/utils"

interface Step3MembersProps {
  creatorName: string
  initialMembers: Step3Member[]
  memberLimit: number
  planLabel: string
  onNext: (members: Step3Member[]) => void
  onBack: () => void
}

type LookupStatus = "idle" | "loading" | "found" | "not-found" | "error"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Step3Members({ creatorName, initialMembers, memberLimit, planLabel, onNext, onBack }: Step3MembersProps) {
  const [members, setMembers] = useState<Step3Member[]>(initialMembers)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle")
  const [lookupName, setLookupName] = useState<string | null>(null)
  const [addError, setAddError] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEmailChange = (value: string) => {
    setEmail(value)
    setAddError("")
    setLookupStatus("idle")
    setLookupName(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = value.trim()
    // Only look up when it's a single, well-formed address (bulk paste skips this).
    if (!trimmed || !EMAIL_RE.test(trimmed)) return

    debounceRef.current = setTimeout(async () => {
      setLookupStatus("loading")
      const result = await lookupUserByEmail(trimmed)
      if (!result.success) {
        setLookupStatus("error")
        return
      }
      setLookupStatus(result.data.exists ? "found" : "not-found")
      setLookupName(result.data.name)
    }, 400)
  }

  const totalCount = members.length + 1 // + owner
  const remaining = memberLimit === Infinity ? Infinity : memberLimit - totalCount
  const atCapacity = remaining <= 0

  const handleAdd = () => {
    if (atCapacity) {
      setAddError(`Member limit reached for the ${planLabel} plan`)
      return
    }
    // Accept a single email or a pasted list separated by commas / spaces / newlines.
    const tokens = email
      .toLowerCase()
      .split(/[\s,;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    if (tokens.length === 0) return

    const valid = tokens.filter((t) => EMAIL_RE.test(t))
    if (valid.length === 0) {
      setAddError("Enter a valid email address")
      return
    }

    const existing = new Set(members.map((m) => m.email))
    const single = valid.length === 1
    const fresh: Step3Member[] = []
    for (const e of valid) {
      if (existing.has(e)) continue
      existing.add(e)
      fresh.push({
        email: e,
        fullName: single ? lookupName ?? undefined : undefined,
        role,
        exists: single ? lookupStatus === "found" : false,
      })
    }
    if (fresh.length === 0) {
      setAddError("Already added")
      return
    }

    const accepted = remaining === Infinity ? fresh : fresh.slice(0, Math.max(0, remaining))
    setMembers((prev) => [...prev, ...accepted])
    setEmail("")
    setRole("member")
    setLookupStatus("idle")
    setLookupName(null)
    setAddError(
      accepted.length < fresh.length
        ? `Added ${accepted.length} — ${planLabel} plan member limit reached`
        : ""
    )
  }

  const handleRemove = (emailToRemove: string) => {
    setMembers((prev) => prev.filter((m) => m.email !== emailToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--text-muted)]">
        Add members to invite when the circle is created. You can also do this later from the members page.
      </p>

      {/* Email input row */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="s3-email" className="text-xs">Email address</Label>
            <div className="relative">
              <Input
                id="s3-email"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="member@example.com"
                className="pr-24"
              />
              {lookupStatus !== "idle" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {lookupStatus === "loading" && (
                    <span className="text-[10px] text-[var(--text-muted)]">checking…</span>
                  )}
                  {lookupStatus === "found" && (
                    <Badge variant="success" className="text-[10px] py-0">has account</Badge>
                  )}
                  {lookupStatus === "not-found" && (
                    <Badge variant="info" className="text-[10px] py-0">will invite</Badge>
                  )}
                </div>
              )}
            </div>
            {lookupStatus === "found" && lookupName && (
              <p className="text-xs text-[var(--text-muted)]">{lookupName}</p>
            )}
            {addError && <p className="text-xs text-red-600">{addError}</p>}
          </div>

          <div className="space-y-1 w-28">
            <Label className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="self-end">
            <Button
              variant="outline"
              onClick={handleAdd}
              disabled={!email.trim() || lookupStatus === "loading" || atCapacity}
              title="Add member"
              className="gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Paste several emails separated by commas to add them all at once.
        </p>
      </div>

      {/* Members list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Members</span>
          <span className="text-xs font-tabular text-[var(--text-muted)]">
            {totalCount}{memberLimit !== Infinity ? ` / ${memberLimit}` : ""}
          </span>
        </div>
        {atCapacity && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            You&apos;ve reached the {planLabel} plan&apos;s member limit. Upgrade the plan in step 1 to add more.
          </p>
        )}

        {/* Creator row — always shown, non-removable */}
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border-light)] bg-[var(--bg-page)] px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
            <Crown className="h-4 w-4 text-teal" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{creatorName}</p>
            <p className="text-[11px] text-[var(--text-muted)]">You</p>
          </div>
          <Badge variant="default" className="text-[10px] shrink-0">Owner</Badge>
        </div>

        {members.map((m) => (
          <div
            key={m.email}
            className="flex items-center gap-3 rounded-lg border border-[var(--border-light)] px-3 py-2.5"
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              m.role === "admin"
                ? "bg-amber-50 dark:bg-amber-900/20"
                : "bg-[var(--border-light)]"
            )}>
              {m.role === "admin"
                ? <Shield className="h-4 w-4 text-amber-600" />
                : <User className="h-4 w-4 text-[var(--text-muted)]" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {m.fullName ?? m.email}
              </p>
              {m.fullName && (
                <p className="text-[11px] text-[var(--text-muted)] truncate">{m.email}</p>
              )}
              {!m.exists && (
                <p className="text-[10px] text-blue-600 dark:text-blue-400">invite pending</p>
              )}
            </div>
            <Badge variant={m.role === "admin" ? "warning" : "default"} className="text-[10px] capitalize shrink-0">
              {m.role}
            </Badge>
            <button
              onClick={() => handleRemove(m.email)}
              className="text-[var(--text-muted)] hover:text-red-500 transition-colors ml-1"
              title="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {members.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-4">
            No members added yet — you can also add them later from the members page.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={() => onNext(members)}>
          {members.length > 0 ? `Next: Review (${members.length} member${members.length !== 1 ? "s" : ""})` : "Next: Review"}
        </Button>
      </div>
    </div>
  )
}
