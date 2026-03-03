import { type DiffLine, DIFF_COLORS } from "../lib/diff";

function DiffLineContent({
  line,
  fontSize,
  fontFamily,
  fontWeight,
  ligatures,
}: {
  line: DiffLine;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  ligatures: boolean;
}) {
  const isSpacer = line.type === "spacer";
  const bgColor =
    line.type === "add"
      ? DIFF_COLORS.add.bg
      : line.type === "remove"
        ? DIFF_COLORS.remove.bg
        : line.type === "spacer"
          ? DIFF_COLORS.spacer.bg
          : "transparent";
  const gutterColor =
    line.type === "add"
      ? DIFF_COLORS.add.gutter
      : line.type === "remove"
        ? DIFF_COLORS.remove.gutter
        : "transparent";
  const gutterChar =
    line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";

  return (
    <div
      style={{
        display: "flex",
        background: bgColor,
        lineHeight: 1.7,
        minHeight: `${fontSize * 1.7}px`,
      }}
    >
      <div
        style={{
          width: `${fontSize * 1.8}px`,
          flexShrink: 0,
          textAlign: "center",
          background: gutterColor,
          color:
            line.type === "add"
              ? "rgba(63, 185, 80, 0.7)"
              : line.type === "remove"
                ? "rgba(248, 81, 73, 0.7)"
                : "transparent",
          fontSize: `${fontSize}px`,
          fontFamily,
          fontWeight,
          userSelect: "none",
        }}
      >
        {isSpacer ? "" : gutterChar}
      </div>
      {isSpacer ? (
        <div style={{ flex: 1 }} />
      ) : (
        <div
          style={{
            flex: 1,
            fontFamily,
            fontVariantLigatures: ligatures ? "normal" : "none",
            fontWeight,
            fontSize: `${fontSize}px`,
            whiteSpace: "pre",
            paddingLeft: "8px",
          }}
          dangerouslySetInnerHTML={{ __html: line.html }}
        />
      )}
    </div>
  );
}

export function DiffRender({ lines, fontSize, fontFamily, fontWeight, ligatures }: {
  lines: DiffLine[];
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  ligatures: boolean;
}) {
  return (
    <>
      {lines.map((line, i) => (
        <DiffLineContent key={i} line={line} fontSize={fontSize}
          fontFamily={fontFamily} fontWeight={fontWeight} ligatures={ligatures} />
      ))}
    </>
  );
}
