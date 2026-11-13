import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import { JournalProvider } from "@/components/JournalProvider";
import { MentorProvider } from "@/components/MentorProvider";
import { Nav } from "@/components/Nav";
import { ProgressProvider } from "@/components/ProgressProvider";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Content Security Policy for the production build (GitHub Pages can't send headers, so it's a meta tag). The static
 * export needs inline scripts and styles; the protection that matters is connect-src: injected code can't send the sync
 * token or data anywhere but GitHub's API. Dev builds skip it (hot reload needs eval and websockets).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://api.github.com https://raw.githubusercontent.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const metadata: Metadata = {
  title: "Fundamentals",
  description: "Refresh your software-engineering fundamentals, one short interactive lesson at a time.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch / Dynamic Island and home indicator; safe-area insets keep content clear.
  viewportFit: "cover",
  // Dark-first (V2): the navy theme is the default everywhere.
  themeColor: "#070b14",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {process.env.NODE_ENV === "production" && (
        <head>
          <meta httpEquiv="Content-Security-Policy" content={CSP} />
        </head>
      )}
      <body className="flex min-h-dvh flex-col">
        <AuthGate>
          <ProgressProvider>
            <JournalProvider>
            <MentorProvider>
            <Nav />
            <div className="flex-1 md:grid md:grid-cols-[4.5rem_minmax(0,1fr)] lg:grid-cols-[15rem_minmax(0,1fr)]">
              <Sidebar />
              <div className="flex min-w-0 flex-col">
                <main className="mx-auto w-full max-w-3xl flex-1 px-[max(1rem,env(safe-area-inset-left))] py-8 md:max-w-[80rem] md:px-8 md:py-10 lg:px-10 lg:py-12 2xl:max-w-[88rem]">{children}</main>
                <footer className="mx-auto w-full max-w-3xl px-[max(1rem,env(safe-area-inset-left))] pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+2rem)] text-xs text-ink-3 md:max-w-[80rem] md:px-8 md:pb-8 lg:px-10 2xl:max-w-[88rem]">
                  Progress stays in your browser unless you enable sync in Settings.
                </footer>
              </div>
            </div>
            </MentorProvider>
            </JournalProvider>
          </ProgressProvider>
        </AuthGate>
      </body>
    </html>
  );
}
