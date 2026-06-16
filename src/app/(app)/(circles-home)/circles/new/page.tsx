import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import CreateCircleWizard from "@/components/fund-circles/wizard/CreateCircleWizard"

export default async function NewCirclePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  return (
    <div className="max-w-2xl mx-auto">
      <CreateCircleWizard userId={user.id} userName={user.name ?? user.email} />
    </div>
  )
}
