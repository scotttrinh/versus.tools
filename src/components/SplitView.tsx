"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  createContext,
  type KeyboardEvent,
} from "react";
import { codeToHtml } from "shiki";
import { toPng } from "html-to-image";

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
}

const GRADIENTS: Gradient[] = [
  {
    name: "Void",
    css: "linear-gradient(145deg, #000000 0%, #0a0a0a 50%, #000000 100%)",
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
    name: "Storm",
    css: "linear-gradient(145deg, #374151 0%, #1f2937 50%, #374151 100%)",
  },
  {
    name: "Fog",
    css: "linear-gradient(145deg, #9ca3af 0%, #6b7280 50%, #9ca3af 100%)",
  },
  {
    name: "Silver",
    css: "linear-gradient(145deg, #d1d5db 0%, #e5e7eb 50%, #d1d5db 100%)",
  },
  {
    name: "Pearl",
    css: "linear-gradient(145deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)",
  },
  {
    name: "Snow",
    css: "linear-gradient(145deg, #ffffff 0%, #f9fafb 50%, #ffffff 100%)",
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

const SHIKI_THEME = "github-dark";

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
  const [gradientIndex, setGradientIndex] = usePersist("gradientIndex", 1);
  const [leftLabel, setLeftLabel] = usePersist("leftLabel", "Before");
  const [rightLabel, setRightLabel] = usePersist("rightLabel", "After");
  const [leftHtml, setLeftHtml] = useState("");
  const [rightHtml, setRightHtml] = useState("");
  const [exporting, setExporting] = useState(false);
  const [fontSize, setFontSize] = usePersist("fontSize", 14);
  const [padding, setPadding] = usePersist("padding", 24);
  const [margin, setMargin] = usePersist("margin", 52);
  const [layout, setLayout] = usePersist<"side" | "stack">("layout", "side");
  const [grayDots, setGrayDots] = usePersist("grayDots", false);
  const [fontValue, setFontValue] = usePersist<FontValue>("font", "geist");
  const [ligatures, setLigatures] = usePersist("ligatures", true);
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

  // Highlight code with shiki
  useEffect(() => {
    let cancelled = false;
    async function highlight() {
      try {
        const [lHtml, rHtml] = await Promise.all([
          codeToHtml(leftCode || " ", { lang: leftLang, theme: SHIKI_THEME }),
          codeToHtml(rightCode || " ", { lang: rightLang, theme: SHIKI_THEME }),
        ]);
        if (!cancelled) {
          // Strip font-family from shiki output so our font choice takes effect
          const stripFont = (html: string) =>
            html.replace(/font-family:[^;"']*/g, "");
          setLeftHtml(stripFont(lHtml));
          setRightHtml(stripFont(rHtml));
        }
      } catch (e) {
        console.error("Shiki highlighting failed:", e);
      }
    }
    highlight();
    return () => {
      cancelled = true;
    };
  }, [leftCode, rightCode, leftLang, rightLang]);

  const handleExport = useCallback(async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = "versus-tools.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 2,
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch (err) {
      console.error("Copy failed:", err);
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

  const gradient = GRADIENTS[gradientIndex];

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
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={exporting}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              Copy Image
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {exporting ? "Exporting..." : "Export PNG"}
            </button>
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

          {/* Labels */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Labels
            </label>
            <input
              value={leftLabel}
              onChange={(e) => setLeftLabel(e.target.value)}
              className="w-24 rounded-md border border-zinc-700/60 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
              placeholder="Left"
            />
            <input
              value={rightLabel}
              onChange={(e) => setRightLabel(e.target.value)}
              className="w-24 rounded-md border border-zinc-700/60 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
              placeholder="Right"
            />
          </div>

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
                        : g.css,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Code Editors */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {leftLabel}
              </label>
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
            <textarea
              value={leftCode}
              onChange={(e) => setLeftCode(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, setLeftCode)}
              className="h-44 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 font-mono text-sm leading-relaxed text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
              placeholder="Paste your first snippet..."
              spellCheck={false}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {rightLabel}
              </label>
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
            <textarea
              value={rightCode}
              onChange={(e) => setRightCode(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, setRightCode)}
              className="h-44 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 font-mono text-sm leading-relaxed text-zinc-100 placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
              placeholder="Paste your second snippet..."
              spellCheck={false}
            />
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
              minWidth: layout === "stack" ? "auto" : "900px",
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
            {/* Window Card */}
            <div
              style={{
                position: "relative",
                background: gradient.windowBg || "rgba(13, 17, 23, 0.85)",
                borderRadius: "14px",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: layout === "stack" ? "column" : "row",
              }}
            >
              {/* Left panel */}
              <div style={{ flex: 1 }}>
                {/* Traffic lights */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "18px 20px 0",
                  }}
                >
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: grayDots ? "#555" : "#ff5f57" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: grayDots ? "#777" : "#febc2e" }} />
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: grayDots ? "#999" : "#28c840" }} />
                </div>
                <div style={{ padding: `${padding}px`, paddingBottom: layout === "stack" ? `${padding / 2}px` : `${padding}px` }}>
                  {leftLabel && (
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#7d8590",
                        marginBottom: "14px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontFamily:
                          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      }}
                    >
                      {leftLabel}
                    </div>
                  )}
                  <div
                    className="shiki-output"
                    style={{
                      fontFamily: currentFont.css,
                      fontVariantLigatures: ligatures ? "normal" : "none",
                      fontSize: `${fontSize}px`,
                      lineHeight: 1.7,
                      whiteSpace: "pre",
                    }}
                    dangerouslySetInnerHTML={{ __html: leftHtml }}
                  />
                </div>
              </div>

              {/* Divider */}
              <div
                style={layout === "stack" ? {
                  height: "1px",
                  background: "rgba(255,255,255,0.06)",
                } : {
                  width: "1px",
                  background: "rgba(255,255,255,0.06)",
                }}
              />

              {/* Right panel */}
              <div style={{ flex: 1, padding: `${padding}px`, paddingTop: layout === "stack" ? `${padding}px` : `${18 + 12 + padding}px` }}>
                {rightLabel && (
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#7d8590",
                      marginBottom: "14px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    {rightLabel}
                  </div>
                )}
                <div
                  className="shiki-output"
                  style={{
                    fontFamily: currentFont.css,
                    fontVariantLigatures: ligatures ? "normal" : "none",
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.7,
                    whiteSpace: "pre",
                  }}
                  dangerouslySetInnerHTML={{ __html: rightHtml }}
                />
              </div>
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
        </div>
      </footer>
    </div>
  );
}
