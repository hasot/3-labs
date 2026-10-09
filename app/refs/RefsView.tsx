"use client";

import Link from "next/link";
import { useState } from "react";
import { Hero, Note, RefsHeader, Tabs, pick, useLang } from "./i18n";
import { REF_GROUPS, type Ref } from "./refs";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const TOTAL = REF_GROUPS.reduce((sum, group) => sum + group.refs.length, 0);

const UI = {
  ru: {
    badge: `Референсы · ${TOTAL} ссылок`,
    before: "Референсы",
    accent: "для лабы",
    lead: "Архивы странной графики, галереи и инструменты. У каждой ссылки — что это и что из неё брать.",
    all: "Все",
    compositions: "Композиции первых экранов →",
    transitions: "Переходы →",
    threeui: "Реализации ThreeUI →",
    borrow: "Что брать",
    shot: "Скриншот",
  },
  en: {
    badge: `References · ${TOTAL} links`,
    before: "References",
    accent: "for the lab",
    lead: "Archives of strange graphics, galleries and tools. Each link comes with what it is and what to borrow from it.",
    all: "All",
    compositions: "Hero compositions →",
    transitions: "Transitions →",
    threeui: "ThreeUI implementations →",
    borrow: "What to borrow",
    shot: "Screenshot of",
  },
};

function domain(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

function RefCard({ item, index }: { item: Ref; index: number }) {
  const { lang } = useLang();
  const t = UI[lang];
  const text = pick(lang, item, item.en);
  return (
    <article className="group flex flex-col">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="relative block aspect-[16/10] overflow-hidden rounded-2xl bg-[#1b1b1b] ring-1 ring-white/5 transition hover:ring-white/25"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain webp thumbnails */}
        <img
          src={`${BASE_PATH}/refs/${item.image}.webp`}
          alt={`${t.shot} ${item.name}`}
          loading="lazy"
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold text-white/80 backdrop-blur">
          {String(index).padStart(3, "0")}
        </span>
      </a>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[18px] font-bold leading-tight">
          <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-[#f9a8d4]">
            {item.name}
          </a>
        </h3>
        <span className="shrink-0 truncate text-xs text-white/40">{domain(item.url)} ↗</span>
      </div>

      <ul className="mt-2 flex flex-wrap gap-1.5">
        {text.meta.map((m) => (
          <li key={m} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/65 ring-1 ring-white/10">
            {m}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[14px] leading-relaxed text-white/60">{text.description}</p>
      <Note label={t.borrow}>{text.takeaway}</Note>
    </article>
  );
}

export function RefsView() {
  const { lang } = useLang();
  const t = UI[lang];
  const [tab, setTab] = useState("all");
  const groups = REF_GROUPS.filter((g) => tab === "all" || g.id === tab);

  return (
    <>
      <RefsHeader />
      <Hero badge={t.badge} before={t.before} accent={t.accent} lead={t.lead}>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            href="/refs/compositions"
            className="inline-block rounded-full bg-gradient-to-b from-white to-[#dcd6ff] px-8 py-3.5 text-lg font-semibold text-[#141414] shadow-[0_0_40px_rgb(220_214_255/0.25)] transition hover:scale-[1.03]"
          >
            {t.compositions}
          </Link>
          <Link
            href="/refs/transitions"
            className="inline-block rounded-full px-8 py-3.5 text-lg font-semibold text-white ring-1 ring-white/25 transition hover:scale-[1.03] hover:ring-white/50"
          >
            {t.transitions}
          </Link>
          <Link
            href="/refs/threeui"
            className="inline-block rounded-full px-8 py-3.5 text-lg font-semibold text-white ring-1 ring-white/25 transition hover:scale-[1.03] hover:ring-white/50"
          >
            {t.threeui}
          </Link>
        </div>
      </Hero>

      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <Tabs
          items={[{ id: "all", label: t.all }, ...REF_GROUPS.map((g) => ({ id: g.id, label: pick(lang, g, g.en).title }))]}
          value={tab}
          onChange={setTab}
        />

        {groups.map((group) => {
          // Numbering runs through all groups: 001, 002, …
          const offset = REF_GROUPS.slice(0, REF_GROUPS.indexOf(group)).reduce((sum, g) => sum + g.refs.length, 0);
          const head = pick(lang, group, group.en);
          return (
            <section key={group.id} className="mb-16">
              <h2 className="text-[26px] font-bold leading-tight">{head.title}</h2>
              <p className="mt-1 max-w-2xl text-[15px] text-white/55">{head.note}</p>
              <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {group.refs.map((item, j) => (
                  <RefCard key={item.id} item={item} index={offset + j + 1} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
