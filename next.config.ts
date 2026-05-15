import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.238", "192.168.0.*", "192.168.1.*"],
  serverExternalPackages: [
    "playwright",
    "bullmq",
    "pdf-parse",
    "postgres",
    "googleapis",
    "@anthropic-ai/sdk",
    "@google/generative-ai",
    "ioredis",
  ],
};

export default nextConfig;
