"use client"

import { useState } from "react"
import { Circle } from "lucide-react"
import { signInWithGoogle } from "@/lib/supabase-client"

export default function LoginCard({ incomingError }: { incomingError?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(incomingError ? "Sign-in was cancelled. Try again." : "")

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError("")
    try {
      await signInWithGoogle()
    } catch {
      setLoading(false)
      setError("Sign-in was cancelled. Try again.")
    }
  }

  return (
    <div className="w-full max-w-[400px] mx-auto px-4 sm:px-0">
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-full border-[2.5px] border-teal flex items-center justify-center">
              <Circle className="h-3.5 w-3.5 text-teal fill-teal" />
            </div>
            <span className="text-lg font-medium text-[var(--text-primary)] tracking-tight">
              Fund Circle
            </span>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight mb-2">
            Welcome to Fund Circle
          </h1>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-xs mx-auto">
            Track contributions, manage funds, and stay transparent with your community.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] dark:bg-[#131314] dark:border-gray-700 dark:hover:bg-gray-800 px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--border-light)] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Redirecting…
              </>
            ) : (
              <>
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {error && (
            <p className="text-sm text-center text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <p className="text-center text-[11px] text-[var(--text-muted)] leading-relaxed">
            By continuing, you agree to our{" "}
            <a href="#" className="underline underline-offset-2 hover:text-[var(--text-secondary)] transition-colors">
              Terms
            </a>
            {" "}and{" "}
            <a href="#" className="underline underline-offset-2 hover:text-[var(--text-secondary)] transition-colors">
              Privacy policy
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
