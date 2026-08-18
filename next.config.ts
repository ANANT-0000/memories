import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses (gzip/brotli) — reduces API payload size
  compress: true,

  // Allow Next.js Image Optimisation to proxy Supabase signed URLs.
  // Vercel will resize, convert to WebP/AVIF and cache at the edge —
  // dramatically faster than fetching raw images from Supabase on every load.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
    // Serve images in modern formats — browsers that support AVIF get ~50%
    // smaller files than WebP; others fall back automatically.
    formats: ["image/avif", "image/webp"],
    // Vercel caches optimised images for 1 year by default (immutable URLs).
    minimumCacheTTL: 3600,
  },

  // Experimental: enable faster SWC minification
  experimental: {
    // Optimise package imports — reduces bundle size for icon/motion libs
    optimizePackageImports: ["framer-motion", "lucide-react"],
  },
};

export default nextConfig;
