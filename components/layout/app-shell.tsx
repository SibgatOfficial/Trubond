"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  FolderKanban,
  GraduationCap,
  Home,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { DEFAULT_AVATAR, cn, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LoadingAnimation } from "@/components/ui/lottie-animation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { CommandPalette } from "@/components/search/command-palette";
import { usePresenceHeartbeat } from "@/hooks/use-presence";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { toast } from "sonner";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  notes: FileText,
  chat: MessageSquare,
  group: Users,
  event: CalendarDays,
  folder: FolderKanban,
  account_circle: UserCircle,
};

/** Solid brand tile — the shell's signature mark (splash + header). */
function BrandTile({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-wash text-white shadow-soft",
        className
      )}
    >
      <GraduationCap className="h-[18px] w-[18px]" />
    </span>
  );
}

function LoadingSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-4">
      <BrandTile className="h-14 w-14 rounded-2xl [&>svg]:h-7 [&>svg]:w-7" />
      <div className="text-center">
        <p className="font-display text-xl font-bold tracking-tight">
          {APP_NAME}
        </p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">
          Loading your campus…
        </p>
      </div>
      {/* Brand loading animation — the dots also act as the progress hint. */}
      <LoadingAnimation className="h-10 w-20" />
    </div>
  );
}

/**
 * Sidebar / bottom-bar link.
 *
 * The active state is solid brand colour — one strong moment in the shell, so
 * the current location always reads first. Everything else stays neutral.
 */
function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed = false,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  /** Icon-only rail. The label moves into `title`/`aria-label`. */
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
        collapsed && "justify-center px-0",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const { canInstall, promptInstall } = useInstallPrompt();

  // Read after mount so the server-rendered markup (always expanded) matches
  // the first client render — the same reason the theme toggle defers to an
  // effect.
  React.useEffect(() => {
    try {
      setCollapsed(
        window.localStorage.getItem("trubond:sidebar-collapsed") === "true"
      );
    } catch {
      /* storage blocked — stay expanded */
    }
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(
          "trubond:sidebar-collapsed",
          String(next)
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/");
    else if (!profile) router.replace("/onboarding");
  }, [user, profile, loading, router]);

  // Keeps this user's `isOnline` / `lastSeen` fresh for as long as the app is
  // open. Mounted here (not per page) so it survives client-side navigation.
  usePresenceHeartbeat(user?.uid);

  const handleSignOut = React.useCallback(async () => {
    await signOut();
    toast.success("Signed out");
    router.replace("/");
  }, [signOut, router]);

  if (loading || !user || !profile) {
    return <LoadingSplash />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ---------- Top bar ------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/75 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/home"
            className="group flex shrink-0 items-center gap-2.5"
          >
            <BrandTile className="transition-transform duration-200 group-hover:scale-105" />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              {APP_NAME}
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-1">
            <CommandPalette />

            {/* Only rendered when the browser has actually offered an install
                prompt — otherwise there is nothing to trigger. */}
            {canInstall && (
              <Button
                variant="ghost"
                size="sm"
                className="hidden gap-1.5 rounded-full text-muted-foreground hover:text-foreground lg:inline-flex"
                onClick={() => {
                  void promptInstall();
                }}
                aria-label="Install the Trubond app"
                title="Install the Trubond app"
              >
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline">Install</span>
              </Button>
            )}

            <ThemeToggle className="rounded-full" />
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="ml-0.5 flex h-10 shrink-0 items-center gap-2 rounded-full border border-border/70 pl-0.5 pr-1 transition-colors hover:bg-accent sm:pr-3"
                  aria-label="Account menu"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={profile.profilePhotoUrl || DEFAULT_AVATAR}
                      alt={profile.name}
                    />
                    <AvatarFallback>
                      {initials(profile.name || profile.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-36 truncate text-sm font-semibold sm:inline">
                    {profile.name || profile.username}
                  </span>
                  <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{profile.name || profile.username}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      @{profile.username}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/profile")}>
                  <UserCircle /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/settings")}>
                  <Settings /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={handleSignOut}
                >
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* One container governs the whole shell: header and body gutters align
          exactly (pixel-perfect brand-to-sidebar edge). 8px rhythm throughout. */}
      <div className="mx-auto flex max-w-7xl gap-6 px-4 pb-24 pt-6 sm:px-6 md:pb-10">
        <aside
          className={cn(
            "sticky top-[5.5rem] hidden max-h-[calc(100dvh-7rem)] shrink-0 flex-col overflow-y-auto px-1 transition-[width] duration-200 scrollbar-thin md:flex",
            collapsed ? "w-[4.5rem]" : "w-60"
          )}
        >
          <div
            className={cn(
              "mb-3 flex",
              collapsed ? "justify-center" : "justify-end"
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground"
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          {!collapsed && (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              Menu
            </p>
          )}

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={ICONS[item.icon] ?? Home}
                active={pathname === item.href}
                collapsed={collapsed}
              />
            ))}
          </nav>

          <div className="my-3 h-px shrink-0 bg-border" />

          <nav className="flex flex-col gap-1">
            <NavLink
              href="/settings"
              label="Settings"
              icon={Settings}
              active={pathname === "/settings"}
              collapsed={collapsed}
            />
            <button
              type="button"
              onClick={handleSignOut}
              title={collapsed ? "Sign out" : undefined}
              aria-label={collapsed ? "Sign out" : undefined}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive",
                collapsed && "justify-center px-0"
              )}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">Sign out</span>}
            </button>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile bottom nav — an N-column grid (N = NAV_ITEMS.length), so items
          never squash into an overflow-scroll strip. pb respects notches. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Primary"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))`,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon] ?? Home;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className="group flex min-w-0 flex-col items-center gap-1 px-0.5 pb-2 pt-2"
              >
                <span
                  className={cn(
                    "flex h-7 w-11 items-center justify-center rounded-full transition-colors duration-150",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground group-hover:bg-accent"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span
                  className={cn(
                    "w-full truncate text-center text-[11px] font-medium leading-tight",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
