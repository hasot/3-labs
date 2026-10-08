"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CATEGORIES, PROJECTS, type Project } from "./projects";
import { buildPrompt, downloadList, liveUrl, SOURCE_BASE } from "./prompt";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const QUERY_KEY = "project";
const SOON = "Unlimited is coming soon — prompts unlock here.";
// No paywall yet: Unlock copies the prompt so it can be tried in Claude Code
const COPIED = "Prompt copied — paste it into Claude Code in an empty folder.";
// Lines of the prompt shown above the lock
const PREVIEW_LINES = 14;

// Looping silent recordings of each page, made by scripts/record_previews.py
const videoUrl = (slug: string) => `${BASE_PATH}/previews/${slug}.mp4`;
const posterUrl = (slug: string) => `${BASE_PATH}/previews/${slug}.jpg`;

// Runs a state change as a view transition, so the card morphs into the viewer
function morph(update: () => void) {
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    flushSync(update);
    return;
  }
  const transition = document.startViewTransition(() => flushSync(update));
  // A transition interrupted by the next click rejects; nothing to handle
  transition.ready.catch(() => {});
}

function slugFromUrl() {
  const slug = new URLSearchParams(window.location.search).get(QUERY_KEY);
  return PROJECTS.some((p) => p.slug === slug) ? slug : null;
}

function LockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x={4} y={11} width={16} height={10} rx={2} />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7z" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M12 21s-7.5-4.6-9.5-9.3C1.2 8.4 3.3 5 6.8 5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.5 0 5.6 3.4 4.3 6.7C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[26px] font-bold tracking-tight">
      <svg viewBox="0 0 32 24" className="h-6 w-8">
        <defs>
          <linearGradient id="logo-grad" x1="0" x2="1">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#f9a8d4" />
          </linearGradient>
        </defs>
        <path d="M3 22L9 2M12 22L18 2M21 22L27 2" stroke="url(#logo-grad)" strokeWidth={5} strokeLinecap="round" />
      </svg>
      3labs
    </Link>
  );
}

function Header({ onSoon }: { onSoon: () => void }) {
  return (
    <header className="flex items-center justify-between px-4 py-4 sm:px-6">
      <div className="flex items-center gap-10">
        <Logo />
        <nav className="hidden items-center gap-10 text-[15px] font-medium text-white/70 lg:flex">
          <span className="flex items-center gap-2 text-white">
            Projects
            <span className="rounded-full border border-white/40 px-1.5 text-[9px] font-bold italic leading-[14px]">NEW</span>
          </span>
          <Link href="/" className="hover:text-white">
            Lab
          </Link>
          <Link href="/refs" className="hover:text-white">
            References
          </Link>
          <a href="https://github.com/hasot/3-labs" target="_blank" rel="noreferrer" className="hover:text-white">
            GitHub
          </a>
        </nav>
      </div>
      <button onClick={onSoon} className="rounded-full bg-white px-5 py-2 text-[15px] font-semibold text-black transition hover:bg-white/85">
        Get access
      </button>
    </header>
  );
}

function Hero({ onSoon }: { onSoon: () => void }) {
  return (
    <section className="px-4 pb-14 pt-16 text-center sm:pt-20">
      <span className="inline-block rounded-full border border-[#f59e6b]/70 px-3 py-0.5 text-[11px] font-semibold tracking-wider text-[#fcd3b6]">
        IN PROGRESS · {PROJECTS.length} PROJECTS
      </span>
      <h1 className="mx-auto mt-5 max-w-4xl text-[clamp(2.4rem,7vw,4.6rem)] font-extrabold uppercase leading-[0.92] tracking-[-0.03em]">
        Heroes I&apos;m <span className="italic">building</span>
        <br />
        right{" "}
        <span className="bg-gradient-to-r from-[#f9a8d4] via-[#fde1c8] to-[#e9d5ff] bg-clip-text text-transparent [filter:drop-shadow(0_0_18px_rgb(249_168_212/0.45))]">
          now
        </span>
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg leading-snug text-white/60">
        Interactive landing pages from my lab. Open one to see it in motion — and grab the step-by-step prompt to rebuild it with an AI agent.
      </p>
      <button
        onClick={onSoon}
        className="mt-9 rounded-full bg-gradient-to-b from-white to-[#dcd6ff] px-8 py-3.5 text-lg font-semibold text-[#141414] shadow-[0_0_40px_rgb(220_214_255/0.25)] transition hover:scale-[1.03]"
      >
        Unlock all prompts →
      </button>
    </section>
  );
}

function Filters({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1 [scrollbar-width:none]">
      {CATEGORIES.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`shrink-0 rounded-full px-5 py-2 text-[15px] font-medium transition ${
            value === c ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: Project["status"] }) {
  const tone = status === "New" ? "bg-[#f9a8d4] text-black" : status === "WIP" ? "bg-black/60 text-white/80" : "bg-white text-black";
  return <span className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>{status}</span>;
}

// Recorded preview: a visitor playing with the page, on a seamless loop. It only
// downloads and plays while near the viewport, so a long grid stays light
function PreviewVideo({ project, eager = false }: { project: Project; eager?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const view = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { rootMargin: "200px 0px" },
    );
    view.observe(video);
    return () => view.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={videoUrl(project.slug)}
      poster={posterUrl(project.slug)}
      muted
      loop
      playsInline
      preload={eager ? "auto" : "none"}
      aria-hidden
      className="absolute inset-0 h-full w-full bg-[#1b1b1b] object-cover"
    />
  );
}

function Card({ project, onOpen, isOpen }: { project: Project; onOpen: () => void; isOpen: boolean }) {
  return (
    <article className="group">
      <button
        onClick={onOpen}
        // While the viewer is open it carries this name, so the card morphs into it
        style={isOpen ? undefined : { viewTransitionName: `preview-${project.slug}` }}
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-2xl ring-1 ring-white/5 transition hover:ring-white/25"
        aria-label={`Open ${project.title}`}
      >
        <PreviewVideo project={project} />
        <StatusBadge status={project.status} />
        <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">Open project</span>
        </span>
      </button>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-bold leading-tight">{project.title}</h3>
          <p className="mt-0.5 text-sm text-white/55">{project.category}</p>
        </div>
        <span className="mt-1 text-white/70" title="Prompt locked">
          <CrownIcon />
        </span>
      </div>
    </article>
  );
}

// Every file the prompt downloads, as links, so it's clear where the content comes from
function Sources({ project }: { project: Project }) {
  const files = downloadList(project);
  const name = (path: string) => path.split("/").pop();
  return (
    <ul className="mt-3 divide-y divide-white/5 overflow-hidden rounded-xl bg-black/25 ring-1 ring-white/5">
      {files.map((path) => (
        <li key={path}>
          <a
            href={`${SOURCE_BASE}/${path}`}
            target="_blank"
            rel="noreferrer"
            title={`${SOURCE_BASE}/${path}`}
            className="flex items-center justify-between gap-3 px-3.5 py-2 text-[12px] hover:bg-white/5"
          >
            <span className="truncate font-mono text-white/75">{name(path)}</span>
            <span className="shrink-0 truncate font-mono text-white/35">{path.slice(0, path.lastIndexOf("/"))}</span>
          </a>
        </li>
      ))}
      {project.frames && (
        <li>
          <a
            href={`${SOURCE_BASE}/${project.frames.dir}/001.webp`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 px-3.5 py-2 text-[12px] hover:bg-white/5"
          >
            <span className="font-mono text-white/75">001…{String(project.frames.count).padStart(3, "0")}.webp</span>
            <span className="shrink-0 font-mono text-white/35">{project.frames.dir}</span>
          </a>
        </li>
      )}
    </ul>
  );
}

function LockedPrompt({ prompt, onUnlock }: { prompt: string; onUnlock: () => void }) {
  const lines = prompt.split("\n");
  const head = lines.slice(0, PREVIEW_LINES).join("\n");
  const tail = lines.slice(PREVIEW_LINES, PREVIEW_LINES + 24).join("\n");
  const pre = "whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-white/70";
  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-black/25 ring-1 ring-white/5">
      <pre className={`${pre} px-4 pt-4`}>{head}</pre>
      {/* Placeholder lock: the text is only blurred, a real paywall must not ship it to the client */}
      <div className="relative">
        <pre className={`${pre} pointer-events-none select-none px-4 pb-4 blur-[5px]`} aria-hidden>
          {tail}
        </pre>
        <div className="absolute inset-0 flex items-start justify-center bg-gradient-to-b from-[#1a1a1a]/20 to-[#1a1a1a] pt-8">
          <div className="mx-3 rounded-2xl bg-[#161616]/95 p-5 text-center shadow-2xl ring-1 ring-white/10">
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white/10">
              <LockIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold">{lines.length - PREVIEW_LINES} more lines locked</p>
            <p className="mt-1 text-[13px] text-white/55">Download commands for every file, run steps and a final checklist.</p>
            <button onClick={onUnlock} className="mt-4 w-full rounded-full bg-white py-2 text-sm font-semibold text-black hover:bg-white/85">
              Unlock prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const HOW_TO = [
  "Unlock the prompt and copy it in one click.",
  "Create an empty folder and open it in Claude Code, Cursor or Codex.",
  "Paste the whole prompt as one message and send it.",
  "The agent creates the project, downloads every file listed below and starts the site — then checks it against the live page.",
];

function PromptDrawer({ project, onClose, onUnlock }: { project: Project; onClose: () => void; onUnlock: (prompt: string) => void }) {
  const [liked, setLiked] = useState(false);
  const prompt = useMemo(() => buildPrompt(project), [project]);
  const fileCount = downloadList(project).length + (project.frames?.count ?? 0);
  // Stagger the drawer's blocks as it slides in
  const step = (i: number) => ({ animationDelay: `${180 + i * 60}ms` });

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="panel-in flex items-start justify-between gap-4" style={step(0)}>
        <div>
          <h2 className="text-[22px] font-bold leading-tight">{project.title}</h2>
          <p className="mt-1 text-[15px] text-white/55">{project.category}</p>
        </div>
        <button onClick={onClose} aria-label="Hide prompt" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-4 w-4">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <button
        onClick={() => setLiked((v) => !v)}
        className={`panel-in mt-4 flex items-center gap-2 text-[15px] ${liked ? "text-[#f9a8d4]" : "text-white/70 hover:text-white"}`}
        style={step(1)}
      >
        <HeartIcon filled={liked} />
        {project.likes + (liked ? 1 : 0)} likes
      </button>

      <div className="panel-in mt-5 space-y-2.5" style={step(2)}>
        <button
          onClick={() => onUnlock(prompt)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-[15px] font-semibold text-black transition hover:bg-white/85"
        >
          <LockIcon />
          Unlock full prompt
        </button>
        <a
          href={liveUrl(project.slug)}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white/5 py-3 text-[15px] font-medium text-white/80 ring-1 ring-white/10 transition hover:bg-white/10"
        >
          Open live page ↗
        </a>
      </div>

      <section className="panel-in mt-7" style={step(3)}>
        <p className="text-xs text-white/40">About</p>
        <p className="mt-2 text-[14px] leading-relaxed text-white/75">{project.summary}</p>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {project.stack.map((s) => (
            <li key={s} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/65 ring-1 ring-white/10">
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-in mt-7" style={step(4)}>
        <p className="text-xs text-white/40">How to use the prompt</p>
        <ol className="mt-3 space-y-2.5">
          {HOW_TO.map((line, i) => (
            <li key={line} className="flex gap-3 text-[13px] leading-relaxed text-white/70">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-white">{i + 1}</span>
              {line}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel-in mt-7" style={step(5)}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-white/40">Where the files come from</p>
          <p className="text-xs text-white/40">{fileCount} files</p>
        </div>
        <p className="mt-2 break-all font-mono text-[11px] text-white/45">{SOURCE_BASE}</p>
        <Sources project={project} />
        {project.packages && <p className="mt-2 font-mono text-[11px] text-white/45">npm install {project.packages.join(" ")}</p>}
      </section>

      <section className="panel-in mt-7" style={step(6)}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40">Prompt</p>
          <p className="flex items-center gap-1.5 text-xs text-white/40">
            <LockIcon className="h-3 w-3" />
            {project.prompt.length} steps · {prompt.split("\n").length} lines
          </p>
        </div>
        <LockedPrompt prompt={prompt} onUnlock={() => onUnlock(prompt)} />
      </section>
    </div>
  );
}

// Full-screen project: the live page on the left, the prompt drawer sliding out on the right
function Viewer({ project, onClose, onUnlock }: { project: Project; onClose: () => void; onUnlock: (prompt: string) => void }) {
  const [drawer, setDrawer] = useState(true);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex gap-3 bg-[#141414] p-3">
      <div
        className="relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-[#1b1b1b] ring-1 ring-white/5"
        style={{ viewTransitionName: `preview-${project.slug}` }}
      >
        <PreviewVideo project={project} eager />
        <a
          href={liveUrl(project.slug)}
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 top-3 rounded-full bg-black/70 px-4 py-2 text-[13px] font-medium text-white backdrop-blur transition hover:bg-black"
        >
          Try it live ↗
        </a>
        <button
          onClick={onClose}
          aria-label="Back to all projects"
          className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white backdrop-blur transition hover:bg-black"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-5 w-5">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
        {!drawer && (
          <button
            onClick={() => setDrawer(true)}
            className="toast-in absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-2xl hover:bg-white/85"
          >
            <LockIcon />
            Prompt & instructions
          </button>
        )}
      </div>

      {drawer && (
        <aside className="drawer-in fixed inset-y-3 right-3 z-10 w-[min(400px,calc(100%-24px))] overflow-hidden rounded-2xl bg-[#202020] shadow-2xl ring-1 ring-white/10 md:static md:shrink-0">
          <PromptDrawer project={project} onClose={() => setDrawer(false)} onUnlock={onUnlock} />
        </aside>
      )}
    </div>
  );
}

export function ProjectsGallery() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);
  const showSoon = useCallback(() => notify(SOON), [notify]);
  const unlock = useCallback(
    (prompt: string) => {
      navigator.clipboard.writeText(prompt).then(
        () => notify(COPIED),
        () => notify("Couldn't reach the clipboard — try again."),
      );
    },
    [notify],
  );

  const open = useCallback((slug: string) => {
    morph(() => setOpenSlug(slug));
    window.history.pushState(null, "", `?${QUERY_KEY}=${slug}`);
  }, []);

  const close = useCallback(() => {
    morph(() => setOpenSlug(null));
    window.history.pushState(null, "", window.location.pathname);
  }, []);

  // Deep link on load, and back / forward between opened projects
  useEffect(() => {
    const sync = () => {
      const slug = slugFromUrl();
      morph(() => setOpenSlug(slug));
    };
    if (slugFromUrl()) sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    if (!openSlug) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSlug, close]);

  const opened = PROJECTS.find((p) => p.slug === openSlug);
  const visible = PROJECTS.filter((p) => category === "All" || p.category === category);

  return (
    <div className="min-h-screen bg-[#141414] font-sans text-white">
      <Header onSoon={showSoon} />
      <Hero onSoon={showSoon} />

      <main className="px-4 pb-24 sm:px-6">
        <Filters value={category} onChange={(c) => morph(() => setCategory(c))} />
        <div className="grid grid-cols-1 gap-x-3 gap-y-6 md:grid-cols-2 lg:grid-cols-4">
          {visible.map((p) => (
            <Card key={p.slug} project={p} isOpen={p.slug === openSlug} onOpen={() => open(p.slug)} />
          ))}
        </div>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-4 py-8 text-sm text-white/40 sm:px-6">
        <span>© {new Date().getFullYear()} 3labs · Dmitry Yunkov</span>
        <span>Previews are recordings of the live pages.</span>
      </footer>

      {opened && <Viewer key={opened.slug} project={opened} onClose={close} onUnlock={unlock} />}

      {toast && (
        <div className="toast-in fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
