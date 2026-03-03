"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  createContext,
  useMemo,
  type KeyboardEvent,
} from "react";
import { codeToHtml } from "shiki";
import { toPng, toSvg } from "html-to-image";
import { type DiffResult, computeDiff } from "../lib/diff";
import { TrafficLights } from "./TrafficLights";
import { PanelLabel } from "./PanelLabel";
import { DiffRender } from "./DiffRender";
import { NormalRender } from "./NormalRender";

const LANGUAGES = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
] as const;

type Language = (typeof LANGUAGES)[number]["value"];

interface Gradient {
  name: string;
  css: string;
  dots?: boolean;
  transparent?: boolean;
  windowBg?: string;
  vercel?: boolean;
  light?: boolean;
}

const GRADIENTS: Gradient[] = [
  {
    name: "Void",
    css: "linear-gradient(145deg, #000000 0%, #0a0a0a 50%, #000000 100%)",
  },
  {
    name: "Vercel",
    css: "#000000",
    vercel: true,
    windowBg: "#000000",
  },
  {
    name: "Vercel Light",
    css: "#ffffff",
    vercel: true,
    windowBg: "#ffffff",
    light: true,
  },
  {
    name: "Midnight",
    css: "linear-gradient(145deg, #0a0a0a 0%, #1a1a2e 50%, #16162a 100%)",
  },
  {
    name: "Dots",
    css: "#111111",
    dots: true,
  },
  {
    name: "Charcoal",
    css: "linear-gradient(145deg, #1c1c1c 0%, #2d2d2d 50%, #1c1c1c 100%)",
  },
  {
    name: "Sunset",
    css: "linear-gradient(145deg, #b91c1c 0%, #dc2626 30%, #ea580c 60%, #f59e0b 100%)",
  },
  {
    name: "Ocean",
    css: "linear-gradient(145deg, #1e3a5f 0%, #0e7490 40%, #0d9488 70%, #10b981 100%)",
  },
  {
    name: "Snow",
    css: "linear-gradient(145deg, #ffffff 0%, #f9fafb 50%, #ffffff 100%)",
    light: true,
  },
  {
    name: "Transparent",
    css: "transparent",
    transparent: true,
    windowBg: "rgba(5, 5, 5, 0.95)",
  },
];

const DEFAULT_LEFT = `function getUser(id: string) {
  const response = fetch(\`/api/users/\${id}\`);
  const data = response.json();
  return data;
}`;

const DEFAULT_RIGHT = `async function getUser(
  id: string
): Promise<User> {
  const res = await fetch(\`/api/users/\${id}\`);
  if (!res.ok) throw new Error("Not found");
  return res.json() as Promise<User>;
}`;

const SHIKI_THEME_DARK = "github-dark";
const SHIKI_THEME_LIGHT = "github-light";

const FONTS = [
  {
    value: "geist",
    label: "Geist Mono",
    css: 'var(--font-geist-mono), ui-monospace, monospace',
  },
  {
    value: "roboto",
    label: "Roboto Mono",
    css: '"Roboto Mono", ui-monospace, monospace',
  },
  {
    value: "system",
    label: "System Mono",
    css: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  },
] as const;

type FontValue = (typeof FONTS)[number]["value"];

function loadAll(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("vs:")) {
      try { data[k.slice(3)] = JSON.parse(localStorage.getItem(k)!); } catch {}
    }
  }
  return data;
}

const StoreContext = createContext<Record<string, unknown>>({});

function usePersist<T>(key: string, fallback: T) {
  const store = useContext(StoreContext);
  const [value, setValue] = useState<T>(
    () => (key in store ? store[key] as T : fallback)
  );

  useEffect(() => {
    try {
      localStorage.setItem(`vs:${key}`, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}

export default function SplitViewShell() {
  const [store, setStore] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setStore(loadAll());
  }, []);

  if (store === null) return null;

  return (
    <StoreContext.Provider value={store}>
      <SplitView />
    </StoreContext.Provider>
  );
}

function SplitView() {
  const [leftCode, setLeftCode] = usePersist("leftCode", DEFAULT_LEFT);
  const [rightCode, setRightCode] = usePersist("rightCode", DEFAULT_RIGHT);
  const [leftLang, setLeftLang] = usePersist<Language>("leftLang", "typescript");
  const [rightLang, setRightLang] = usePersist<Language>("rightLang", "typescript");
  const [gradientIndex, setGradientIndex] = usePersist("gradientIndex", 0);
  const [leftLabel, setLeftLabel] = usePersist("leftLabel", "Before");
  const [rightLabel, setRightLabel] = usePersist("rightLabel", "After");
  const [leftHtml, setLeftHtml] = useState("");
  const [rightHtml, setRightHtml] = useState("");
  const [leftEditorHtml, setLeftEditorHtml] = useState("");
  const [rightEditorHtml, setRightEditorHtml] = useState("");
  const [exporting, setExporting] = useState(false);
  const [fontSize, setFontSize] = usePersist("fontSize", 14);
  const [padding, setPadding] = usePersist("padding", 24);
  const [margin, setMargin] = usePersist("margin", 52);
  const [layout, setLayout] = usePersist<"side" | "stack">("layout", "side");
  const [grayDots, setGrayDots] = usePersist("grayDots", false);
  const [fontValue, setFontValue] = usePersist<FontValue>("font", "geist");
  const [ligatures, setLigatures] = usePersist("ligatures", true);
  const [fontWeight, setFontWeight] = usePersist("fontWeight", 400);
  const [diffMode, setDiffMode] = usePersist("diffMode", false);
  const exportRef = useRef<HTMLDivElement>(null);
  const currentFont = FONTS.find((f) => f.value === fontValue) || FONTS[0];

  // Load Roboto Mono from Google Fonts when selected
  useEffect(() => {
    if (fontValue !== "roboto") return;
    const id = "roboto-mono-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;600&display=swap";
    document.head.appendChild(link);
  }, [fontValue]);

  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  const handleExportPng = useCallback(async (pixelRatio: number) => {
    if (!exportRef.current) return;
    setExporting(true);
    setExportOpen(false);
    try {
      const dataUrl = await toPng(exportRef.current, { pixelRatio });
      const link = document.createElement("a");
      link.download = `versus-tools-${pixelRatio}x.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleExportSvg = useCallback(async (transparentBg: boolean) => {
    if (!exportRef.current) return;
    setExporting(true);
    setExportOpen(false);
    try {
      const el = exportRef.current;
      const origBg = el.style.background;
      if (transparentBg) el.style.background = "transparent";
      const dataUrl = await toSvg(el);
      if (transparentBg) el.style.background = origBg;
      const link = document.createElement("a");
      link.download = `versus-tools${transparentBg ? "-transparent" : ""}.svg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, []);

  // Handle Tab key in textareas
  const handleKeyDown = (
    e: KeyboardEvent<HTMLTextAreaElement>,
    setter: (v: string) => void
  ) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      setter(newValue);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  const gradient = GRADIENTS[gradientIndex] || GRADIENTS[0];
  const isVercelLight = gradient.vercel && gradient.windowBg === "#ffffff";
  const shikiTheme = gradient.light ? SHIKI_THEME_LIGHT : SHIKI_THEME_DARK;

  // Highlight code with shiki
  useEffect(() => {
    let cancelled = false;
    const stripFont = (html: string) =>
      html.replace(/font-family:[^;"']*/g, "");
    async function highlight() {
      try {
        const themes = shikiTheme === SHIKI_THEME_DARK
          ? [shikiTheme]
          : [SHIKI_THEME_DARK, shikiTheme];
        const results = await Promise.all(
          themes.flatMap((theme) => [
            codeToHtml(leftCode || " ", { lang: leftLang, theme }),
            codeToHtml(rightCode || " ", { lang: rightLang, theme }),
          ])
        );
        if (!cancelled) {
          if (themes.length === 1) {
            setLeftEditorHtml(stripFont(results[0]));
            setRightEditorHtml(stripFont(results[1]));
            setLeftHtml(stripFont(results[0]));
            setRightHtml(stripFont(results[1]));
          } else {
            setLeftEditorHtml(stripFont(results[0]));
            setRightEditorHtml(stripFont(results[1]));
            setLeftHtml(stripFont(results[2]));
            setRightHtml(stripFont(results[3]));
          }
        }
      } catch (e) {
        console.error("Shiki highlighting failed:", e);
      }
    }
    highlight();
    return () => {
      cancelled = true;
    };
  }, [leftCode, rightCode, leftLang, rightLang, shikiTheme]);

  const diffResult = useMemo<DiffResult | null>(() => {
    if (!diffMode || !leftHtml || !rightHtml) return null;
    return computeDiff(leftCode, rightCode, leftHtml, rightHtml);
  }, [diffMode, leftCode, rightCode, leftHtml, rightHtml]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-zinc-500">versus</span>
            <span className="text-zinc-300">.</span>
            <span className="text-white">tools</span>
          </h1>
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {exporting ? "Exporting..." : "Export"}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="ml-0.5">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[200px] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                <button onClick={() => handleExportPng(2)} className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800">
                  Export PNG 2x
                </button>
                <button onClick={() => handleExportPng(4)} className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800">
                  Export PNG 4x
                </button>
                <div className="mx-3 my-1 border-t border-zinc-700/60" />
                <button onClick={() => handleExportSvg(false)} className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800">
                  Export SVG
                </button>
                <button onClick={() => handleExportSvg(true)} className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800">
                  Export SVG (transparent)
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {/* Controls */}
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          {/* Font */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Font
            </label>
            <select
              value={fontValue}
              onChange={(e) => setFontValue(e.target.value as FontValue)}
              className="rounded-md border border-zinc-700/60 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Ligatures */}
          <button
            onClick={() => setLigatures(!ligatures)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              ligatures
                ? "border-zinc-600 bg-zinc-700 text-white"
                : "border-zinc-700/60 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Lig
          </button>

          {/* Font Weight */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Wt
            </label>
            <input
              type="range"
              min={100}
              max={900}
              step={100}
              value={fontWeight}
              onChange={(e) => setFontWeight(Number(e.target.value))}
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-white"
            />
            <span className="text-xs tabular-nums text-zinc-400">{fontWeight}</span>
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Size
            </label>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="rounded-md border border-zinc-700/60 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
            >
              <option value={12}>12px</option>
              <option value={13}>13px</option>
              <option value={14}>14px</option>
              <option value={15}>15px</option>
              <option value={16}>16px</option>
              <option value={18}>18px</option>
              <option value={20}>20px</option>
              <option value={22}>22px</option>
              <option value={25}>25px</option>
            </select>
          </div>

          {/* Padding */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Pad
            </label>
            <select
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
              className="rounded-md border border-zinc-700/60 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
            >
              <option value={12}>12px</option>
              <option value={16}>16px</option>
              <option value={20}>20px</option>
              <option value={24}>24px</option>
              <option value={32}>32px</option>
              <option value={40}>40px</option>
            </select>
          </div>

          {/* Margin */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Margin
            </label>
            <select
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="rounded-md border border-zinc-700/60 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
            >
              <option value={2}>2px</option>
              <option value={8}>8px</option>
              <option value={16}>16px</option>
              <option value={24}>24px</option>
              <option value={32}>32px</option>
              <option value={52}>52px</option>
              <option value={64}>64px</option>
            </select>
          </div>

          {/* Layout */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Layout
            </label>
            <div className="flex overflow-hidden rounded-md border border-zinc-700/60">
              <button
                onClick={() => setLayout("side")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  layout === "side"
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Side by Side
              </button>
              <button
                onClick={() => setLayout("stack")}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  layout === "stack"
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Stacked
              </button>
            </div>
          </div>

          {/* Diff mode */}
          <button
            onClick={() => setDiffMode(!diffMode)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              diffMode
                ? "border-zinc-600 bg-zinc-700 text-white"
                : "border-zinc-700/60 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Diff
          </button>

          {/* Gray dots */}
          <button
            onClick={() => setGrayDots(!grayDots)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              grayDots
                ? "border-zinc-600 bg-zinc-700 text-white"
                : "border-zinc-700/60 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className="flex gap-0.5">
              <span className={`inline-block h-2 w-2 rounded-full ${grayDots ? "bg-zinc-400" : "bg-[#ff5f57]"}`} />
              <span className={`inline-block h-2 w-2 rounded-full ${grayDots ? "bg-zinc-500" : "bg-[#febc2e]"}`} />
              <span className={`inline-block h-2 w-2 rounded-full ${grayDots ? "bg-zinc-600" : "bg-[#28c840]"}`} />
            </span>
            Gray
          </button>

          {/* Gradients */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              BG
            </label>
            <div className="flex gap-1.5">
              {GRADIENTS.map((g, i) => (
                <button
                  key={g.name}
                  onClick={() => setGradientIndex(i)}
                  title={g.name}
                  className={`h-6 w-6 rounded-full transition-all ${
                    i === gradientIndex
                      ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950"
                      : "ring-1 ring-zinc-600 hover:ring-zinc-400"
                  }`}
                  style={{
                    background: g.transparent
                      ? "conic-gradient(#555 25%, #333 25% 50%, #555 50% 75%, #333 75%) 0 0 / 6px 6px"
                      : g.dots
                        ? `radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px) 0 0 / 5px 5px, ${g.css}`
                        : g.vercel
                          ? (g.windowBg === "#ffffff" ? "#fff" : "#000")
                          : g.css,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {g.vercel && (
                    <svg width="12" height="12" viewBox="0 0 76 65" fill={g.windowBg === "#ffffff" ? "black" : "white"}>
                      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Code Editors */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <input
                value={leftLabel}
                onChange={(e) => setLeftLabel(e.target.value)}
                className="w-48 rounded border border-zinc-800 bg-transparent px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-zinc-500 focus:border-zinc-600 focus:text-zinc-300 focus:outline-none"
                placeholder="Label"
              />
              <select
                value={leftLang}
                onChange={(e) => setLeftLang(e.target.value as Language)}
                className="rounded border border-zinc-700/60 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400 focus:border-zinc-500 focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="relative h-44 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 focus-within:border-zinc-600">
              <div
                className="shiki-output pointer-events-none absolute inset-0 overflow-auto p-4 font-mono text-sm leading-relaxed"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: leftEditorHtml }}
              />
              <textarea
                value={leftCode}
                onChange={(e) => setLeftCode(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, setLeftCode)}
                onScroll={(e) => {
                  const pre = e.currentTarget.previousElementSibling;
                  if (pre) { pre.scrollTop = e.currentTarget.scrollTop; pre.scrollLeft = e.currentTarget.scrollLeft; }
                }}
                className="absolute inset-0 h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-transparent caret-zinc-100 placeholder-zinc-600 focus:outline-none"
                placeholder="Paste your first snippet..."
                spellCheck={false}
              />
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <input
                value={rightLabel}
                onChange={(e) => setRightLabel(e.target.value)}
                className="w-48 rounded border border-zinc-800 bg-transparent px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-zinc-500 focus:border-zinc-600 focus:text-zinc-300 focus:outline-none"
                placeholder="Label"
              />
              <select
                value={rightLang}
                onChange={(e) => setRightLang(e.target.value as Language)}
                className="rounded border border-zinc-700/60 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400 focus:border-zinc-500 focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="relative h-44 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 focus-within:border-zinc-600">
              <div
                className="shiki-output pointer-events-none absolute inset-0 overflow-auto p-4 font-mono text-sm leading-relaxed"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: rightEditorHtml }}
              />
              <textarea
                value={rightCode}
                onChange={(e) => setRightCode(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, setRightCode)}
                onScroll={(e) => {
                  const pre = e.currentTarget.previousElementSibling;
                  if (pre) { pre.scrollTop = e.currentTarget.scrollTop; pre.scrollLeft = e.currentTarget.scrollLeft; }
                }}
                className="absolute inset-0 h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-transparent caret-zinc-100 placeholder-zinc-600 focus:outline-none"
                placeholder="Paste your second snippet..."
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Preview
          </span>
          <span className="text-xs text-zinc-600">2x retina export</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-6">
          {/* ---- Exportable Card ---- */}
          <div
            ref={exportRef}
            style={{
              background: gradient.css,
              padding: `${margin}px`,
              width: "fit-content",
              minWidth: "auto",
              position: "relative",
            }}
          >
            {/* Dot pattern overlay */}
            {gradient.dots && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
            )}
            {/* Vercel grid lines + crosses */}
            {gradient.vercel && margin > 0 && (() => {
              const lc = isVercelLight ? "#e0e0e0" : "#333333";
              const cc = isVercelLight ? "#999999" : "#888888";
              const arm = 12;
              return (
                <>
                  {/* Grid lines — full edge to edge */}
                  <div style={{ position: "absolute", top: margin, left: 0, right: 0, height: 1, background: lc }} />
                  <div style={{ position: "absolute", bottom: margin, left: 0, right: 0, height: 1, background: lc }} />
                  <div style={{ position: "absolute", left: margin, top: 0, bottom: 0, width: 1, background: lc }} />
                  <div style={{ position: "absolute", right: margin, top: 0, bottom: 0, width: 1, background: lc }} />
                  {/* Top-left cross */}
                  <div style={{ position: "absolute", zIndex: 3, top: margin, left: margin - arm, width: arm * 2 + 1, height: 1, background: cc }} />
                  <div style={{ position: "absolute", zIndex: 3, top: margin - arm, left: margin, width: 1, height: arm * 2 + 1, background: cc }} />
                  {/* Bottom-right cross */}
                  <div style={{ position: "absolute", zIndex: 3, bottom: margin, left: `calc(100% - ${margin + arm + 1}px)`, width: arm * 2 + 1, height: 1, background: cc }} />
                  <div style={{ position: "absolute", zIndex: 3, top: `calc(100% - ${margin + arm + 1}px)`, right: margin, width: 1, height: arm * 2 + 1, background: cc }} />
                </>
              );
            })()}
            {/* Window Card */}
            <div
              style={{
                position: "relative",
                background: gradient.windowBg || "rgba(13, 17, 23, 0.85)",
                borderRadius: gradient.vercel ? "0" : "14px",
                overflow: "hidden",
                border: `1px solid ${gradient.vercel ? (isVercelLight ? "#e0e0e0" : "#333333") : "rgba(255,255,255,0.07)"}`,
                display: "flex",
                flexDirection: layout === "stack" ? "column" : "row",
              }}
            >
              {diffMode && diffResult && layout === "stack" ? (
                /* Unified diff: single panel */
                <div style={{ flex: 1 }}>
                  {!gradient.vercel && <TrafficLights grayDots={grayDots} />}
                  <div style={{ padding: `${padding}px` }}>
                    {(leftLabel || rightLabel) && (
                      <PanelLabel
                        label={`${leftLabel}${leftLabel && rightLabel ? " → " : ""}${rightLabel}`}
                        vercel={gradient.vercel}
                        light={gradient.light}
                      />
                    )}
                    <DiffRender lines={diffResult.unified} fontSize={fontSize}
                      fontFamily={currentFont.css} fontWeight={fontWeight} ligatures={ligatures} />
                  </div>
                </div>
              ) : (
                /* Two panels: split diff OR normal */
                <>
                  <div style={{ flex: 1 }}>
                    {!gradient.vercel && <TrafficLights grayDots={grayDots} />}
                    <div style={{
                      padding: `${padding}px`,
                      paddingBottom: !diffMode && layout === "stack" ? `${padding / 2}px` : `${padding}px`,
                    }}>
                      {leftLabel && <PanelLabel label={leftLabel} vercel={gradient.vercel} light={gradient.light} />}
                      {diffMode && diffResult
                        ? <DiffRender lines={diffResult.left} fontSize={fontSize}
                            fontFamily={currentFont.css} fontWeight={fontWeight} ligatures={ligatures} />
                        : <NormalRender html={leftHtml} fontSize={fontSize}
                            fontFamily={currentFont.css} fontWeight={fontWeight} ligatures={ligatures} />}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={layout === "stack"
                    ? { height: "1px", background: gradient.vercel ? (isVercelLight ? "#e0e0e0" : "#333333") : "rgba(255,255,255,0.06)" }
                    : { width: "1px", background: gradient.vercel ? (isVercelLight ? "#e0e0e0" : "#333333") : "rgba(255,255,255,0.06)" }
                  } />

                  <div style={{
                    flex: 1, padding: `${padding}px`,
                    paddingTop: layout === "stack" || gradient.vercel ? `${padding}px` : `${18 + 12 + padding}px`,
                  }}>
                    {rightLabel && <PanelLabel label={rightLabel} vercel={gradient.vercel} light={gradient.light} />}
                    {diffMode && diffResult
                      ? <DiffRender lines={diffResult.right} fontSize={fontSize}
                          fontFamily={currentFont.css} fontWeight={fontWeight} ligatures={ligatures} />
                      : <NormalRender html={rightHtml} fontSize={fontSize}
                          fontFamily={currentFont.css} fontWeight={fontWeight} ligatures={ligatures} />}
                  </div>
                </>
              )}
            </div>
          </div>
          {/* ---- End Exportable Card ---- */}
        </div>

      </main>

      <footer className="border-t border-zinc-800/60 px-6 py-4">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-3 text-xs text-zinc-500">
          <a
            href="https://github.com/1st1/versus.tools"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-zinc-300"
          >
            GitHub
          </a>
          <span className="text-zinc-700">·</span>
          <span>
            by{" "}
            <a
              href="https://x.com/1st1"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-zinc-300"
            >
              @1st1
            </a>
          </span>
          <span className="text-zinc-700">·</span>
          <a
            href="https://vercel.com/home"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition-colors hover:text-zinc-300"
          >
            Deployed on ▲ Vercel
          </a>
        </div>
      </footer>
    </div>
  );
}
