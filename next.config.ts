import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server (.next/standalone) for the Docker image; see Dockerfile.
  output: "standalone",
};

export default nextConfig;
