"use client";

import Link from "next/link";
import { useState } from "react";
import { Hero, Note, RefsHeader, pick, useLang, type Lang } from "../i18n";
import { COMPOSITIONS, SOURCES, TONES, WIRE_EN, type Composition, type CompositionText, type Shape, type Site } from "./compositions";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const TOTAL = COMPOSITIONS.length;

const UI = {
  ru: {
    badge: `Композиции · ${TOTAL} схем`,
    before: "Композиции",
    accent: "первых экранов",
    lead: "Как расставлены блоки, когда такую раскладку брать и где она уже работает. Цветные плашки — не дизайн, а скелет.",
    back: "← Все референсы",
    lab: "В этой лабе",
    when: "Когда брать",
    example: "Пример",
    wire: "Схема",
    sources: "Источники",
    shot: "Скриншот",
    aria: "Схема композиции",
  },
  en: {
    badge: `Compositions · ${TOTAL} layouts`,
    before: "Hero",
    accent: "compositions",
    lead: "How the blocks are arranged, when to use the layout and where it already works. The pastel blocks are a skeleton, not a design.",
    back: "← All references",
    lab: "In this lab",
    when: "When to use",
    example: "Example",
    wire: "Wireframe",
    sources: "Sources",
    shot: "Screenshot of",
    aria: "Wireframe of",
  },
};

const LABEL = { fill: TONES.ink, fillOpacity: 0.7, textAnchor: "middle", dominantBaseline: "central" } as const;

const wireText = (lang: Lang, ru: string) => (lang === "en" ? (WIRE_EN[ru] ?? ru) : ru);

function ShapeView({ shape, lang }: { shape: Shape; lang: Lang }) {
  if ("rect" in shape) {
    const [x, y, w, h] = shape.rect;
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={shape.r ?? 1.5} fill={TONES[shape.fill]} />
        {shape.label && (
          <text x={x + w / 2} y={y + h / 2} fontSize={shape.size ?? 3.6} {...LABEL}>
            {wireText(lang, shape.label)}
          </text>
        )}
      </g>
    );
  }
  if ("path" in shape) {
    return (
      <g>
        <path
          d={shape.path}
          fill={shape.fill ? TONES[shape.fill] : "none"}
          stroke={shape.stroke ? TONES[shape.stroke] : undefined}
          strokeWidth={shape.width}
          strokeDasharray={shape.dash ? "3 2" : undefined}
          strokeLinecap="round"
        />
        {shape.label && shape.at && (
          <text x={shape.at[0]} y={shape.at[1]} fontSize={shape.size ?? 3.6} {...LABEL}>
            {wireText(lang, shape.label)}
          </text>
        )}
      </g>
    );
  }
  return (
    <text
      x={shape.at[0]}
      y={shape.at[1]}
      fontSize={shape.size ?? 3.6}
      {...LABEL}
      fill={TONES[shape.fill ?? "ink"]}
      fillOpacity={shape.fill ? 1 : 0.7}
      textAnchor={shape.start ? "start" : "middle"}
    >
      {wireText(lang, shape.text)}
    </text>
  );
}

function Wireframe({ item }: { item: Composition }) {
  const { lang } = useLang();
  const clip = `clip-${item.id}`;
  return (
    <svg
      viewBox="0 0 160 100"
      role="img"
      aria-label={`${UI[lang].aria} «${pick<Pick<CompositionText, "name" | "how" | "when">>(lang, item, item.en).name}»`}
      className="block w-full font-mono"
    >
      <defs>
        <clipPath id={clip}>
          <rect width="160" height="100" rx="3" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="160" height="100" fill="#fff" />
        {item.wire.map((shape, i) => (
          <ShapeView key={i} shape={shape} lang={lang} />
        ))}
      </g>
    </svg>
  );
}

/** Dark tile that holds a wireframe or a screenshot, like a project card */
function Frame({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <figure>
      <div className="rounded-2xl bg-[#1b1b1b] p-3 ring-1 ring-white/5">{children}</div>
      {caption && <figcaption className="mt-2 text-xs text-white/40">{caption}</figcaption>}
    </figure>
  );
}

function Text({ item, index }: { item: Composition; index: number }) {
  const { lang } = useLang();
  const t = UI[lang];
  const text = pick<Pick<CompositionText, "name" | "how" | "when">>(lang, item, item.en);
  const ex = item.example;
  const exLabel = ex && pick(lang, ex.label, item.en.example);
  const linkClass = "underline decoration-white/30 underline-offset-2 hover:text-[#f9a8d4]";
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/80">
          {String(index).padStart(2, "0")}
        </span>
        <h3 className="text-[22px] font-bold leading-tight">{text.name}</h3>
      </div>
      <p className="mt-1 text-xs uppercase tracking-wider text-white/35">{item.term}</p>
      <p className="mt-3 text-[15px] leading-relaxed text-white/60">{text.how}</p>
      <Note label={t.when}>{text.when}</Note>
      {ex && (
        <p className="mt-3 text-sm text-white/55">
          {t.lab}:{" "}
          <Link href={ex.url} className={linkClass}>
            {exLabel}
          </Link>
        </p>
      )}
    </div>
  );
}

/** One example at a time; pills under it switch between the sites */
function Examples({ sites }: { sites: Site[] }) {
  const { lang } = useLang();
  const [active, setActive] = useState(0);
  const site = sites[active];
  const host = site.url && new URL(site.url).hostname.replace(/^www\./, "");
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- static export, plain webp thumbnails
    <img
      src={`${BASE_PATH}/refs/compositions/sites/${site.image}.webp`}
      alt={`${UI[lang].shot} ${site.name}`}
      loading="lazy"
      className="aspect-[16/10] w-full rounded-[3px] object-cover object-top"
    />
  );
  return (
    <figure>
      <div className="rounded-2xl bg-[#1b1b1b] p-3 ring-1 ring-white/5 transition hover:ring-white/25">
        {site.url ? (
          <a href={site.url} target="_blank" rel="noreferrer" className="block">
            {image}
          </a>
        ) : (
          image
        )}
      </div>
      {sites.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
          {sites.map((s, i) => (
            <button
              key={s.image}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                i === active ? "bg-white text-black" : "bg-white/5 text-white/65 ring-1 ring-white/10 hover:text-white"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <figcaption className="mt-2 text-sm leading-relaxed text-white/55">
        <span className="font-semibold text-white/85">{site.name}</span>
        {host && (
          <a href={site.url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-white/40 hover:text-[#f9a8d4]">
            {host} ↗
          </a>
        )}
        <br />
        {pick(lang, site.note, site.noteEn)}
      </figcaption>
    </figure>
  );
}

export function CompositionsView() {
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
        {COMPOSITIONS.map((item, i) => (
          <article
            key={item.id}
            className="grid gap-6 border-t border-white/10 py-12 first:border-t-0 first:pt-0 lg:grid-cols-[1fr_1fr_0.9fr] lg:gap-8"
          >
            <Frame caption={t.wire}>
              <Wireframe item={item} />
            </Frame>
            {item.sites && <Examples sites={item.sites} />}
            <Text item={item} index={i + 1} />
          </article>
        ))}

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
