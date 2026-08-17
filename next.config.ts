import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses (gzip/brotli) — reduces API payload size
  compress: true,

  // Experimental: enable faster SWC minification
  experimental: {
    // Optimise package imports — reduces bundle size for icon/motion libs
    optimizePackageImports: ["framer-motion", "lucide-react"],
  },
};

export default nextConfig;
