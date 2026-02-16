"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Search,
  Swords,
  Shield,
  Settings,
  LogOut,
  User,
  ChevronUp,
  Activity,
  Crosshair,
  RefreshCw,
  BookOpen,
  TrendingUp,
  Eye,
} from "lucide-react";

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  return (
    <Sidebar collapsible="icon" className="overflow-hidden">
      {/* ── Logo ── */}
      <SidebarHeader className="px-3 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center"
        >
          <Crosshair className="size-5 shrink-0 text-primary" />
          <span className="text-sm font-semibold tracking-wide text-foreground group-data-[collapsible=icon]:hidden">
            WFM
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden flex flex-col">
        {/* ── Group 1: Deals (arbitrage / find deals) ── */}
        <SidebarGroup className="data-[slot=sidebar-group]:py-2">
          <SidebarGroupLabel className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground px-2 mb-1">
            Deals
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard"}
                  tooltip="Rank Value"
                >
                  <Link href="/dashboard">
                    <Activity className="size-4" />
                    <span>Rank Value</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/endo-arb"}
                  tooltip="Reroll Value"
                >
                  <Link href="/endo-arb">
                    <RefreshCw className="size-4" />
                    <span>Reroll Value</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-2 w-auto" />

        {/* ── Group 2: Tracker (portfolio + watch) ── */}
        <SidebarGroup className="data-[slot=sidebar-group]:py-2">
          <SidebarGroupLabel className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground px-2 mb-1">
            Tracker
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/tracker"}
                  tooltip="Portfolio"
                >
                  <Link href="/tracker">
                    <BookOpen className="size-4" />
                    <span>Portfolio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/watch"}
                  tooltip="Watch"
                >
                  <Link href="/watch">
                    <Eye className="size-4" />
                    <span>Watch</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-2 w-auto" />

        {/* ── Group 3: Misc (Investment, Search) ── */}
        <SidebarGroup className="data-[slot=sidebar-group]:py-2">
          <SidebarGroupLabel className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground px-2 mb-1">
            Misc
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/investment"}
                  tooltip="Investment"
                >
                  <Link href="/investment">
                    <TrendingUp className="size-4" />
                    <span>Investment</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/search"}
                  tooltip="Search"
                >
                  <Link href="/search">
                    <Search className="size-4" />
                    <span>Search</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            <SidebarSeparator className="mx-2 w-auto" />
            {/* ── Group 4: Admin ── */}
            <SidebarGroup className="data-[slot=sidebar-group]:py-2">
              <SidebarGroupLabel className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground px-2 mb-1">
                Admin
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/weapons"}
                      tooltip="Weapons"
                    >
                      <Link href="/weapons">
                        <Swords className="size-4" />
                        <span>Weapons</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === "/admin"}
                      tooltip="Settings"
                    >
                      <Link href="/admin">
                        <Shield className="size-4" />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <div className="flex-1 min-h-2" />
      </SidebarContent>

      {/* ── User footer ── */}
      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="w-full data-[state=open]:bg-sidebar-accent"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                <User className="size-3.5" />
              </div>
              <div className="flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <p className="truncate text-xs font-medium">
                  {session?.user?.name ?? "User"}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {session?.user?.role ?? ""}
                </p>
              </div>
              <ChevronUp className="size-3 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44" side="top" align="start" sideOffset={8}>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="gap-2">
                <Settings className="size-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="gap-2 text-destructive"
            >
              <LogOut className="size-3.5" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
