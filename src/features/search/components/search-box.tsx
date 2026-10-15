"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type SubmitEvent } from "react";

export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = value.trim();
    router.push(q === "" ? "/search" : `/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form role="search" onSubmit={submit} className="flex gap-2">
      <label className="sr-only" htmlFor="search-input">
        Search
      </label>
      <input
        id="search-input"
        type="search"
        autoFocus
        maxLength={200}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        placeholder="Search your activity, journal, tasks and goals"
        className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
        Search
      </button>
    </form>
  );
}
