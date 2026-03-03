export function NormalRender({ html, fontFamily, fontWeight, fontSize, ligatures }: {
  html: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  ligatures: boolean;
}) {
  return (
    <div className="shiki-output" style={{
      fontFamily, fontVariantLigatures: ligatures ? "normal" : "none",
      fontWeight, fontSize: `${fontSize}px`, lineHeight: 1.7, whiteSpace: "pre",
    }} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
