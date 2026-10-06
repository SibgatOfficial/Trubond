"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FileText,
  FolderKanban,
  Home,
  Loader2,
  MessageSquare,
  Search,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/constants";
import {
  fetchSearchPool,
  matchesTerm,
  searchUsersByUsername,
  type SearchPool,
} from "@/lib/services/search";
import { DEFAULT_AVATAR, initials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UserProfile } from "@/types";

const NAV_ICONS: Record<string, typeof Home> = {
  home: Home,
  notes: FileText,
  chat: MessageSquare,
  group: Users,
  event: CalendarDays,
  folder: FolderKanban,
  account_circle: UserCircle,
};

const EMPTY_POOL: SearchPool = {
  notes: [],
  projects: [],
  events: [],
  people: [],
};

/**
 * Global command palette (Ctrl/Cmd + K).
 *
 * Results come from two sources: a live Firestore prefix query for people, and
 * a capped pool of notes/projects/events loaded once on first open and filtered
 * in the browser.
 */
export function CommandPalette() {
  const router = useRouter();
  const { profile } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [pool, setPool] = React.useState<SearchPool | null>(null);
  const [poolLoading, setPoolLoading] = React.useState(false);
  const [people, setPeople] = React.useState<UserProfile[]>([]);

  // Ctrl/Cmd + K opens it from anywhere, including inside inputs.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Load the browseable pool lazily, once, on first open.
  React.useEffect(() => {
    if (!open || pool || poolLoading) return;
    setPoolLoading(true);
    fetchSearchPool()
      .then(setPool)
      .catch((error) => {
        console.error("Search pool failed:", error);
        setPool(EMPTY_POOL);
      })
      .finally(() => setPoolLoading(false));
  }, [open, pool, poolLoading]);

  // Debounced live people search.
  React.useEffect(() => {
    const value = term.trim();
    if (!open || !value) {
      setPeople([]);
      return;
    }
    let active = true;
    const timeout = setTimeout(() => {
      searchUsersByUsername(value)
        .then((results) => {
          if (active) setPeople(results);
        })
        .catch(() => undefined);
    }, 220);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [term, open]);

  // Reset between opens so stale results never flash.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTerm("");
  };

  const go = (href: string) => {
    setOpen(false);
    setTerm("");
    router.push(href);
  };

  const source = pool ?? EMPTY_POOL;
  const searching = term.trim().length > 0;

  const navMatches = NAV_ITEMS.filter((item) =>
    matchesTerm(term, item.label, item.href)
  );

  const noteMatches = searching
    ? source.notes
        .filter((note) =>
          matchesTerm(term, note.title, note.subject, note.description)
        )
        .slice(0, 5)
    : [];

  const projectMatches = searching
    ? source.projects
        .filter((project) =>
          matchesTerm(term, project.title, project.description)
        )
        .slice(0, 5)
    : [];

  const eventMatches = searching
    ? source.events
        .filter((event) => matchesTerm(term, event.title, event.description))
        .slice(0, 5)
    : [];

  // With no search term, offer a few people to browse instead.
  const peopleResults = searching
    ? people
    : (pool?.people ?? []).filter((p) => p.id !== profile?.id).slice(0, 5);

  const hasDynamicResults =
    peopleResults.length > 0 ||
    noteMatches.length > 0 ||
    projectMatches.length > 0 ||
    eventMatches.length > 0;

  const noResults = searching && navMatches.length === 0 && !hasDynamicResults;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Search Trubond (Ctrl+K)"
        className="h-9 gap-2 px-2 text-muted-foreground sm:w-52 sm:justify-start sm:px-3"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <CommandInput
          value={term}
          onValueChange={setTerm}
          placeholder="Search people, notes, projects, events…"
        />
        <CommandList>
          {noResults && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing found for &ldquo;{term}&rdquo;.
            </p>
          )}

          {navMatches.length > 0 && (
            <CommandGroup heading="Go to">
              {navMatches.map((item) => {
                const Icon = NAV_ICONS[item.icon] ?? Home;
                return (
                  <CommandItem
                    key={item.href}
                    value={`nav-${item.href}`}
                    onSelect={() => go(item.href)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </CommandItem>
                );
              })}
              <CommandItem
                value="nav-settings"
                onSelect={() => go("/settings")}
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Settings
              </CommandItem>
            </CommandGroup>
          )}

          {peopleResults.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="People">
                {peopleResults.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={`person-${person.id}`}
                    onSelect={() => go("/profile")}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={person.profilePhotoUrl || DEFAULT_AVATAR}
                        alt={person.name}
                      />
                      <AvatarFallback className="text-[10px]">
                        {initials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">
                      {person.name}{" "}
                      <span className="text-muted-foreground">
                        @{person.username}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {noteMatches.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Notes">
                {noteMatches.map((note) => (
                  <CommandItem
                    key={note.id}
                    value={`note-${note.id}`}
                    onSelect={() => go("/notes")}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{note.title}</span>
                    {note.subject ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {note.subject}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {projectMatches.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Projects">
                {projectMatches.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`project-${project.id}`}
                    onSelect={() => go("/projects")}
                  >
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {project.title}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {eventMatches.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Events">
                {eventMatches.map((event) => (
                  <CommandItem
                    key={event.id}
                    value={`event-${event.id}`}
                    onSelect={() => go("/events")}
                  >
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{event.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {poolLoading && (
            <p className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading index…
            </p>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
