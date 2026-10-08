"use client";

import * as React from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** One institution from the OpenAlex autocomplete API. */
interface Institution {
  id: string;
  display_name: string;
  /** Location hint, e.g. "Bengaluru, India". May be missing. */
  hint?: string | null;
}

interface AutocompleteResponse {
  results?: Institution[];
}

const ENDPOINT = "https://api.openalex.org/autocomplete/institutions";
const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const MAX_RESULTS = 8;

type SearchStatus = "idle" | "loading" | "results" | "empty" | "error";

/**
 * College / university picker backed by the OpenAlex autocomplete API.
 *
 * The text in the input is never committed on its own — only clicking a
 * result is. Typing after a selection clears the committed value, so the
 * parent's "required" validation only ever sees a real choice from the list.
 */
export function UniversitySearch({
  id,
  value,
  onChange,
  placeholder = "Search college or university...",
  required,
  className,
}: {
  id?: string;
  /** The committed (selected) university name. */
  value: string;
  /** Called with the selected institution's display name, or "" when cleared. */
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [query, setQuery] = React.useState(value);
  const [results, setResults] = React.useState<Institution[]>([]);
  const [status, setStatus] = React.useState<SearchStatus>("idle");
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  // True while the input is ahead of the `value` prop (user is typing), so the
  // sync effect below doesn't stomp the draft with the previous selection.
  const typingRef = React.useRef(false);

  // Keep the visible text in sync when the committed value changes from
  // outside (e.g. the edit dialog re-opening with the saved university).
  React.useEffect(() => {
    if (typingRef.current) {
      typingRef.current = false;
      return;
    }
    setQuery(value);
  }, [value]);

  // Debounced OpenAlex lookup; aborted on every keystroke so stale responses
  // never overwrite newer results.
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setResults([]);
      setStatus("idle");
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setStatus("loading");
      setOpen(true);
      try {
        const response = await fetch(
          `${ENDPOINT}?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("OpenAlex request failed");
        const data: AutocompleteResponse = await response.json();
        if (controller.signal.aborted) return;
        const items = (data.results ?? []).slice(0, MAX_RESULTS);
        setResults(items);
        setStatus(items.length > 0 ? "results" : "empty");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(error);
        setResults([]);
        setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  // Close when clicking anywhere outside the field + dropdown.
  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const handleSelect = (institution: Institution) => {
    typingRef.current = false;
    setQuery(institution.display_name);
    setResults([]);
    setStatus("idle");
    setOpen(false);
    onChange(institution.display_name);
  };


  return (
    <div ref={wrapperRef} className="university-search relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          value={query}
          onChange={(e) => {
            typingRef.current = true;
            setQuery(e.target.value);
            // Typed text is not a selection — invalidate any committed value.
            onChange("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className={cn("pl-9", className)}
          required={required}
        />
      </div>

      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border bg-card shadow-raised"
          role="listbox"
        >
          {status === "loading" ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Searching institutions...
            </div>
          ) : status === "empty" ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No college or university found.
            </div>
          ) : status === "error" ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Couldn&apos;t search right now.
            </div>
          ) : (
            results.map((institution) => (
              <button
                key={institution.id}
                type="button"
                onClick={() => handleSelect(institution)}
                className="block w-full border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="block text-sm font-semibold text-foreground">
                  {institution.display_name}
                </span>
                {institution.hint ? (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {institution.hint}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
