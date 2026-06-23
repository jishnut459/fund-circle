"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CheckCircle2, Loader2, Mail, Plus, UserCheck, UserCog } from "lucide-react"
import { addCircleMember, addManagedMember, lookupCircleMemberByEmail } from "@/lib/actions"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Mode = "invite" | "managed"

interface LookupResult {
  exists: boolean
  name: string | null
  avatarUrl: string | null
  alreadyMember: boolean
  invitePending: boolean
}

export default function AddMemberDialog({
  circleId,
  currentUserId,
}: {
  circleId: string
  currentUserId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("invite")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState<"member" | "admin">("member")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [lookup, setLookup] = useState<{ forEmail: string; data: LookupResult | null } | null>(null)
  const [error, setError] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trimmedEmail = email.trim()
  const isValidEmail = EMAIL_PATTERN.test(trimmedEmail)
  const lookupResult = lookup?.forEmail === trimmedEmail ? lookup.data : null
  const isChecking = checking && isValidEmail && mode === "invite"

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (mode !== "invite" || !isValidEmail) return

    debounceRef.current = setTimeout(async () => {
      setChecking(true)
      const result = await lookupCircleMemberByEmail(circleId, trimmedEmail)
      setLookup({ forEmail: trimmedEmail, data: result.success ? result.data : null })
      setChecking(false)
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [trimmedEmail, circleId, isValidEmail, mode])

  const resetForm = () => {
    setEmail("")
    setFullName("")
    setPhone("")
    setRole("member")
    setError("")
    setLookup(null)
    setChecking(false)
    setMode("invite")
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError("")
    setLookup(null)
    setChecking(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (mode === "invite") {
      if (!isValidEmail || lookupResult?.alreadyMember) return
      setLoading(true)
      setError("")
      const result = await addCircleMember({
        circleId,
        email: trimmedEmail,
        fullName: fullName.trim() || undefined,
        role,
        actorUserId: currentUserId,
      })
      setLoading(false)
      if (!result.success) {
        setError(result.error)
        return
      }
      if (result.data.status === "linked") {
        toast.success(`${lookupResult?.name ?? "Member"} added to the circle`)
      } else if (result.data.emailSent) {
        toast.success(`Invite sent to ${trimmedEmail}`)
      } else {
        toast.success("Invite saved", {
          description: `We couldn't send an email automatically. Ask ${trimmedEmail} to sign in with Google to join.`,
        })
      }
    } else {
      if (!fullName.trim()) {
        setError("Enter a name for the member")
        return
      }
      if (trimmedEmail && !isValidEmail) {
        setError("Enter a valid email address")
        return
      }
      setLoading(true)
      setError("")
      const result = await addManagedMember({
        circleId,
        name: fullName.trim(),
        phone: phone.trim() || undefined,
        email: trimmedEmail || undefined,
        role,
        actorUserId: currentUserId,
      })
      setLoading(false)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(`${fullName.trim()} added`, {
        description: "You can record payments and loans on their behalf.",
      })
    }

    setOpen(false)
    resetForm()
    router.refresh()
  }

  const inviteSubmitLabel = (() => {
    if (loading) return "Saving..."
    if (lookupResult?.alreadyMember) return "Already a member"
    if (lookupResult?.exists) return "Add to Circle"
    if (lookupResult?.invitePending) return "Resend Invite"
    return "Send Invite"
  })()

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            {mode === "invite"
              ? "Invite someone by email — existing Fund Circle members are added instantly, otherwise we'll email them an invite."
              : "Add someone who won't use the app. You record their payments and loans on their behalf."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--border-light)]/40 p-1">
          <button
            type="button"
            onClick={() => switchMode("invite")}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "invite"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-card)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            <Mail className="h-4 w-4" />
            Invite by email
          </button>
          <button
            type="button"
            onClick={() => switchMode("managed")}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "managed"
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-card)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            <UserCog className="h-4 w-4" />
            Managed member
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "invite" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="member@example.com"
                    disabled={loading}
                    autoFocus
                    className="pr-9"
                  />
                  {isChecking && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[var(--text-muted)]" />
                  )}
                </div>
              </div>

              {isValidEmail && !isChecking && lookupResult?.alreadyMember && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                  <UserCheck className="h-4 w-4 flex-shrink-0" />
                  <span>{lookupResult.name ?? "This person"} is already a member of this circle.</span>
                </div>
              )}

              {isValidEmail && !isChecking && lookupResult?.exists && !lookupResult.alreadyMember && (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border-light)] bg-[var(--border-light)]/40 px-3 py-2.5">
                  <Avatar className="h-9 w-9">
                    {lookupResult.avatarUrl && <AvatarImage src={lookupResult.avatarUrl} alt={lookupResult.name ?? ""} />}
                    <AvatarFallback>{(lookupResult.name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{lookupResult.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">Has a Fund Circle account — will be added immediately</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-teal flex-shrink-0 ml-auto" />
                </div>
              )}

              {isValidEmail && !isChecking && !lookupResult?.exists && lookupResult?.invitePending && (
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span>An invite is already pending for this email — resending will refresh it.</span>
                </div>
              )}

              {isValidEmail && !isChecking && !lookupResult?.exists && !lookupResult?.invitePending && (
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--border-light)]/40 px-3 py-2.5 text-sm text-[var(--text-secondary)]">
                  <Mail className="h-4 w-4 flex-shrink-0 text-teal" />
                  <span>No Fund Circle account yet — we&apos;ll email an invite to join.</span>
                </div>
              )}

              {isValidEmail && !lookupResult?.exists && (
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-[var(--text-muted)] font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    disabled={loading}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="managed-name">Name</Label>
                <Input
                  id="managed-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  disabled={loading}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="managed-phone">
                  Phone <span className="text-[var(--text-muted)] font-normal">(optional)</span>
                </Label>
                <Input
                  id="managed-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="managed-email">
                  Email <span className="text-[var(--text-muted)] font-normal">(optional)</span>
                </Label>
                <Input
                  id="managed-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@example.com"
                  disabled={loading}
                />
                <p className="text-xs text-[var(--text-muted)]">
                  Add an email later to link this member to their own login.
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as "member" | "admin")}
              disabled={loading || (mode === "invite" && lookupResult?.alreadyMember)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            type="submit"
            disabled={
              loading ||
              (mode === "invite"
                ? !isValidEmail || isChecking || lookupResult?.alreadyMember
                : !fullName.trim())
            }
            className="w-full"
          >
            {mode === "invite" ? inviteSubmitLabel : loading ? "Saving..." : "Add Member"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
