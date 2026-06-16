import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import CreateCircleWizard from "@/components/fund-circles/wizard/CreateCircleWizard"

export default async function NewCirclePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          Create Fund Circle
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Set up your new fund circle in a few steps
        </p>
      </div>
      <CreateCircleWizard userId={user.id} userName={user.name ?? user.email} />
    </div>
  )
}
