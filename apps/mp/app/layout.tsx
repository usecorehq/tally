import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { THEME_SCRIPT } from "./_components/theme-toggle";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const TITLE = "Tally by Qorelly: shelf photo to counted stock";
const DESCRIPTION =
  "Tally reads every label, counts every unit and matches Nigerian products with ₦ prices. The merchant just confirms. Built on Muse Spark, SAM 3.1 and Qore Catalog.";
const OG_ALT = "Tally: shelf photo to counted stock, in minutes";

export const metadata: Metadata = {
  // Absolute base for share links; the image must be public (see proxy.ts).
  metadataBase: new URL("https://tally.qorelly.com"),
  title: "Tally",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Tally by Qorelly",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_NG",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: OG_ALT, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og.png", alt: OG_ALT }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT sets `dark` on <html> before React hydrates.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
