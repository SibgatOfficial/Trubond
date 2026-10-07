"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
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

function LoadingSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <GraduationCap className="h-7 w-7" />
      </div>
      {/* Brand loading animation — the dots also act as the progress hint. */}
      <LoadingAnimation className="h-14 w-24" />
      <p className="text-sm text-muted-foreground">Loading {APP_NAME}…</p>
    </div>
  );
}

/** Shared sidebar/bottom-bar link with a subtle hover motion. */
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
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        collapsed && "justify-center px-2",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-transform duration-200",
          !active && "group-hover:scale-110"
        )}
      />
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
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/65">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link
            href="/home"
            className="flex items-center gap-2 transition-opacity hover:opacity-90"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-bold text-primary">
              {APP_NAME}
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            <CommandPalette />

            {/* Only rendered when the browser has actually offered an install
                prompt — otherwise there is nothing to trigger. */}
            {canInstall && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
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

            <ThemeToggle />
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full border p-1 pr-3 transition-colors hover:bg-accent"
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={profile.profilePhotoUrl || DEFAULT_AVATAR}
                      alt={profile.name}
                    />
                    <AvatarFallback>
                      {initials(profile.name || profile.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-semibold sm:inline">
                    {profile.name || profile.username}
                  </span>
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

      <div className="mx-auto flex max-w-6xl gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6">
        <aside
          className={cn(
            "sticky top-24 hidden h-fit shrink-0 transition-[width] duration-200 md:block",
            collapsed ? "w-16" : "w-60"
          )}
        >
          <div
            className={cn(
              "mb-2 flex",
              collapsed ? "justify-center" : "justify-end"
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
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

          <div className="my-3 h-px bg-border" />

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
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive",
                collapsed && "justify-center px-2"
              )}
            >
              <LogOut className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {!collapsed && <span className="truncate">Sign out</span>}
            </button>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 pb-20 md:pb-6">{children}</main>
      </div>

      {/* Horizontally scrollable so seven items never squash on a narrow phone. */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex overflow-x-auto border-t bg-card/95 backdrop-blur-md scrollbar-thin md:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon] ?? Home;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-[3.75rem] flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
