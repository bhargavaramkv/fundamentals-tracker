import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
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

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fundamentals",
  description: "A daily plan for engineering fundamentals: reliable sources, real practice, coding history and technology news.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch / Dynamic Island and home indicator; safe-area insets keep content clear.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#101317" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <AuthGate>
          <ProgressProvider>
            <Nav />
            <main className="mx-auto w-full max-w-5xl flex-1 px-[max(1rem,env(safe-area-inset-left))] py-7 sm:px-6 sm:py-12">{children}</main>
            <footer className="meta mx-auto w-full max-w-5xl px-[max(1rem,env(safe-area-inset-left))] pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+2rem)] sm:px-6 sm:pb-8">
              Progress stays in your browser unless you enable sync in Settings.
            </footer>
          </ProgressProvider>
        </AuthGate>
      </body>
    </html>
  );
}
