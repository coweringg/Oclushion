import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter-loaded",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://oclushion.com"),
  title: {
    default: "Oclushion | AI IDE for real development",
    template: "%s | Oclushion",
  },
  description:
    "Turn any repository into a secure AI-agent workspace with skillpacks, Sano Shield, Safe Diff, Kanban and enterprise audit.",
  keywords: [
    "AI IDE",
    "code agents",
    "AI privacy",
    "safe diff",
    "professional vibe coding",
    "Oclushion",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Oclushion",
    title: "Oclushion | AI IDE for real development",
    description: "Skillpacks, Sano Shield, Safe Diff and coordinated agents for real repositories.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Oclushion" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Oclushion | AI IDE for real development",
    description: "Turn repositories into secure AI-agent workspaces.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
