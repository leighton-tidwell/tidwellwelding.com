import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Assets are pre-optimized at build time; no Cloudflare image resizing.
    unoptimized: true,
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
