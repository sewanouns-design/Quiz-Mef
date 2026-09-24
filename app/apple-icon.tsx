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
        <svg width="112" height="112" viewBox="0 0 100 100" fill="none">
          <path
            d="M50 6 C36 20 26 34 24 48 C22 62 28 74 38 80 C35 70 36 60 40 52 C43 64 49 73 58 78 C70 73 78 61 78 47 C78 31 66 16 50 6 Z"
            fill="#dc2626"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
