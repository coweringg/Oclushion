import { ImageResponse } from "next/og";

export const alt = "Oclushion IDE, AI workspace for real repositories";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "70px",
        color: "#faf8ff",
        background:
          "radial-gradient(circle at 72% 45%, rgba(139,92,246,0.34), transparent 38%), #04010a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            height: 46,
            width: 46,
            borderRadius: 14,
            border: "1px solid rgba(34,215,255,0.38)",
            background: "linear-gradient(135deg, rgba(145,56,255,0.8), rgba(34,215,255,0.28))",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 27,
            fontWeight: 700,
          }}
        >
          O
        </div>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4 }}>OCLUSHION</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <span style={{ color: "#c084fc", fontSize: 22, fontWeight: 600 }}>
          AI IDE desktop-first
        </span>
        <span style={{ fontSize: 67, fontWeight: 700, letterSpacing: -3 }}>
          Give AI a real workspace
        </span>
        <span style={{ color: "#b8b2d4", fontSize: 27 }}>
          Skillpacks, Safe Diff and Sano Shield for real repositories.
        </span>
      </div>
    </div>,
    size,
  );
}
