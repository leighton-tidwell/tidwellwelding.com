import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits over the admin console's bottom tab bar on a
  // phone-sized window and swallows taps on the first tab. Compile and runtime
  // errors still surface without it.
  devIndicators: false,
  images: {
    // Assets are pre-optimized at build time; no Cloudflare image resizing.
    unoptimized: true,
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
