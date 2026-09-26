import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/* Wszystko idzie z własnego originu: fonty przez next/font, obrazki z /public, API przez /bff.
   'unsafe-inline' w script-src: skrypt motywu z layout.tsx i inline payload RSC — bez nonce
   (który wymusza dynamiczny rendering) Next go potrzebuje. 'unsafe-eval' tylko w dev (HMR). */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // mikrofon tylko dla dyktowania na własnej stronie
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  // tylko w prod — HSTS na http://localhost zablokowałby dev na tej domenie
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000" }]),
];

const nextConfig: NextConfig = {
  // A self-contained server (.next/standalone) for the Docker image; see Dockerfile.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
