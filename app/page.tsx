export default function Home() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "var(--accent)",
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-nunito), Nunito, sans-serif",
            fontWeight: 800,
            fontSize: "22px",
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          Meragi Intel
        </span>
      </div>
    </div>
  );
}
