"use client";

import Link from "next/link";
import { Suspense, useRef, useState, useSyncExternalStore } from "react";
import { READY_SHADERS, VISIBLE_READY_SHADERS, type ShaderControl } from "@/vendor/threeui/catalog";
import { RefsHeader, useLang } from "../i18n";
import { categoryLabel, localSourcePath } from "./shared";

type Settings = Record<string, number | string>;

const NO_CONTROLS: readonly ShaderControl[] = [];

// ThreeUI renderers were written for a client-only Vite app: never server-render them
const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

const UI = {
  ru: {
    back: "← Все реализации",
    variants: "Варианты",
    controls: "Настройки",
    reset: "Сбросить",
    restart: "Перезапустить",
    fullscreen: "На весь экран",
    loading: "Загружаю рендер…",
    about: "Как устроено",
    runtime: "Рантайм",
    passes: "Проходы",
    interaction: "Взаимодействие",
    asset: "Ассеты",
    usage: "Импорт",
    files: "Файлы в репозитории",
    props: "Пропсы",
    prev: "← Предыдущий",
    next: "Следующий →",
  },
  en: {
    back: "← All implementations",
    variants: "Variants",
    controls: "Controls",
    reset: "Reset",
    restart: "Restart",
    fullscreen: "Fullscreen",
    loading: "Loading renderer…",
    about: "How it works",
    runtime: "Runtime",
    passes: "Passes",
    interaction: "Interaction",
    asset: "Assets",
    usage: "Import",
    files: "Files in this repo",
    props: "Props",
    prev: "← Previous",
    next: "Next →",
  },
};

const defaults = (controls: readonly ShaderControl[]): Settings => Object.fromEntries(controls.map((c) => [c.key, c.default]));

function Control({ control, value, onChange }: { control: ShaderControl; value: number | string; onChange: (v: number | string) => void }) {
  const label = <span className="text-[13px] text-white/60">{control.label}</span>;

  if (control.kind === "color") {
    return (
      <label className="flex items-center justify-between gap-3">
        {label}
        <span className="flex items-center gap-2 font-mono text-[12px] text-white/80">
          {String(value)}
          <input type="color" value={String(value)} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded bg-transparent" />
        </span>
      </label>
    );
  }

  if (control.kind === "text") {
    return (
      <label className="block">
        {label}
        <input
          type="text"
          value={String(value)}
          maxLength={control.maxLength}
          placeholder={control.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[14px] text-white focus:border-white/30 focus:outline-none"
        />
      </label>
    );
  }

  if (control.kind === "choice" || control.kind === "checkpoint") {
    return (
      <div>
        {label}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {control.options.map((o) => (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium ring-1 transition ${
                value === o.value ? "bg-white text-black ring-white" : "text-white/70 ring-white/15 hover:text-white hover:ring-white/30"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // range
  const n = Number(value);
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        {label}
        <span className="font-mono text-[12px] text-white/80">{n.toFixed(control.digits)}</span>
      </span>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={n}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[#f9a8d4]"
      />
    </label>
  );
}

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-4 border-t border-white/5 py-3 text-[14px]">
      <dt className="text-white/45">{name}</dt>
      <dd className="text-white/80">{children}</dd>
    </div>
  );
}

export function ThreeUIDetail({ id }: { id: string }) {
  const { lang } = useLang();
  const t = UI[lang];
  const index = VISIBLE_READY_SHADERS.findIndex((s) => s.id === id);
  const shader = VISIBLE_READY_SHADERS[index];
  const previous = VISIBLE_READY_SHADERS[index - 1];
  const next = VISIBLE_READY_SHADERS[index + 1];

  const [variantId, setVariantId] = useState(shader.variants?.[0]?.id);
  const [settingsByKey, setSettingsByKey] = useState<Record<string, Settings>>({});
  const [restartKey, setRestartKey] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();

  // Same resolution as ThreeUI's ShaderDocumentation: a variant may carry its own controls
  const variant = shader.variants?.find((v) => v.id === variantId) ?? shader.variants?.[0];
  const variantShader = variant ? READY_SHADERS.find((s) => s.id === variant.id) : undefined;
  const controls = variant?.controls ?? variantShader?.controls ?? shader.controls ?? NO_CONTROLS;
  const settingsKey = `${shader.id}:${variant?.id ?? "default"}`;
  const settings = settingsByKey[settingsKey] ?? defaults(controls);
  const setSetting = (key: string, value: number | string) =>
    setSettingsByKey((all) => ({ ...all, [settingsKey]: { ...settings, [key]: value } }));

  const Preview = shader.component!;
  const tall = shader.category === "Landing Pages" || shader.category === "Hero";
  const previewKey = `${shader.id}-${variant?.id ?? "default"}-${restartKey}`;

  return (
    <>
      <RefsHeader />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">
        <Link href="/refs/threeui" className="text-[14px] text-white/50 hover:text-white">
          {t.back}
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-[#fcd3b6]">{categoryLabel(lang, shader.category)}</p>
            <h1 className="mt-1 text-[clamp(2rem,5vw,3.2rem)] font-extrabold leading-none tracking-[-0.02em]">{shader.label}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRestartKey((k) => k + 1)}
              className="rounded-full px-4 py-2 text-[13px] font-medium text-white/75 ring-1 ring-white/15 hover:text-white hover:ring-white/30"
            >
              ↻ {t.restart}
            </button>
            <button
              onClick={() => stageRef.current?.requestFullscreen().catch(() => {})}
              className="rounded-full px-4 py-2 text-[13px] font-medium text-white/75 ring-1 ring-white/15 hover:text-white hover:ring-white/30"
            >
              ⤢ {t.fullscreen}
            </button>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-white/60">{variant?.description ?? shader.description}</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div ref={stageRef} className={`shader-preview ${shader.id}${tall ? " tall-page-preview" : ""}`} data-variant={variant?.id}>
            <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-white/40">{t.loading}</div>}>
              {mounted && <Preview key={previewKey} {...variant?.props} {...settings} />}
            </Suspense>
          </div>

          <aside className="flex flex-col gap-6">
            {shader.variants && shader.variants.length > 1 && (
              <section>
                <h2 className="text-[13px] font-semibold uppercase tracking-wider text-white/45">
                  {t.variants} · {shader.variants.length}
                </h2>
                <div className="mt-3 grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {shader.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVariantId(v.id)}
                      title={v.description}
                      className={`overflow-hidden rounded-xl text-left ring-1 transition ${
                        v.id === variant?.id ? "ring-2 ring-[#f9a8d4]" : "ring-white/10 hover:ring-white/30"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- remote catalog thumbnails */}
                      <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                      <span className="block truncate px-2 py-1.5 text-[12px] text-white/80">{v.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {controls.length > 0 && (
              <section className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wider text-white/45">{t.controls}</h2>
                  <button
                    onClick={() => setSettingsByKey((all) => ({ ...all, [settingsKey]: defaults(controls) }))}
                    className="text-[12px] text-white/45 hover:text-white"
                  >
                    {t.reset}
                  </button>
                </div>
                <div className="mt-4 flex flex-col gap-4">
                  {controls.map((c) => (
                    <Control key={c.key} control={c} value={settings[c.key] ?? c.default} onChange={(v) => setSetting(c.key, v)} />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>

        <section className="mt-14 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-[22px] font-bold">{t.about}</h2>
            <dl className="mt-4">
              <Row name={t.runtime}>{shader.runtime}</Row>
              <Row name={t.passes}>{shader.passes}</Row>
              <Row name={t.interaction}>{shader.interaction}</Row>
              <Row name={t.asset}>{shader.asset}</Row>
              <Row name={t.usage}>
                <code className="font-mono text-[13px] text-[#f9a8d4]">{`<${shader.importName} />`}</code>
              </Row>
            </dl>
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {shader.tags.map((tag) => (
                <li key={tag} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/60 ring-1 ring-white/10">
                  {tag}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-[22px] font-bold">{t.files}</h2>
            <ul className="mt-4 space-y-1.5">
              {shader.sourceFiles.map((file) => (
                <li key={file} className="break-all font-mono text-[12.5px] text-white/65">
                  {localSourcePath(file)}
                </li>
              ))}
            </ul>

            {shader.contract.length > 0 && (
              <>
                <h2 className="mt-10 text-[22px] font-bold">{t.props}</h2>
                <table className="mt-4 w-full text-left text-[13px]">
                  <tbody>
                    {shader.contract.map((row) => (
                      <tr key={row.name} className="border-t border-white/5 align-top">
                        <td className="py-2 pr-3 font-mono text-[#f9a8d4]">{row.name}</td>
                        <td className="py-2 pr-3 font-mono text-white/45">{row.type}</td>
                        <td className="py-2 text-white/70">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </section>

        <nav className="mt-16 flex justify-between border-t border-white/10 pt-6 text-[15px]">
          {previous ? (
            <Link href={`/refs/threeui/${previous.id}`} className="text-white/60 hover:text-white">
              {t.prev} <span className="text-white">{previous.label}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/refs/threeui/${next.id}`} className="text-right text-white/60 hover:text-white">
              <span className="text-white">{next.label}</span> {t.next}
            </Link>
          )}
        </nav>
      </main>
    </>
  );
}
