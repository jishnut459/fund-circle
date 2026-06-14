import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { resolveUserOnSignIn } from "@/lib/onboarding"
import type { CookieOptions } from "@supabase/ssr"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no-code`)
  }

  let supabaseCookies: { name: string; value: string; options: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          supabaseCookies = cookiesToSet
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth-failed`)
  }

  const email = data.user.email
  if (email) {
    await resolveUserOnSignIn(
      data.user.id,
      email,
      data.user.user_metadata as Record<string, string>
    )
  }

  const response = NextResponse.redirect(`${origin}/circles`)

  supabaseCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })

  return response
}
