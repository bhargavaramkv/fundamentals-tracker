import type { Metadata } from "next";
import { Bangers, Geist_Mono, Roboto_Condensed } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { ProgressProvider } from "@/components/ProgressProvider";
import "./globals.css";

const heading = Bangers({
  variable: "--font-heading",
  weight: "400",
  subsets: ["latin"],
});

const body = Roboto_Condensed({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Training Facility · BHARGAVA.DEV",
  description: "Private training facility: engineering fundamentals, weak-spot detection and adaptive drills.",
  robots: { index: false, follow: false },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛡️</text></svg>",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthGate>
          <ProgressProvider>
            <Nav />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
            <footer className="mx-auto w-full max-w-5xl px-4 pb-8 font-mono text-[10px] tracking-[0.2em] text-ink-3 uppercase">
              © {new Date().getFullYear()} Bhargava Ram K V · Training facility · All systems operational
            </footer>
          </ProgressProvider>
        </AuthGate>
      </body>
    </html>
  );
}
