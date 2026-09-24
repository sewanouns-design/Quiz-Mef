import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a2e5a",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#dc2626",
            fontSize: 108,
            fontWeight: 800,
            fontFamily: "sans-serif",
            letterSpacing: -4,
          }}
        >
          !?
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
