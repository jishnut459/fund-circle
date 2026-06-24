"use client"

import { useSyncExternalStore } from "react"
import { Loader2 } from "lucide-react"

/**
 * App-wide loading indicator. A single fetch interceptor counts in-flight
 * requests (Server Actions and /api calls both travel over window.fetch in the
 * App Router) and a module-level store broadcasts the active count to the one
 * overlay rendered below. Kept outside React so the patched fetch — which runs
 * outside the component tree — can update it directly.
 */

let activeCount = 0
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function start() {
  activeCount += 1
  emit()
}

function end() {
  activeCount = Math.max(0, activeCount - 1)
  emit()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return activeCount
}

// Skip Next.js route prefetches (triggered on link hover) so the spinner never
// flashes for navigation the user hasn't committed to.
function isPrefetch(init?: RequestInit): boolean {
  const headers = init?.headers
  if (!headers) return false
  if (headers instanceof Headers) return headers.has("Next-Router-Prefetch")
  if (Array.isArray(headers)) return headers.some(([k]) => k.toLowerCase() === "next-router-prefetch")
  return Object.keys(headers).some((k) => k.toLowerCase() === "next-router-prefetch")
}

function installInterceptor() {
  if (typeof window === "undefined") return
  const w = window as Window & { __fcFetchPatched?: boolean }
  if (w.__fcFetchPatched) return
  w.__fcFetchPatched = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (isPrefetch(init)) return originalFetch(input, init)
    start()
    return originalFetch(input, init).then(
      (response) => {
        // fetch() resolves when response *headers* arrive, but RSC navigations
        // and Server Actions stream their rendered data after that — so ending
        // here would hide the spinner while the page is still loading. Instead,
        // drain a clone to keep the count active until the body fully streams
        // in. The original response is returned untouched so Next's router still
        // sees redirected/url/status correctly.
        try {
          const body = response.clone().body
          if (!body) {
            end()
            return response
          }
          const reader = body.getReader()
          const drain = (): void => {
            reader
              .read()
              .then(({ done }) => (done ? end() : drain()))
              .catch(end)
          }
          drain()
        } catch {
          end()
        }
        return response
      },
      (err) => {
        end()
        throw err
      },
    )
  }
}

// Patch as soon as this module loads on the client, before the first request.
installInterceptor()

export default function GlobalSpinner() {
  const count = useSyncExternalStore(subscribe, getSnapshot, () => 0)
  if (count <= 0) return null

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/5 dark:bg-black/20"
    >
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-light)] p-4 shadow-[var(--shadow-card-hover)]">
        <Loader2 className="h-6 w-6 animate-spin text-teal" />
        <span className="sr-only">Loading</span>
      </div>
    </div>
  )
}
