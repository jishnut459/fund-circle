import { createServerSupabaseClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import LoginCard from "@/components/auth/LoginCard"

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect("/circles")

  const { error } = await searchParams

  return (
    <div className="min-h-full flex items-center justify-center bg-[var(--bg-page)]">
      <LoginCard incomingError={error} />
    </div>
  )
}
