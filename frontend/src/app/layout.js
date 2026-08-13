import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

// Display face — headings only, used with restraint.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

// Body/UI face — labels, buttons, paragraph text.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Utility face — round IDs, file paths, timestamps.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata = {
  title: "Olympiad Portal — Organiser Console",
  description: "Set up rounds, upload papers, and track submissions.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
  <header className="border-b border-lavender/20 bg-surface">
    <nav className="mx-auto flex max-w-3xl items-center justify-between px-8 py-4">
      <Link
        href="/rounds"
        className="font-display text-lg font-semibold text-ink"
      >
        Olympiad Portal
      </Link>
      <div className="flex gap-4 text-sm">
        <Link
          href="/rounds"
          className="text-ink-soft transition-colors hover:text-lavender-deep"
        >
          Rounds
        </Link>
        <Link
          href="/rounds/new"
          className="text-ink-soft transition-colors hover:text-lavender-deep"
        >
          New round
        </Link>
      </div>
    </nav>
  </header>
  {children}
</body>
    </html>
  );
}