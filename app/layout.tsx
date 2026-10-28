import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { ProgressProvider } from "@/components/ProgressProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fundamentals Tracker",
  description: "Revisit engineering fundamentals, find weak areas, and practice them adaptively.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch / Dynamic Island and home indicator; safe-area insets keep content clear.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a19" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <AuthGate>
          <ProgressProvider>
            <Nav />
            <main className="mx-auto w-full max-w-6xl flex-1 px-[max(1.25rem,env(safe-area-inset-left))] py-6 sm:py-9">
              {children}
            </main>
            <footer className="mx-auto w-full max-w-6xl px-[max(1.25rem,env(safe-area-inset-left))] pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+2rem)] text-xs text-ink-3 sm:pb-8">
              Lessons and questions live in <code>/content</code>. Progress stays in your browser unless you enable sync.
            </footer>
          </ProgressProvider>
        </AuthGate>
      </body>
    </html>
  );
}
