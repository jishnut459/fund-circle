import { cookies } from "next/headers"
import { isAdminOrOwner } from "@/lib/permissions"

export type ViewPreference = "admin" | "member"

/** Per-circle cookie name holding an admin's chosen view ("admin" | "member"). */
export function viewCookieName(circleId: string): string {
  return `fc-view-as-${circleId}`
}

export async function getViewPreference(circleId: string): Promise<ViewPreference> {
  const store = await cookies()
  return store.get(viewCookieName(circleId))?.value === "member" ? "member" : "admin"
}

/**
 * The role the UI should behave as. Admins/owners may downgrade themselves to the
 * member experience via the view toggle; members can never escalate, so their
 * preference is ignored. This is presentation only — RLS remains the real access
 * boundary and server actions re-check the true role before mutating.
 */
export function resolveEffectiveRole(actualRole: string, viewPref: ViewPreference): string {
  if (isAdminOrOwner(actualRole) && viewPref === "member") return "member"
  return actualRole
}

/** Convenience: read the per-circle preference and apply it to the actual role. */
export async function getEffectiveRole(circleId: string, actualRole: string): Promise<string> {
  return resolveEffectiveRole(actualRole, await getViewPreference(circleId))
}
