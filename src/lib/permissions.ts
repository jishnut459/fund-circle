export function isOwner(role: string): boolean {
  return role === "owner"
}

export function isAdminOrOwner(role: string): boolean {
  return role === "owner" || role === "admin"
}

export function isCircleAdminOrOwner(role: string): boolean {
  return isAdminOrOwner(role)
}

export function canEditContributions(role: string): boolean {
  return isAdminOrOwner(role)
}

export function canEditCircle(role: string): boolean {
  return isAdminOrOwner(role)
}
