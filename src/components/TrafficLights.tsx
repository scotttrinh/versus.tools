export function TrafficLights({ grayDots }: { grayDots: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "18px 20px 0" }}>
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: grayDots ? "#555" : "#ff5f57" }} />
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: grayDots ? "#777" : "#febc2e" }} />
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: grayDots ? "#999" : "#28c840" }} />
    </div>
  );
}
