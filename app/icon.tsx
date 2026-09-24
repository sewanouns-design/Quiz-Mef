import { ImageResponse } from "next/og";

export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 10,
        }}
      >
        <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
          <path
            d="M20 54 L42 74 L80 26"
            stroke="#dc2626"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
