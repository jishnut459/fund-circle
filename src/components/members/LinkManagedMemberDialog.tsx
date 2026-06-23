"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Link2 } from "lucide-react"
import { linkManagedMember } from "@/lib/actions"

export default function LinkManagedMemberDialog({
  managedId,
  memberName,
  actorUserId,
}: {
  managedId: string
  memberName: string
  actorUserId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError("")
    const result = await linkManagedMember(managedId, email.trim(), actorUserId)
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    if (result.data.linked) {
      toast.success(`${memberName} linked`, {
        description: "Their history is now visible in that account.",
      })
    } else {
      toast.success("Invite sent", {
        description: `When ${memberName} signs in with this email, their history transfers automatically.`,
      })
    }
    setOpen(false)
    setEmail("")
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) {
          setEmail("")
          setError("")
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-teal hover:text-teal-dark">
          <Link2 className="h-3.5 w-3.5" />
          Link to account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link {memberName} to an account</DialogTitle>
          <DialogDescription>
            Enter their email. If they&apos;ve already signed up, their full history transfers now —
            otherwise it transfers automatically when they first sign in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="link-email">Email</Label>
            <Input
              id="link-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              disabled={loading}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading || !email.trim()} className="w-full">
            {loading ? "Linking…" : "Link Account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
