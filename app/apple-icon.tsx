import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
            fontSize: 104,
            fontWeight: 800,
            fontFamily: "sans-serif",
            letterSpacing: -4,
          }}
        >
          !?
        </div>
      </div>
    ),
    { ...size }
  );
}
