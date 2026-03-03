export function PanelLabel({ label, vercel, light }: { label: string; vercel?: boolean; light?: boolean }) {
  return (
    <div style={{
      fontSize: "12px", fontWeight: 600,
      color: vercel ? (light ? "#c0c0c0" : "#444444") : "#7d8590",
      marginBottom: "14px", textTransform: "uppercase",
      letterSpacing: "0.05em",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {label}
    </div>
  );
}
