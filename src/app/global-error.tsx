"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Caught in global-error.tsx:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily:
              "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif",
            textAlign: "center",
            padding: "2rem",
            backgroundColor: "#ffffff",
            color: "#020617",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 48,
              width: 48,
              borderRadius: 16,
              backgroundColor: "rgba(220, 38, 38, 0.08)",
              marginBottom: 20,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <h2
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              margin: "0 0 6px 0",
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#64748b",
              lineHeight: 1.6,
              maxWidth: 360,
              margin: "0 0 24px 0",
            }}
          >
            An unexpected error occurred. Please try again.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => reset()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: "#2A86FF",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.8125rem",
                fontWeight: 500,
                fontFamily: "inherit",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                backgroundColor: "transparent",
                color: "#020617",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.8125rem",
                fontWeight: 500,
                fontFamily: "inherit",
                textDecoration: "none",
              }}
            >
              Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
