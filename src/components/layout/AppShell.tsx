"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { isAdminOrOwner } from "@/lib/permissions"
import UserDropdown from "./UserDropdown"
import {
  PiggyBank,
  LayoutDashboard,
  Users,
  Banknote,
  HandCoins,
  Menu,
  ScrollText,
  Settings,
} from "lucide-react"

interface AppUser {
  id: string
  email: string
  name: string
  circleRole?: string
  avatarUrl: string | null
}

function AppSidebar({ currentUser }: { currentUser: AppUser }) {
  const pathname = usePathname()
  const isCirclesHome = pathname === "/circles"
  const isInCircle = pathname.startsWith("/circles/") && !isCirclesHome
  const circleId = isInCircle ? pathname.split("/")[2] : ""

  const circleLinks = isInCircle
    ? [
        { href: `/circles/${circleId}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
        { href: `/circles/${circleId}/members`, label: "Members", icon: Users },
        { href: `/circles/${circleId}/cycles`, label: "Payments", icon: Banknote },
        { href: `/circles/${circleId}/loans`, label: "Loans", icon: HandCoins },
        ...(isAdminOrOwner(currentUser.circleRole ?? "")
          ? [
              { href: `/circles/${circleId}/audit-logs`, label: "Audit Logs", icon: ScrollText },
              { href: `/circles/${circleId}/settings`, label: "Settings", icon: Settings },
            ]
          : []),
      ]
    : []

  return (
    <aside className="hidden lg:flex w-60 border-r border-[var(--border-color)] bg-[var(--bg-surface)] flex-col shrink-0">
      <div className="p-4 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal flex items-center justify-center shrink-0">
            <PiggyBank className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-sm text-[var(--text-primary)] tracking-tight">
              Fund Circle
            </h2>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {isInCircle ? (
          circleLinks.map((link) => {
            const Icon = link.icon
            const active = pathname === link.href || pathname.startsWith(link.href + "/")
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  active
                    ? "bg-teal-50 text-teal dark:bg-teal-900/20 dark:text-teal-400"
                    : "text-[var(--text-secondary)] hover:bg-[var(--border-light)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })
        ) : (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-teal-50 text-teal dark:bg-teal-900/20 dark:text-teal-400 text-sm font-medium">
            <PiggyBank className="h-4 w-4" />
            Fund Circles
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-[var(--border-light)]">
        <UserDropdown
          user={{
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.circleRole ?? "",
            avatarUrl: currentUser.avatarUrl,
          }}
        />
      </div>
    </aside>
  )
}

function BottomNav({ currentUser }: { currentUser: AppUser }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const isInCircle = pathname.startsWith("/circles/") && pathname !== "/circles"
  const circleId = isInCircle ? pathname.split("/")[2] : ""

  if (!isInCircle) {
    return (
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)] border-t border-[var(--border-color)]">
        <div className="flex items-center justify-center h-16">
          <div className="flex flex-col items-center justify-center gap-0.5 text-teal">
            <PiggyBank className="h-5 w-5" strokeWidth={2.5} />
            <span className="text-[10px] font-medium">Circles</span>
          </div>
        </div>
      </nav>
    )
  }

  const mainTabs = [
    { href: `/circles/${circleId}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/circles/${circleId}/members`, label: "Members", icon: Users },
    { href: `/circles/${circleId}/cycles`, label: "Payments", icon: Banknote },
    { href: `/circles/${circleId}/loans`, label: "Loans", icon: HandCoins },
  ]

  const moreTabs = isAdminOrOwner(currentUser.circleRole ?? "")
    ? [
        { href: `/circles/${circleId}/audit-logs`, label: "Audit", icon: ScrollText },
        { href: `/circles/${circleId}/settings`, label: "Settings", icon: Settings },
      ]
    : []

  const isMoreActive = moreTabs.some((t) => pathname.startsWith(t.href))

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)] border-t border-[var(--border-color)]">
      <div className="flex items-center justify-around h-16 px-2">
        {mainTabs.map((tab) => {
          const Icon = tab.icon
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/")
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 px-2 rounded-xl transition-colors",
                active ? "text-teal" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium leading-tight truncate max-w-full">{tab.label}</span>
            </Link>
          )
        })}

        <div className="relative flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 px-2">
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors",
              isMoreActive ? "text-teal" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            <Menu className="h-5 w-5" strokeWidth={isMoreActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>

          {moreOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
              <div className="absolute bottom-full right-0 mb-3 w-40 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-card-hover)] overflow-hidden z-40">
                {moreTabs.map((tab) => {
                  const Icon = tab.icon
                  const active = pathname.startsWith(tab.href)
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-teal-50 text-teal font-medium"
                          : "text-[var(--text-secondary)] hover:bg-[var(--border-light)]"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

function MobileHeader({ currentUser }: { currentUser: AppUser }) {
  const user = {
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.circleRole ?? "",
    avatarUrl: currentUser.avatarUrl,
  }

  return (
    <div className="lg:hidden sticky top-0 z-30 bg-[var(--bg-page)] border-b border-[var(--border-light)]">
      <div className="flex items-center justify-between px-4 h-12">
        <div className="flex items-center">
          <div className="w-7 h-7 rounded-lg bg-teal flex items-center justify-center shrink-0">
            <PiggyBank className="h-4 w-4 text-white" />
          </div>
          <span className="ml-2.5 text-sm font-bold text-[var(--text-primary)] tracking-tight">
            Fund Circle
          </span>
        </div>
        <UserDropdown user={user} compact side="bottom" />
      </div>
    </div>
  )
}

export default function AppShell({
  children,
  currentUser,
}: {
  children: React.ReactNode
  currentUser: AppUser
}) {
  return (
    <div className="flex h-full">
      <AppSidebar currentUser={currentUser} />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader currentUser={currentUser} />
        <main className="flex-1 overflow-auto pb-20 lg:pb-0">
          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
      <BottomNav currentUser={currentUser} />
    </div>
  )
}
