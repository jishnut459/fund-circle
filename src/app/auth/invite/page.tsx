"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Circle, Loader2 } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase-client"
import { completeInviteSession } from "@/lib/actions"

export default function AcceptInvitePage() {
  const router = useRouter()
  const [status, setStatus] = useState<"working" | "error">("working")
  const [message, setMessage] = useState("")

  useEffect(() => {
    let active = true

    const run = async () => {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
      const params = new URLSearchParams(hash)
      const errorDescription = params.get("error_description")
      const accessToken = params.get("access_token")
      const refreshToken = params.get("refresh_token")

      if (errorDescription) {
        if (active) {
          setMessage(errorDescription.replace(/\+/g, " "))
          setStatus("error")
        }
        return
      }

      if (!accessToken || !refreshToken) {
        router.replace("/login")
        return
      }

      const supabase = createSupabaseBrowserClient()
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (sessionError) {
        if (active) {
          setMessage(sessionError.message)
          setStatus("error")
        }
        return
      }

      const result = await completeInviteSession()
      if (!result.success) {
        if (active) {
          setMessage(result.error)
          setStatus("error")
        }
        return
      }

      router.replace(result.data.redirectTo)
    }

    run()

    return () => {
      active = false
    }
  }, [router])

  return (
    <div className="min-h-full flex items-center justify-center bg-[var(--bg-page)]">
      <div className="w-full max-w-[400px] mx-auto px-4 sm:px-0">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] p-8 text-center">
          <div className="inline-flex items-center justify-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-full border-[2.5px] border-teal flex items-center justify-center">
              <Circle className="h-3.5 w-3.5 text-teal fill-teal" />
            </div>
            <span className="text-lg font-medium text-[var(--text-primary)] tracking-tight">
              Fund Circle
            </span>
          </div>

          {status === "working" ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-teal mx-auto mb-4" />
              <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                Setting up your account
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Hang on while we get your circle ready.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Invite link expired
              </h1>
              <p className="text-sm text-[var(--text-muted)] mb-6">
                {message || "This invite link is no longer valid. Ask the circle admin to send a new one."}
              </p>
              <a
                href="/login"
                className="inline-flex items-center justify-center h-11 w-full rounded-xl bg-teal text-white text-sm font-medium hover:bg-teal-dark transition-all active:scale-[0.98]"
              >
                Go to sign in
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
