import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My memory for you",
  description: "A private and secure collection of our beautiful memories. My memory for you.",
  keywords: ["My memory for you", "private photo gallery", "secure gallery", "memories"],
  openGraph: {
    title: "My memory for you",
    description: "A private and secure collection of our beautiful memories.",
    url: "https://my-memory-for-you.vercel.app",
    siteName: "My memory for you",
    images: [
      {
        url: "/icon-512.png", // Fallback image for OG
        width: 512,
        height: 512,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://my-memory-for-you.vercel.app"),
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-black">{children}</body>
    </html>
  );
}
