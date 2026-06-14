import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import AppShell from "@/components/layout/AppShell"

export default async function CirclesHomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  return (
    <AppShell
      currentUser={{
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      }}
    >
      {children}
    </AppShell>
  )
}
