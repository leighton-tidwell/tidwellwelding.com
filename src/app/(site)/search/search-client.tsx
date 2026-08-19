"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import Card from "@/components/ds/card";
import Icon from "@/components/ds/icon";
import Input from "@/components/ds/input";
import { searchEntries } from "@/lib/search-index";

const kicker: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.55)",
};

const displayHead: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 900,
  fontStyle: "oblique 10deg",
  lineHeight: 0.9,
  textTransform: "uppercase",
  color: "#ffffff",
  margin: 0,
};

export default function SearchClient({
  initialQuery,
}: {
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);

  // Keep ?q= in the address bar without a server round trip.
  useEffect(() => {
    const trimmed = query.trim();
    const url = trimmed
      ? `/search?q=${encodeURIComponent(trimmed)}`
      : "/search";
    window.history.replaceState(null, "", url);
  }, [query]);

  const results = useMemo(() => searchEntries(query), [query]);
  const trimmed = query.trim();

  return (
    <section className="mx-auto w-full max-w-[760px] flex-1 px-5 pb-20 pt-14 sm:px-8 lg:pt-20">
      <div className="flex flex-col gap-6">
        <div style={kicker}>Site search</div>
        <h1 className="text-[44px] sm:text-[56px]" style={displayHead}>
          Find it <span style={{ color: "#c90314" }}>fast</span>.
        </h1>
        <Input
          label="Search the site"
          placeholder="Pipe, gates, Granbury, quote..."
          type="search"
          inputMode="search"
          size="lg"
          adornment={<Icon name="search" size={18} color="#8f989e" />}
          value={query}
          onChange={(value) => setQuery(value)}
          hint="Type a service, a material or a town."
        />
        <div
          role="status"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,.5)",
          }}
        >
          {trimmed
            ? `${results.length} ${results.length === 1 ? "match" : "matches"} for "${trimmed}"`
            : "All pages"}
        </div>
        {results.length === 0 ? (
          <Card eyebrow="No matches" title="Nothing came up.">
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                lineHeight: 1.5,
                color: "rgba(255,255,255,.68)",
                margin: 0,
              }}
            >
              Try a shorter word. Or call (817) 894-6357 and ask Eric.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {results.map((entry) => (
              <Link
                key={entry.url}
                href={entry.url}
                style={{
                  textDecoration: "none",
                  display: "block",
                  border: "none",
                }}
              >
                <Card
                  interactive
                  eyebrow={entry.url}
                  title={entry.title}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: "rgba(255,255,255,.68)",
                      margin: 0,
                    }}
                  >
                    {entry.description}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
