import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Tally Console", description: "Q Vision distillation: upload images and train against the Qore Catalog API." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
