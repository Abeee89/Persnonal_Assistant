"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { localIsoDay } from "@/lib/domain/dates";
import { useShortcuts } from "@/components/layout/shortcut-provider";
import type { SearchHit } from "../service";
import { SnippetText } from "./search-results";

export const PALETTE_DEBOUNCE_MS = 200;

interface ApiResponse {
  ok: boolean;
  data?: SearchHit[];
}

function quickLinks(today: string) {
  return [
    { label: "Add activity", href: "/activities/new" },
    { label: "Write today's journal", href: `/journal/${today}` },
    { label: "New task", href: "/tasks" },
    { label: "Calendar", href: "/calendar" },
    { label: "Statistics", href: "/statistics" },
  ];
}

export function CommandPalette() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);

  const { register } = useShortcuts();

  useEffect(() => {
    return register("search", () => {
      setOpen((value) => !value);
    });
  }, [register]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) {
      return;
    }
    if (open && !node.open) {
      node.showModal();
    }
    if (!open && node.open) {
      node.close();
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === "") {
      setHits([]);
      setActive(0);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=5`, { signal: controller.signal })
        .then((response) => response.json() as Promise<ApiResponse>)
        .then((json) => {
          setHits(json.ok && json.data ? json.data : []);
          setActive(0);
        })
        .catch(() => {
          setHits([]);
        });
    }, PALETTE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const items: { key: string; label: string; href: string; hit?: SearchHit }[] =
    query.trim() === ""
      ? quickLinks(localIsoDay()).map((link) => ({ key: link.href, label: link.label, href: link.href }))
      : hits.map((hit) => ({ key: `${hit.kind}:${hit.ref}`, label: hit.title, href: hit.href, hit }));

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const item = items[active];
      if (item) {
        event.preventDefault();
        go(item.href);
      }
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Search and quick actions"
      onClose={() => {
        setOpen(false);
      }}
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <div className="border-b border-border p-3">
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search or jump to…"
          aria-label="Search or jump to"
          aria-controls="palette-results"
          aria-activedescendant={items[active] ? `palette-${String(active)}` : undefined}
          className="h-9 w-full bg-transparent px-2 text-sm outline-none"
        />
      </div>
      <ul id="palette-results" role="listbox" className="max-h-96 overflow-y-auto p-2">
        {items.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">No results</li>
        ) : null}
        {items.map((item, index) => (
          <li key={item.key} id={`palette-${String(index)}`} role="option" aria-selected={index === active}>
            <Link
              href={item.href}
              onClick={(event) => {
                event.preventDefault();
                go(item.href);
              }}
              className={cn(
                "block rounded-md px-3 py-2 text-sm",
                index === active ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="block truncate">{item.label}</span>
              {item.hit ? <SnippetText hit={item.hit} /> : null}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>↑↓ to move · Enter to open</span>
        <span>Esc to close</span>
      </div>
    </dialog>
  );
}
