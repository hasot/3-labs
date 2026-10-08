"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { READY_SHADER_CATEGORIES, READY_SHADER_COLLECTION_COUNT, VISIBLE_READY_SHADERS, type ReadyShader } from "@/vendor/threeui/catalog";
import { Hero, RefsHeader, Tabs, useLang } from "../i18n";
import { categoryLabel } from "./shared";

const TOTAL = VISIBLE_READY_SHADERS.length;
const CATEGORIES = READY_SHADER_CATEGORIES.filter((c) => VISIBLE_READY_SHADERS.some((s) => s.category === c));

const UI = {
  ru: {
    badge: `ThreeUI · ${TOTAL} компонентов · ${READY_SHADER_COLLECTION_COUNT} вариантов`,
    before: "Реализации",
    accent: "ThreeUI",
    lead: "Весь бесплатный каталог MengTo/threeui внутри лабы: сцены на Three.js, WebGL-фоны, кнопки и текстовые эффекты. Каждый открывается вживую, с вариантами и настройками.",
    all: "Все",
    search: "Поиск: globe, button, particles…",
    variants: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "вариант" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "варианта" : "вариантов"}`,
    empty: "Ничего не нашлось.",
    source: "Исходники лежат в vendor/threeui, MIT.",
  },
  en: {
    badge: `ThreeUI · ${TOTAL} components · ${READY_SHADER_COLLECTION_COUNT} variants`,
    before: "ThreeUI",
    accent: "implementations",
    lead: "The whole free MengTo/threeui catalog inside the lab: Three.js scenes, WebGL backgrounds, buttons and text effects. Each one opens live, with its variants and controls.",
    all: "All",
    search: "Search: globe, button, particles…",
    variants: (n: number) => `${n} variant${n === 1 ? "" : "s"}`,
    empty: "Nothing found.",
    source: "Sources live in vendor/threeui, MIT.",
  },
};

function matches(shader: ReadyShader, query: string) {
  if (!query) return true;
  const haystack = [shader.label, shader.description, shader.category, ...shader.tags, ...(shader.variants?.map((v) => v.label) ?? [])]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

function Card({ shader, index }: { shader: ReadyShader; index: number }) {
  const { lang } = useLang();
  const t = UI[lang];
  const preview = shader.preview ?? shader.variants?.[0]?.preview;
  const count = shader.variants?.length ?? 0;

  return (
    <Link href={`/refs/threeui/${shader.id}`} className="group flex flex-col">
      <div
        className="relative aspect-video overflow-hidden rounded-2xl bg-[#1b1b1b] ring-1 ring-white/5 transition group-hover:ring-white/25"
        onMouseEnter={(e) => e.currentTarget.querySelector("video")?.play().catch(() => {})}
        onMouseLeave={(e) => {
          const video = e.currentTarget.querySelector("video");
          if (video) {
            video.pause();
            video.currentTime = 0;
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote catalog thumbnails from threeui.com */}
        <img src={shader.thumbnail} alt={shader.label} loading="lazy" className="h-full w-full object-cover" />
        {preview && (
          <video
            src={preview}
            muted
            loop
            playsInline
            preload="none"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold text-white/80 backdrop-blur">
          {String(index).padStart(3, "0")}
        </span>
        {count > 1 && (
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold text-white/80 backdrop-blur">
            {t.variants(count)}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[18px] font-bold leading-tight group-hover:text-[#f9a8d4]">{shader.label}</h3>
        <span className="shrink-0 text-xs text-white/40">{categoryLabel(lang, shader.category)}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-white/55">{shader.description}</p>
      <p className="mt-2 truncate text-xs text-white/35">{shader.runtime}</p>
    </Link>
  );
}

export function ThreeUIView() {
  const { lang } = useLang();
  const t = UI[lang];
  const [tab, setTab] = useState<string>("all");
  const [query, setQuery] = useState("");

  const items = useMemo(
    () => VISIBLE_READY_SHADERS.filter((s) => (tab === "all" || s.category === tab) && matches(s, query.trim())),
    [tab, query],
  );

  return (
    <>
      <RefsHeader />
      <Hero badge={t.badge} before={t.before} accent={t.accent} lead={t.lead} />

      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <Tabs
          items={[{ id: "all", label: t.all }, ...CATEGORIES.map((c) => ({ id: c as string, label: categoryLabel(lang, c) }))]}
          value={tab}
          onChange={setTab}
        />

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          className="-mt-4 mb-10 w-full rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-[15px] text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none sm:max-w-md"
        />

        {items.length === 0 ? (
          <p className="text-white/50">{t.empty}</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((shader) => (
              <Card key={shader.id} shader={shader} index={VISIBLE_READY_SHADERS.indexOf(shader) + 1} />
            ))}
          </div>
        )}

        <p className="mt-20 text-center text-sm text-white/35">
          {t.source}{" "}
          <a href="https://github.com/MengTo/threeui" target="_blank" rel="noreferrer" className="underline hover:text-white">
            github.com/MengTo/threeui ↗
          </a>
        </p>
      </main>
    </>
  );
}
