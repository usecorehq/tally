import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { THEME_SCRIPT } from "./_components/theme-toggle";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Tally",
  description: "Photo-to-inventory and stock-taking for Qorelly merchants.",
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
