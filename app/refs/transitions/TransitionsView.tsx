"use client";

import Link from "next/link";
import { Hero, Note, RefsHeader, pick, useLang } from "../i18n";
import { DEMOS } from "./Demos";
import { SOURCES, TRANSITIONS, type Transition, type TransitionText } from "./transitions";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const TOTAL = TRANSITIONS.length;

const UI = {
  ru: {
    badge: `Переходы · ${TOTAL} приёмов`,
    before: "Переходы",
    accent: "из моушна",
    lead: "Приёмы из After Effects, пересобранные на CSS. Рядом с каждым — кадр-оригинал и как сделать то же в вебе.",
    back: "← Все референсы",
    demo: "Демо на CSS",
    frame: "Кадр из рилса",
    web: "Как собрать в вебе",
    lab: "Для лабы",
    sources: "Источники",
    shot: "Кадр из рилса:",
  },
  en: {
    badge: `Transitions · ${TOTAL} moves`,
    before: "Motion",
    accent: "transitions",
    lead: "After Effects moves rebuilt in CSS. Each comes with the original frame and how to do the same on the web.",
    back: "← All references",
    demo: "CSS demo",
    frame: "Reel frame",
    web: "How to build it on the web",
    lab: "For the lab",
    sources: "Sources",
    shot: "Reel frame:",
  },
};

/** Dark tile that holds a demo or a frame, like a project card */
function Frame({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <figure>
      <div className="rounded-2xl bg-[#1b1b1b] p-3 ring-1 ring-white/5">{children}</div>
      <figcaption className="mt-2 text-xs text-white/40">{caption}</figcaption>
    </figure>
  );
}

function Text({ item, index }: { item: Transition; index: number }) {
  const { lang } = useLang();
  const t = UI[lang];
  const text = pick<TransitionText>(lang, item, item.en);
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/80">
          {String(index).padStart(2, "0")}
        </span>
        <h3 className="text-[22px] font-bold leading-tight">{text.name}</h3>
      </div>
      <p className="mt-1 text-xs uppercase tracking-wider text-white/35">
        {item.term} · {item.block}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-white/60">{text.how}</p>
      <Note label={t.web}>{text.web}</Note>
      {text.lab && <Note label={t.lab}>{text.lab}</Note>}
    </div>
  );
}

export function TransitionsView() {
  const { lang } = useLang();
  const t = UI[lang];

  return (
    <>
      <RefsHeader />
      <Hero badge={t.badge} before={t.before} accent={t.accent} lead={t.lead}>
        <Link
          href="/refs"
          className="mt-9 inline-block rounded-full bg-white/5 px-7 py-3 text-[15px] font-medium text-white/80 ring-1 ring-white/10 transition hover:bg-white/10"
        >
          {t.back}
        </Link>
      </Hero>

      <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        {TRANSITIONS.map((item, i) => {
          const Demo = DEMOS[item.id];
          const name = pick<TransitionText>(lang, item, item.en).name;
          return (
            <article
              key={item.id}
              className="grid gap-6 border-t border-white/10 py-12 first:border-t-0 first:pt-0 lg:grid-cols-[1fr_1fr_0.9fr] lg:gap-8"
            >
              <Frame caption={t.demo}>
                <Demo />
              </Frame>
              <Frame caption={t.frame}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static export, plain webp frames */}
                <img
                  src={`${BASE_PATH}/refs/transitions/${item.frame}.webp`}
                  alt={`${t.shot} ${name}`}
                  loading="lazy"
                  className="aspect-[16/10] w-full rounded-[3px] object-cover"
                />
              </Frame>
              <Text item={item} index={i + 1} />
            </article>
          );
        })}

        <footer className="mt-8 border-t border-white/10 pt-8">
          <p className="text-xs text-white/40">{t.sources}</p>
          <ul className="mt-4 space-y-2 text-[15px] text-white/70">
            {SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-[#f9a8d4]">
                  {pick(lang, s.label, s.labelEn)} ↗
                </a>
              </li>
            ))}
          </ul>
        </footer>
      </main>
    </>
  );
}
