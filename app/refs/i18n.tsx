"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

export type Lang = "ru" | "en";

const STORAGE_KEY = "refs-lang";

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({
  lang: "en",
  setLang: () => {},
});

// The choice lives in localStorage; components subscribe to it as an external store
const listeners = new Set<() => void>();

function readLang(): Lang {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {}
  if (saved === "ru" || saved === "en") return saved;
  // First visit: follow the browser language
  return navigator.language.startsWith("ru") ? "ru" : "en";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeLang(next: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {}
  listeners.forEach((l) => l());
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLang, () => "en" as Lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    // The rest of the site is in English
    return () => {
      document.documentElement.lang = "en";
    };
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang: writeLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Picks the English variant when there is one */
export function pick<T>(lang: Lang, ru: T, en: T | undefined): T {
  return lang === "en" && en !== undefined ? en : ru;
}

const NAV = {
  ru: { projects: "Проекты", lab: "Лаба", refs: "Референсы" },
  en: { projects: "Projects", lab: "Lab", refs: "References" },
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[26px] font-bold tracking-tight">
      <svg viewBox="0 0 32 24" className="h-6 w-8">
        <defs>
          <linearGradient id="refs-logo-grad" x1="0" x2="1">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#f9a8d4" />
          </linearGradient>
        </defs>
        <path d="M3 22L9 2M12 22L18 2M21 22L27 2" stroke="url(#refs-logo-grad)" strokeWidth={5} strokeLinecap="round" />
      </svg>
      3labs
    </Link>
  );
}

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1" role="group" aria-label="Language">
      {(["ru", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold uppercase transition ${
            lang === l ? "bg-white text-black" : "text-white/60 hover:text-white"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Same header as the Projects gallery, with References (or ThreeUI) active */
export function RefsHeader() {
  const { lang } = useLang();
  const t = NAV[lang];
  const onThreeUI = usePathname().startsWith("/refs/threeui");
  return (
    <header className="flex items-center justify-between px-4 py-4 sm:px-6">
      <div className="flex items-center gap-10">
        <Logo />
        <nav className="hidden items-center gap-10 text-[15px] font-medium text-white/70 lg:flex">
          <Link href="/projects" className="hover:text-white">
            {t.projects}
          </Link>
          <Link href="/" className="hover:text-white">
            {t.lab}
          </Link>
          <Link href="/refs" className={onThreeUI ? "hover:text-white" : "text-white"}>
            {t.refs}
          </Link>
          <Link href="/refs/threeui" className={onThreeUI ? "text-white" : "hover:text-white"}>
            ThreeUI
          </Link>
          <a href="https://github.com/hasot/3-labs" target="_blank" rel="noreferrer" className="hover:text-white">
            GitHub
          </a>
        </nav>
      </div>
      <LangToggle />
    </header>
  );
}

/** Pill tabs, styled like the Projects filters */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="mb-10 flex items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1 [scrollbar-width:none]">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`shrink-0 rounded-full px-5 py-2 text-[15px] font-medium transition ${
            value === item.id ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Centered hero: badge, uppercase title with a glowing gradient word, lead */
export function Hero({
  badge,
  before,
  accent,
  lead,
  children,
}: {
  badge: string;
  before: string;
  accent: string;
  lead: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="px-4 pb-14 pt-16 text-center sm:pt-20">
      <span className="inline-block rounded-full border border-[#f59e6b]/70 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#fcd3b6]">
        {badge}
      </span>
      <h1 className="mx-auto mt-5 max-w-4xl text-[clamp(2.4rem,7vw,4.6rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.03em]">
        {before}{" "}
        <span className="bg-gradient-to-r from-[#f9a8d4] via-[#fde1c8] to-[#e9d5ff] bg-clip-text text-transparent [filter:drop-shadow(0_0_18px_rgb(249_168_212/0.45))]">
          {accent}
        </span>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-snug text-white/60">{lead}</p>
      {children}
    </section>
  );
}

/** "What to borrow" / "When to use" note under a card */
export function Note({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl bg-black/25 px-3.5 py-3 ring-1 ring-white/5">
      <p className="text-xs text-[#f9a8d4]/80">{label}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-white/80">{children}</p>
    </div>
  );
}
